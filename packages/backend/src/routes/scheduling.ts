import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, or, sql, inArray, gte, lte, ne } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  jobs,
  jobTypes,
  companies,
  projects,
  jobLocations,
  jobAssetRequirements,
  jobAssignments,
  addresses,
  assets,
  employees,
  assetCategories,
  assetSubcategories,
} from "../db/schema/tenant.js";
import { z } from "zod";

// ── Query schemas ──

const schedulingQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  search: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  customerId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  jobTypeId: z.uuid().optional(),
  allocationStatus: z.enum(["all", "allocated", "unallocated"]).optional(),
  groupBy: z.enum(["customer", "project", "none"]).optional(),
});

type SchedulingQuery = z.infer<typeof schedulingQuerySchema>;

const conflictsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  assetId: z.uuid().optional(),
  employeeId: z.uuid().optional(),
});

// ── Types for structured responses ──

interface SchedulingJobLocation {
  id: string;
  locationType: string;
  addressStreet: string | null;
  addressSuburb: string | null;
  sequence: number;
}

interface SchedulingJobAssignment {
  id: string;
  assignmentType: string;
  assetId: string | null;
  employeeId: string | null;
  contractorCompanyId: string | null;
  status: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  assetRegistration: string | null;
  assetMake: string | null;
  assetModel: string | null;
  assetNumber: string | null;
  assetCategoryName: string | null;
  assetSubcategoryName: string | null;
  employeeName: string | null;
  contractorName: string | null;
}

interface SchedulingJobRequirement {
  id: string;
  assetCategoryId: string;
  assetSubcategoryId: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  quantity: number;
}

interface SchedulingJob {
  id: string;
  jobNumber: string;
  name: string;
  status: string;
  priority: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  isMultiDay: boolean;
  poNumber: string | null;
  minimumChargeHours: string | null;
  internalNotes: string | null;
  jobTypeName: string | null;
  jobTypeCode: string | null;
  customerName: string | null;
  customerId: string | null;
  projectName: string | null;
  projectId: string | null;
  projectNumber: string | null;
  locations: SchedulingJobLocation[];
  assignments: SchedulingJobAssignment[];
  assetRequirements: SchedulingJobRequirement[];
  assignmentCount: number;
}

interface ConflictEntry {
  resourceType: "asset" | "driver";
  resourceId: string;
  resourceLabel: string;
  jobs: Array<{
    jobId: string;
    jobNumber: string;
    jobName: string;
    customerName: string | null;
    plannedStart: string | null;
    plannedEnd: string | null;
    scheduledStart: string | null;
    scheduledEnd: string | null;
  }>;
}

export async function schedulingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/scheduling
   * Returns jobs for a specific date with assignments, locations, and requirements.
   * Designed for the dispatcher scheduling view.
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = schedulingQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query: SchedulingQuery = parsed.data;

      // Date window: start of day to end of day
      const dayStart = `${query.date}T00:00:00.000Z`;
      const dayEnd = `${query.date}T23:59:59.999Z`;

      // Build conditions: jobs scheduled on this date OR multi-day jobs spanning this date
      const conditions = [
        isNull(jobs.deletedAt),
        // Exclude cancelled/declined from scheduler by default unless explicitly filtered
        ...(query.status
          ? [eq(jobs.status, query.status)]
          : [
              and(
                ne(jobs.status, "cancelled"),
                ne(jobs.status, "declined"),
              ) ?? sql`TRUE`,
            ]),
        // Date range: job overlaps with the selected day
        or(
          // Jobs starting on this day
          and(
            gte(jobs.scheduledStart, sql`${dayStart}::timestamptz`),
            lte(jobs.scheduledStart, sql`${dayEnd}::timestamptz`),
          ),
          // Multi-day jobs spanning this day
          and(
            lte(jobs.scheduledStart, sql`${dayEnd}::timestamptz`),
            gte(jobs.scheduledEnd, sql`${dayStart}::timestamptz`),
          ),
          // Jobs with no scheduled date (drafts that need scheduling)
          isNull(jobs.scheduledStart),
        ) ?? sql`TRUE`,
      ];

      if (query.priority) {
        conditions.push(eq(jobs.priority, query.priority));
      }
      if (query.customerId) {
        conditions.push(eq(jobs.customerId, query.customerId));
      }
      if (query.projectId) {
        conditions.push(eq(jobs.projectId, query.projectId));
      }
      if (query.jobTypeId) {
        conditions.push(eq(jobs.jobTypeId, query.jobTypeId));
      }

      // Fetch jobs for this date
      const jobRows = await ctx.tenantDb
        .select({
          job: jobs,
          jobTypeName: jobTypes.name,
          jobTypeCode: jobTypes.code,
          customerName: companies.name,
          projectName: projects.name,
          projectNumber: projects.projectNumber,
        })
        .from(jobs)
        .leftJoin(jobTypes, eq(jobs.jobTypeId, jobTypes.id))
        .leftJoin(companies, eq(jobs.customerId, companies.id))
        .leftJoin(projects, eq(jobs.projectId, projects.id))
        .where(and(...conditions))
        .orderBy(jobs.scheduledStart, jobs.priority, jobs.createdAt);

      if (jobRows.length === 0) {
        return {
          success: true,
          data: {
            date: query.date,
            jobs: [],
            summary: { total: 0, allocated: 0, unallocated: 0, assignmentCount: 0 },
          },
        };
      }

      const jobIds = jobRows.map((r) => r.job.id);

      // Fetch all sub-resources in parallel
      const [locationRows, assignmentRows, requirementRows] = await Promise.all([
        ctx.tenantDb
          .select({
            id: jobLocations.id,
            jobId: jobLocations.jobId,
            locationType: jobLocations.locationType,
            sequence: jobLocations.sequence,
            addressStreet: addresses.streetAddress,
            addressSuburb: addresses.suburb,
          })
          .from(jobLocations)
          .leftJoin(addresses, eq(jobLocations.addressId, addresses.id))
          .where(inArray(jobLocations.jobId, jobIds))
          .orderBy(jobLocations.sequence),

        ctx.tenantDb
          .select({
            id: jobAssignments.id,
            jobId: jobAssignments.jobId,
            assignmentType: jobAssignments.assignmentType,
            assetId: jobAssignments.assetId,
            employeeId: jobAssignments.employeeId,
            contractorCompanyId: jobAssignments.contractorCompanyId,
            status: jobAssignments.status,
            plannedStart: jobAssignments.plannedStart,
            plannedEnd: jobAssignments.plannedEnd,
            assetRegistration: assets.registrationNumber,
            assetMake: assets.make,
            assetModel: assets.model,
            assetNumber: assets.assetNumber,
            assetCategoryName: assetCategories.name,
            assetSubcategoryName: assetSubcategories.name,
            employeeFirstName: employees.firstName,
            employeeLastName: employees.lastName,
            contractorName: companies.name,
          })
          .from(jobAssignments)
          .leftJoin(assets, eq(jobAssignments.assetId, assets.id))
          .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
          .leftJoin(assetSubcategories, eq(assets.subcategoryId, assetSubcategories.id))
          .leftJoin(employees, eq(jobAssignments.employeeId, employees.id))
          .leftJoin(companies, eq(jobAssignments.contractorCompanyId, companies.id))
          .where(
            and(
              inArray(jobAssignments.jobId, jobIds),
              ne(jobAssignments.status, "cancelled"),
            ),
          ),

        ctx.tenantDb
          .select({
            id: jobAssetRequirements.id,
            jobId: jobAssetRequirements.jobId,
            assetCategoryId: jobAssetRequirements.assetCategoryId,
            assetSubcategoryId: jobAssetRequirements.assetSubcategoryId,
            quantity: jobAssetRequirements.quantity,
            categoryName: assetCategories.name,
            subcategoryName: assetSubcategories.name,
          })
          .from(jobAssetRequirements)
          .leftJoin(assetCategories, eq(jobAssetRequirements.assetCategoryId, assetCategories.id))
          .leftJoin(assetSubcategories, eq(jobAssetRequirements.assetSubcategoryId, assetSubcategories.id))
          .where(inArray(jobAssetRequirements.jobId, jobIds)),
      ]);

      // Group sub-resources by jobId
      const locationsByJob = new Map<string, SchedulingJobLocation[]>();
      for (const loc of locationRows) {
        const list = locationsByJob.get(loc.jobId) ?? [];
        list.push({
          id: loc.id,
          locationType: loc.locationType,
          addressStreet: loc.addressStreet,
          addressSuburb: loc.addressSuburb,
          sequence: loc.sequence,
        });
        locationsByJob.set(loc.jobId, list);
      }

      const assignmentsByJob = new Map<string, SchedulingJobAssignment[]>();
      for (const a of assignmentRows) {
        const list = assignmentsByJob.get(a.jobId) ?? [];
        list.push({
          id: a.id,
          assignmentType: a.assignmentType,
          assetId: a.assetId,
          employeeId: a.employeeId,
          contractorCompanyId: a.contractorCompanyId,
          status: a.status,
          plannedStart: a.plannedStart?.toISOString() ?? null,
          plannedEnd: a.plannedEnd?.toISOString() ?? null,
          assetRegistration: a.assetRegistration,
          assetMake: a.assetMake,
          assetModel: a.assetModel,
          assetNumber: a.assetNumber,
          assetCategoryName: a.assetCategoryName,
          assetSubcategoryName: a.assetSubcategoryName,
          employeeName:
            a.employeeFirstName && a.employeeLastName
              ? `${a.employeeFirstName} ${a.employeeLastName}`
              : null,
          contractorName: a.contractorName,
        });
        assignmentsByJob.set(a.jobId, list);
      }

      const requirementsByJob = new Map<string, SchedulingJobRequirement[]>();
      for (const r of requirementRows) {
        const list = requirementsByJob.get(r.jobId) ?? [];
        list.push({
          id: r.id,
          assetCategoryId: r.assetCategoryId,
          assetSubcategoryId: r.assetSubcategoryId,
          categoryName: r.categoryName,
          subcategoryName: r.subcategoryName,
          quantity: r.quantity,
        });
        requirementsByJob.set(r.jobId, list);
      }

      // Build scheduling jobs
      let schedulingJobs: SchedulingJob[] = jobRows.map((row) => {
        const jobAssigns = assignmentsByJob.get(row.job.id) ?? [];
        return {
          id: row.job.id,
          jobNumber: row.job.jobNumber,
          name: row.job.name,
          status: row.job.status,
          priority: row.job.priority,
          scheduledStart: row.job.scheduledStart?.toISOString() ?? null,
          scheduledEnd: row.job.scheduledEnd?.toISOString() ?? null,
          isMultiDay: row.job.isMultiDay,
          poNumber: row.job.poNumber,
          minimumChargeHours: row.job.minimumChargeHours,
          internalNotes: row.job.internalNotes,
          jobTypeName: row.jobTypeName,
          jobTypeCode: row.jobTypeCode,
          customerName: row.customerName,
          customerId: row.job.customerId,
          projectName: row.projectName,
          projectId: row.job.projectId,
          projectNumber: row.projectNumber,
          locations: locationsByJob.get(row.job.id) ?? [],
          assignments: jobAssigns,
          assetRequirements: requirementsByJob.get(row.job.id) ?? [],
          assignmentCount: jobAssigns.length,
        };
      });

      // Apply search filter (across all relevant fields)
      if (query.search) {
        const term = query.search.toLowerCase();
        schedulingJobs = schedulingJobs.filter((job) => {
          const searchable = [
            job.jobNumber,
            job.name,
            job.customerName,
            job.projectName,
            job.poNumber,
            job.internalNotes,
            ...job.locations.map((l) => `${l.addressStreet ?? ""} ${l.addressSuburb ?? ""}`),
            ...job.assignments.map((a) =>
              [a.assetRegistration, a.assetMake, a.assetModel, a.employeeName, a.contractorName]
                .filter(Boolean)
                .join(" "),
            ),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return searchable.includes(term);
        });
      }

      // Apply allocation status filter
      if (query.allocationStatus === "allocated") {
        schedulingJobs = schedulingJobs.filter((j) => j.assignmentCount > 0);
      } else if (query.allocationStatus === "unallocated") {
        schedulingJobs = schedulingJobs.filter((j) => j.assignmentCount === 0);
      }

      // Summary stats
      const total = schedulingJobs.length;
      const allocated = schedulingJobs.filter((j) => j.assignmentCount > 0).length;
      const unallocated = total - allocated;
      const assignmentCount = schedulingJobs.reduce((sum, j) => sum + j.assignmentCount, 0);

      return {
        success: true,
        data: {
          date: query.date,
          jobs: schedulingJobs,
          summary: { total, allocated, unallocated, assignmentCount },
        },
      };
    },
  );

  /**
   * GET /api/v1/scheduling/conflicts
   * Returns conflict information for resources on a given date.
   * Shows which assets/drivers are assigned to multiple jobs.
   */
  app.get(
    "/conflicts",
    { preHandler: requirePermission("view:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = conflictsQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { date, assetId, employeeId } = parsed.data;
      const dayStart = `${date}T00:00:00.000Z`;
      const dayEnd = `${date}T23:59:59.999Z`;

      // Find all active assignments for jobs on this date
      const assignmentJoinRows = await ctx.tenantDb
        .select({
          assignmentId: jobAssignments.id,
          jobId: jobAssignments.jobId,
          assignmentType: jobAssignments.assignmentType,
          assetId: jobAssignments.assetId,
          employeeId: jobAssignments.employeeId,
          status: jobAssignments.status,
          plannedStart: jobAssignments.plannedStart,
          plannedEnd: jobAssignments.plannedEnd,
          jobNumber: jobs.jobNumber,
          jobName: jobs.name,
          jobScheduledStart: jobs.scheduledStart,
          jobScheduledEnd: jobs.scheduledEnd,
          customerName: companies.name,
          assetRegistration: assets.registrationNumber,
          assetMake: assets.make,
          assetModel: assets.model,
          assetFleetNumber: assets.assetNumber,
          employeeFirstName: employees.firstName,
          employeeLastName: employees.lastName,
        })
        .from(jobAssignments)
        .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
        .leftJoin(companies, eq(jobs.customerId, companies.id))
        .leftJoin(assets, eq(jobAssignments.assetId, assets.id))
        .leftJoin(employees, eq(jobAssignments.employeeId, employees.id))
        .where(
          and(
            isNull(jobs.deletedAt),
            ne(jobs.status, "cancelled"),
            ne(jobs.status, "declined"),
            ne(jobAssignments.status, "cancelled"),
            // Job overlaps with this date
            or(
              and(
                gte(jobs.scheduledStart, sql`${dayStart}::timestamptz`),
                lte(jobs.scheduledStart, sql`${dayEnd}::timestamptz`),
              ),
              and(
                lte(jobs.scheduledStart, sql`${dayEnd}::timestamptz`),
                gte(jobs.scheduledEnd, sql`${dayStart}::timestamptz`),
              ),
            ) ?? sql`TRUE`,
            // Optionally filter to specific resource
            ...(assetId ? [eq(jobAssignments.assetId, assetId)] : []),
            ...(employeeId ? [eq(jobAssignments.employeeId, employeeId)] : []),
          ),
        );

      // Group by resource to find multi-assignment conflicts
      const assetMap = new Map<string, ConflictEntry>();
      const driverMap = new Map<string, ConflictEntry>();

      for (const row of assignmentJoinRows) {
        const jobInfo = {
          jobId: row.jobId,
          jobNumber: row.jobNumber,
          jobName: row.jobName,
          customerName: row.customerName,
          plannedStart: row.plannedStart?.toISOString() ?? null,
          plannedEnd: row.plannedEnd?.toISOString() ?? null,
          scheduledStart: row.jobScheduledStart?.toISOString() ?? null,
          scheduledEnd: row.jobScheduledEnd?.toISOString() ?? null,
        };

        if (row.assignmentType === "asset" && row.assetId) {
          const existing = assetMap.get(row.assetId);
          if (existing) {
            existing.jobs.push(jobInfo);
          } else {
            const label = [row.assetRegistration, row.assetMake, row.assetModel]
              .filter(Boolean)
              .join(" ")
              || row.assetFleetNumber
              || row.assetId;
            assetMap.set(row.assetId, {
              resourceType: "asset",
              resourceId: row.assetId,
              resourceLabel: label,
              jobs: [jobInfo],
            });
          }
        }

        if (row.assignmentType === "driver" && row.employeeId) {
          const existing = driverMap.get(row.employeeId);
          if (existing) {
            existing.jobs.push(jobInfo);
          } else {
            const label =
              row.employeeFirstName && row.employeeLastName
                ? `${row.employeeFirstName} ${row.employeeLastName}`
                : row.employeeId;
            driverMap.set(row.employeeId, {
              resourceType: "driver",
              resourceId: row.employeeId,
              resourceLabel: label,
              jobs: [jobInfo],
            });
          }
        }
      }

      // Only return resources with 2+ assignments (actual conflicts)
      const conflicts: ConflictEntry[] = [
        ...[...assetMap.values()].filter((c) => c.jobs.length > 1),
        ...[...driverMap.values()].filter((c) => c.jobs.length > 1),
      ];

      return {
        success: true,
        data: { date, conflicts },
      };
    },
  );

  /**
   * GET /api/v1/scheduling/resources
   * Returns available assets and drivers for allocation on a given date.
   * Includes current allocation count for the day.
   */
  app.get(
    "/resources",
    { preHandler: requirePermission("view:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const resourceQuerySchema = z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
        type: z.enum(["assets", "drivers"]).optional(),
      });

      const parsed = resourceQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { date, type } = parsed.data;
      const dayStart = `${date}T00:00:00.000Z`;
      const dayEnd = `${date}T23:59:59.999Z`;

      const result: {
        assets?: Array<{
          id: string;
          registrationNumber: string | null;
          fleetNumber: string | null;
          make: string | null;
          model: string | null;
          status: string;
          categoryName: string | null;
          subcategoryName: string | null;
          allocationCount: number;
        }>;
        drivers?: Array<{
          id: string;
          firstName: string;
          lastName: string;
          status: string;
          allocationCount: number;
        }>;
      } = {};

      // Get asset allocation counts for this date
      if (!type || type === "assets") {
        const allAssets = await ctx.tenantDb
          .select({
            id: assets.id,
            registrationNumber: assets.registrationNumber,
            fleetNumber: assets.assetNumber,
            make: assets.make,
            model: assets.model,
            status: assets.status,
            categoryName: assetCategories.name,
            subcategoryName: assetSubcategories.name,
          })
          .from(assets)
          .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
          .leftJoin(assetSubcategories, eq(assets.subcategoryId, assetSubcategories.id))
          .where(
            and(
              isNull(assets.deletedAt),
              inArray(assets.status, ["available", "in_use"]),
            ),
          )
          .orderBy(assets.registrationNumber);

        // Count assignments per asset on this date
        const assetAssignmentCounts = await ctx.tenantDb
          .select({
            assetId: jobAssignments.assetId,
            count: sql<number>`count(*)::int`,
          })
          .from(jobAssignments)
          .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
          .where(
            and(
              eq(jobAssignments.assignmentType, "asset"),
              ne(jobAssignments.status, "cancelled"),
              isNull(jobs.deletedAt),
              ne(jobs.status, "cancelled"),
              or(
                and(
                  gte(jobs.scheduledStart, sql`${dayStart}::timestamptz`),
                  lte(jobs.scheduledStart, sql`${dayEnd}::timestamptz`),
                ),
                and(
                  lte(jobs.scheduledStart, sql`${dayEnd}::timestamptz`),
                  gte(jobs.scheduledEnd, sql`${dayStart}::timestamptz`),
                ),
              ) ?? sql`TRUE`,
            ),
          )
          .groupBy(jobAssignments.assetId);

        const countMap = new Map(
          assetAssignmentCounts.map((r) => [r.assetId, r.count]),
        );

        result.assets = allAssets.map((a) => ({
          ...a,
          allocationCount: countMap.get(a.id) ?? 0,
        }));
      }

      if (!type || type === "drivers") {
        const allDrivers = await ctx.tenantDb
          .select({
            id: employees.id,
            firstName: employees.firstName,
            lastName: employees.lastName,
            status: employees.status,
          })
          .from(employees)
          .where(
            and(
              isNull(employees.deletedAt),
              eq(employees.isDriver, true),
              eq(employees.status, "active"),
            ),
          )
          .orderBy(employees.lastName, employees.firstName);

        const driverAssignmentCounts = await ctx.tenantDb
          .select({
            employeeId: jobAssignments.employeeId,
            count: sql<number>`count(*)::int`,
          })
          .from(jobAssignments)
          .innerJoin(jobs, eq(jobAssignments.jobId, jobs.id))
          .where(
            and(
              eq(jobAssignments.assignmentType, "driver"),
              ne(jobAssignments.status, "cancelled"),
              isNull(jobs.deletedAt),
              ne(jobs.status, "cancelled"),
              or(
                and(
                  gte(jobs.scheduledStart, sql`${dayStart}::timestamptz`),
                  lte(jobs.scheduledStart, sql`${dayEnd}::timestamptz`),
                ),
                and(
                  lte(jobs.scheduledStart, sql`${dayEnd}::timestamptz`),
                  gte(jobs.scheduledEnd, sql`${dayStart}::timestamptz`),
                ),
              ) ?? sql`TRUE`,
            ),
          )
          .groupBy(jobAssignments.employeeId);

        const countMap = new Map(
          driverAssignmentCounts.map((r) => [r.employeeId, r.count]),
        );

        result.drivers = allDrivers.map((d) => ({
          ...d,
          allocationCount: countMap.get(d.id) ?? 0,
        }));
      }

      return { success: true, data: result };
    },
  );
}
