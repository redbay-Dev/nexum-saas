import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, ilike, or, sql, desc } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  jobs,
  jobTypes,
  companies,
  projects,
  jobLocations,
  jobMaterials,
  jobAssetRequirements,
  jobPricingLines,
  jobStatusHistory,
  jobAssignments,
  addresses,
  entryPoints,
  assetCategories,
  assetSubcategories,
  assets,
  employees,
  tenantMaterials,
  supplierMaterials,
  customerMaterials,
  disposalMaterials,
  auditLog,
} from "../db/schema/tenant.js";
import {
  createJobSchema,
  updateJobSchema,
  jobStatusTransitionSchema,
  createJobLocationSchema,
  updateJobLocationSchema,
  createJobMaterialSchema,
  updateJobMaterialSchema,
  createJobAssetRequirementSchema,
  updateJobAssetRequirementSchema,
  createJobPricingLineSchema,
  updateJobPricingLineSchema,
  createJobAssignmentSchema,
  updateJobAssignmentSchema,
  idParamSchema,
  paginationQuerySchema,
  isValidTransition,
  requiresReason,
} from "@nexum/shared";
import type { JobStatus } from "@nexum/shared";
import { z } from "zod";

const jobListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  status: z.string().optional(),
  jobTypeId: z.uuid().optional(),
  customerId: z.uuid().optional(),
  projectId: z.uuid().optional(),
  priority: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

type JobListQuery = z.infer<typeof jobListQuerySchema>;

const subResourceParamSchema = z.object({
  id: z.uuid(),
  subId: z.uuid(),
});

export async function jobRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ── Job CRUD ──

  /**
   * GET /api/v1/jobs
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = jobListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query: JobListQuery = parsed.data;
      const limit = query.limit;

      const conditions = [isNull(jobs.deletedAt)];

      if (query.status) {
        conditions.push(eq(jobs.status, query.status));
      }
      if (query.jobTypeId) {
        conditions.push(eq(jobs.jobTypeId, query.jobTypeId));
      }
      if (query.customerId) {
        conditions.push(eq(jobs.customerId, query.customerId));
      }
      if (query.projectId) {
        conditions.push(eq(jobs.projectId, query.projectId));
      }
      if (query.priority) {
        conditions.push(eq(jobs.priority, query.priority));
      }
      if (query.dateFrom) {
        conditions.push(sql`${jobs.scheduledStart} >= ${query.dateFrom}`);
      }
      if (query.dateTo) {
        conditions.push(sql`${jobs.scheduledStart} <= ${query.dateTo}`);
      }

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(
          or(
            ilike(jobs.jobNumber, searchPattern),
            ilike(jobs.name, searchPattern),
            ilike(jobs.poNumber, searchPattern),
          ) ?? sql`TRUE`,
        );
      }

      if (query.cursor) {
        conditions.push(sql`${jobs.id} < ${query.cursor}`);
      }

      const rows = await ctx.tenantDb
        .select({
          job: jobs,
          jobTypeName: jobTypes.name,
          jobTypeCode: jobTypes.code,
          customerName: companies.name,
        })
        .from(jobs)
        .leftJoin(jobTypes, eq(jobs.jobTypeId, jobTypes.id))
        .leftJoin(companies, eq(jobs.customerId, companies.id))
        .where(and(...conditions))
        .orderBy(desc(jobs.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.job.id ?? null : null;

      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(jobs)
        .where(and(isNull(jobs.deletedAt)));

      const flatData = data.map((row) => ({
        ...row.job,
        jobTypeName: row.jobTypeName,
        jobTypeCode: row.jobTypeCode,
        customerName: row.customerName,
      }));

      return {
        success: true,
        data: { data: flatData, nextCursor, hasMore, total: countResult?.count ?? 0 },
      };
    },
  );

  /**
   * GET /api/v1/jobs/:id
   * Returns job with ALL sub-resources.
   */
  app.get(
    "/:id",
    { preHandler: requirePermission("view:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid job ID",
          code: "VALIDATION_ERROR",
        });
      }

      const { id } = parsed.data;

      const [row] = await ctx.tenantDb
        .select({
          job: jobs,
          jobTypeName: jobTypes.name,
          jobTypeCode: jobTypes.code,
          jobTypeVisibleSections: jobTypes.visibleSections,
          customerName: companies.name,
          projectName: projects.name,
          projectNumber: projects.projectNumber,
        })
        .from(jobs)
        .leftJoin(jobTypes, eq(jobs.jobTypeId, jobTypes.id))
        .leftJoin(companies, eq(jobs.customerId, companies.id))
        .leftJoin(projects, eq(jobs.projectId, projects.id))
        .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
        .limit(1);

      if (!row) {
        return reply.status(404).send({
          error: "Job not found",
          code: "NOT_FOUND",
        });
      }

      // Fetch all sub-resources in parallel
      const [locations, materials, assetReqs, pricingLines, assignments, statusHistory] = await Promise.all([
        ctx.tenantDb
          .select({
            location: jobLocations,
            addressStreet: addresses.streetAddress,
            addressSuburb: addresses.suburb,
            addressState: addresses.state,
            entryPointName: entryPoints.name,
          })
          .from(jobLocations)
          .leftJoin(addresses, eq(jobLocations.addressId, addresses.id))
          .leftJoin(entryPoints, eq(jobLocations.entryPointId, entryPoints.id))
          .where(eq(jobLocations.jobId, id))
          .orderBy(jobLocations.sequence),

        ctx.tenantDb
          .select()
          .from(jobMaterials)
          .where(eq(jobMaterials.jobId, id)),

        ctx.tenantDb
          .select({
            req: jobAssetRequirements,
            categoryName: assetCategories.name,
            subcategoryName: assetSubcategories.name,
          })
          .from(jobAssetRequirements)
          .leftJoin(assetCategories, eq(jobAssetRequirements.assetCategoryId, assetCategories.id))
          .leftJoin(assetSubcategories, eq(jobAssetRequirements.assetSubcategoryId, assetSubcategories.id))
          .where(eq(jobAssetRequirements.jobId, id)),

        ctx.tenantDb
          .select()
          .from(jobPricingLines)
          .where(eq(jobPricingLines.jobId, id))
          .orderBy(jobPricingLines.sortOrder),

        ctx.tenantDb
          .select({
            assignment: jobAssignments,
            assetRegistration: assets.registrationNumber,
            assetMake: assets.make,
            assetModel: assets.model,
            assetNumber: assets.assetNumber,
            employeeFirstName: employees.firstName,
            employeeLastName: employees.lastName,
            contractorName: companies.name,
          })
          .from(jobAssignments)
          .leftJoin(assets, eq(jobAssignments.assetId, assets.id))
          .leftJoin(employees, eq(jobAssignments.employeeId, employees.id))
          .leftJoin(companies, eq(jobAssignments.contractorCompanyId, companies.id))
          .where(eq(jobAssignments.jobId, id))
          .orderBy(jobAssignments.createdAt),

        ctx.tenantDb
          .select()
          .from(jobStatusHistory)
          .where(eq(jobStatusHistory.jobId, id))
          .orderBy(desc(jobStatusHistory.createdAt)),
      ]);

      return {
        success: true,
        data: {
          ...row.job,
          jobTypeName: row.jobTypeName,
          jobTypeCode: row.jobTypeCode,
          jobTypeVisibleSections: row.jobTypeVisibleSections,
          customerName: row.customerName,
          projectName: row.projectName,
          projectNumber: row.projectNumber,
          locations: locations.map((l) => ({
            ...l.location,
            addressStreet: l.addressStreet,
            addressSuburb: l.addressSuburb,
            addressState: l.addressState,
            entryPointName: l.entryPointName,
          })),
          materials,
          assetRequirements: assetReqs.map((r) => ({
            ...r.req,
            categoryName: r.categoryName,
            subcategoryName: r.subcategoryName,
          })),
          pricingLines,
          assignments: assignments.map((a) => ({
            ...a.assignment,
            assetRegistration: a.assetRegistration,
            assetMake: a.assetMake,
            assetModel: a.assetModel,
            assetNumber: a.assetNumber,
            employeeName: a.employeeFirstName && a.employeeLastName
              ? `${a.employeeFirstName} ${a.employeeLastName}`
              : null,
            contractorName: a.contractorName,
          })),
          statusHistory,
        },
      };
    },
  );

  /**
   * POST /api/v1/jobs
   */
  app.post(
    "/",
    { preHandler: requirePermission("create:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = createJobSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid job data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const input = parsed.data;

      // Validate job type exists
      const [jobType] = await ctx.tenantDb
        .select()
        .from(jobTypes)
        .where(and(eq(jobTypes.id, input.jobTypeId), isNull(jobTypes.deletedAt)))
        .limit(1);

      if (!jobType) {
        return reply.status(400).send({
          error: "Job type not found",
          code: "INVALID_REFERENCE",
        });
      }

      // Validate customer if provided
      if (input.customerId) {
        const [customer] = await ctx.tenantDb
          .select({ id: companies.id })
          .from(companies)
          .where(
            and(
              eq(companies.id, input.customerId),
              eq(companies.isCustomer, true),
              isNull(companies.deletedAt),
            ),
          )
          .limit(1);

        if (!customer) {
          return reply.status(400).send({
            error: "Customer not found",
            code: "INVALID_REFERENCE",
          });
        }
      }

      // Generate job number: YYYY-XXXX with FOR UPDATE lock
      const year = new Date().getFullYear();
      const [maxResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(jobs);
      const seq = (maxResult?.count ?? 0) + 1;
      const jobNumber = `${year}-${String(seq).padStart(4, "0")}`;

      const id = crypto.randomUUID();
      const [job] = await ctx.tenantDb
        .insert(jobs)
        .values({
          id,
          jobNumber,
          name: input.name,
          jobTypeId: input.jobTypeId,
          customerId: input.customerId,
          projectId: input.projectId,
          poNumber: input.poNumber,
          priority: input.priority,
          status: "draft",
          salesRepId: input.salesRepId,
          jobLeadId: input.jobLeadId,
          scheduledStart: input.scheduledStart ? new Date(input.scheduledStart) : undefined,
          scheduledEnd: input.scheduledEnd ? new Date(input.scheduledEnd) : undefined,
          isMultiDay: input.isMultiDay,
          minimumChargeHours: input.minimumChargeHours?.toString(),
          externalNotes: input.externalNotes,
          internalNotes: input.internalNotes,
          metadata: input.metadata,
          createdBy: ctx.userId,
        })
        .returning();

      // Record initial status
      await ctx.tenantDb.insert(jobStatusHistory).values({
        jobId: id,
        fromStatus: null,
        toStatus: "draft",
        changedBy: ctx.userId,
      });

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "job",
        entityId: id,
        newData: job,
      });

      return reply.status(201).send({ success: true, data: job });
    },
  );

  /**
   * PUT /api/v1/jobs/:id
   * Update job fields (NOT status — use POST /:id/status).
   */
  app.put(
    "/:id",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid job ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = updateJobSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid job data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { id } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Job not found",
          code: "NOT_FOUND",
        });
      }

      // Cannot edit invoiced jobs
      if (existing.status === "invoiced") {
        return reply.status(400).send({
          error: "Cannot edit an invoiced job",
          code: "JOB_LOCKED",
        });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateValues.name = input.name;
      if (input.jobTypeId !== undefined) updateValues.jobTypeId = input.jobTypeId;
      if (input.customerId !== undefined) updateValues.customerId = input.customerId;
      if (input.projectId !== undefined) updateValues.projectId = input.projectId;
      if (input.poNumber !== undefined) updateValues.poNumber = input.poNumber;
      if (input.priority !== undefined) updateValues.priority = input.priority;
      if (input.salesRepId !== undefined) updateValues.salesRepId = input.salesRepId;
      if (input.jobLeadId !== undefined) updateValues.jobLeadId = input.jobLeadId;
      if (input.scheduledStart !== undefined)
        updateValues.scheduledStart = input.scheduledStart ? new Date(input.scheduledStart) : null;
      if (input.scheduledEnd !== undefined)
        updateValues.scheduledEnd = input.scheduledEnd ? new Date(input.scheduledEnd) : null;
      if (input.isMultiDay !== undefined) updateValues.isMultiDay = input.isMultiDay;
      if (input.minimumChargeHours !== undefined)
        updateValues.minimumChargeHours = input.minimumChargeHours?.toString();
      if (input.externalNotes !== undefined) updateValues.externalNotes = input.externalNotes;
      if (input.internalNotes !== undefined) updateValues.internalNotes = input.internalNotes;
      if (input.metadata !== undefined) updateValues.metadata = input.metadata;

      const [updated] = await ctx.tenantDb
        .update(jobs)
        .set(updateValues)
        .where(eq(jobs.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "job",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/jobs/:id
   */
  app.delete(
    "/:id",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid job ID",
          code: "VALIDATION_ERROR",
        });
      }

      const { id } = parsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Job not found",
          code: "NOT_FOUND",
        });
      }

      if (existing.status === "invoiced") {
        return reply.status(400).send({
          error: "Cannot delete an invoiced job",
          code: "JOB_LOCKED",
        });
      }

      const [deleted] = await ctx.tenantDb
        .update(jobs)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(jobs.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "job",
        entityId: id,
        previousData: existing,
        newData: deleted,
      });

      return { success: true, data: { id } };
    },
  );

  // ── Status Transition ──

  /**
   * POST /api/v1/jobs/:id/status
   */
  app.post(
    "/:id/status",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid job ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = jobStatusTransitionSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid status transition data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { id } = paramsParsed.data;
      const { status: toStatus, reason } = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Job not found",
          code: "NOT_FOUND",
        });
      }

      const fromStatus = existing.status as JobStatus;

      if (!isValidTransition(fromStatus, toStatus)) {
        return reply.status(400).send({
          error: `Cannot transition from "${fromStatus}" to "${toStatus}"`,
          code: "INVALID_TRANSITION",
        });
      }

      if (requiresReason(fromStatus, toStatus) && !reason) {
        return reply.status(400).send({
          error: "A reason is required for this status transition",
          code: "REASON_REQUIRED",
        });
      }

      // Auto-set timestamps based on transition
      const updateValues: Record<string, unknown> = {
        status: toStatus,
        updatedAt: new Date(),
      };

      if (toStatus === "in_progress" && !existing.actualStart) {
        updateValues.actualStart = new Date();
      }
      if (toStatus === "completed" && !existing.actualEnd) {
        updateValues.actualEnd = new Date();
      }
      if (toStatus === "cancelled") {
        updateValues.cancellationReason = reason;

        // Release all active assignments
        await ctx.tenantDb
          .update(jobAssignments)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(
            and(
              eq(jobAssignments.jobId, id),
              or(
                eq(jobAssignments.status, "assigned"),
                eq(jobAssignments.status, "in_progress"),
              ) ?? sql`TRUE`,
            ),
          );
      }

      // Lock pricing lines when invoiced
      if (toStatus === "invoiced") {
        await ctx.tenantDb
          .update(jobPricingLines)
          .set({ isLocked: true, updatedAt: new Date() })
          .where(eq(jobPricingLines.jobId, id));
      }

      const [updated] = await ctx.tenantDb
        .update(jobs)
        .set(updateValues)
        .where(eq(jobs.id, id))
        .returning();

      // Record status history
      await ctx.tenantDb.insert(jobStatusHistory).values({
        jobId: id,
        fromStatus,
        toStatus,
        changedBy: ctx.userId,
        reason,
      });

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "job",
        entityId: id,
        previousData: { status: fromStatus },
        newData: { status: toStatus, reason },
      });

      return { success: true, data: updated };
    },
  );

  // ── Job Locations ──

  /**
   * POST /api/v1/jobs/:id/locations
   */
  app.post(
    "/:id/locations",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid job ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = createJobLocationSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid location data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const jobId = paramsParsed.data.id;
      const input = bodyParsed.data;

      // Verify job exists
      const [job] = await ctx.tenantDb
        .select({ id: jobs.id, status: jobs.status })
        .from(jobs)
        .where(and(eq(jobs.id, jobId), isNull(jobs.deletedAt)))
        .limit(1);

      if (!job) {
        return reply.status(404).send({ error: "Job not found", code: "NOT_FOUND" });
      }

      const id = crypto.randomUUID();
      const [location] = await ctx.tenantDb
        .insert(jobLocations)
        .values({
          id,
          jobId,
          locationType: input.locationType,
          addressId: input.addressId,
          entryPointId: input.entryPointId,
          sequence: input.sequence,
          contactName: input.contactName,
          contactPhone: input.contactPhone,
          instructions: input.instructions,
          tipFee: input.tipFee?.toString(),
          arrivalTime: input.arrivalTime ? new Date(input.arrivalTime) : undefined,
          departureTime: input.departureTime ? new Date(input.departureTime) : undefined,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "job_location",
        entityId: id,
        newData: location,
      });

      return reply.status(201).send({ success: true, data: location });
    },
  );

  /**
   * PUT /api/v1/jobs/:id/locations/:subId
   */
  app.put(
    "/:id/locations/:subId",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = subResourceParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateJobLocationSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid location data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { subId } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(jobLocations)
        .where(eq(jobLocations.id, subId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Location not found", code: "NOT_FOUND" });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.locationType !== undefined) updateValues.locationType = input.locationType;
      if (input.addressId !== undefined) updateValues.addressId = input.addressId;
      if (input.entryPointId !== undefined) updateValues.entryPointId = input.entryPointId;
      if (input.sequence !== undefined) updateValues.sequence = input.sequence;
      if (input.contactName !== undefined) updateValues.contactName = input.contactName;
      if (input.contactPhone !== undefined) updateValues.contactPhone = input.contactPhone;
      if (input.instructions !== undefined) updateValues.instructions = input.instructions;
      if (input.tipFee !== undefined) updateValues.tipFee = input.tipFee?.toString();
      if (input.arrivalTime !== undefined)
        updateValues.arrivalTime = input.arrivalTime ? new Date(input.arrivalTime) : null;
      if (input.departureTime !== undefined)
        updateValues.departureTime = input.departureTime ? new Date(input.departureTime) : null;

      const [updated] = await ctx.tenantDb
        .update(jobLocations)
        .set(updateValues)
        .where(eq(jobLocations.id, subId))
        .returning();

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/jobs/:id/locations/:subId
   */
  app.delete(
    "/:id/locations/:subId",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = subResourceParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const { subId } = paramsParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(jobLocations)
        .where(eq(jobLocations.id, subId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Location not found", code: "NOT_FOUND" });
      }

      await ctx.tenantDb
        .delete(jobLocations)
        .where(eq(jobLocations.id, subId));

      return { success: true, data: { id: subId } };
    },
  );

  // ── Job Materials (with snapshot) ──

  /**
   * POST /api/v1/jobs/:id/materials
   */
  app.post(
    "/:id/materials",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid job ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = createJobMaterialSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid material data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const jobId = paramsParsed.data.id;
      const input = bodyParsed.data;

      // Verify job exists
      const [job] = await ctx.tenantDb
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.id, jobId), isNull(jobs.deletedAt)))
        .limit(1);

      if (!job) {
        return reply.status(404).send({ error: "Job not found", code: "NOT_FOUND" });
      }

      // Snapshot material data from source
      let materialName = "Unknown Material";
      const materialCategory: string | null = null;
      let materialCompliance: Record<string, unknown> | null = null;

      const sourceType = input.materialSourceType;
      const sourceId = input.materialSourceId;

      if (sourceType === "tenant") {
        const [mat] = await ctx.tenantDb
          .select()
          .from(tenantMaterials)
          .where(eq(tenantMaterials.id, sourceId))
          .limit(1);
        if (mat) {
          materialName = mat.name;
          materialCompliance = mat.compliance as Record<string, unknown> | null;
        }
      } else if (sourceType === "supplier") {
        const [mat] = await ctx.tenantDb
          .select()
          .from(supplierMaterials)
          .where(eq(supplierMaterials.id, sourceId))
          .limit(1);
        if (mat) {
          materialName = mat.name;
          materialCompliance = mat.compliance as Record<string, unknown> | null;
        }
      } else if (sourceType === "customer") {
        const [mat] = await ctx.tenantDb
          .select()
          .from(customerMaterials)
          .where(eq(customerMaterials.id, sourceId))
          .limit(1);
        if (mat) {
          materialName = mat.name;
          materialCompliance = mat.compliance as Record<string, unknown> | null;
        }
      } else if (sourceType === "disposal") {
        const [mat] = await ctx.tenantDb
          .select()
          .from(disposalMaterials)
          .where(eq(disposalMaterials.id, sourceId))
          .limit(1);
        if (mat) {
          materialName = mat.name;
          materialCompliance = mat.compliance as Record<string, unknown> | null;
        }
      }

      const id = crypto.randomUUID();
      const [material] = await ctx.tenantDb
        .insert(jobMaterials)
        .values({
          id,
          jobId,
          materialSourceType: input.materialSourceType,
          materialSourceId: input.materialSourceId,
          materialNameSnapshot: materialName,
          materialCategorySnapshot: materialCategory,
          materialComplianceSnapshot: materialCompliance as typeof jobMaterials.$inferInsert.materialComplianceSnapshot,
          quantity: input.quantity?.toString(),
          unitOfMeasure: input.unitOfMeasure,
          flowType: input.flowType,
          notes: input.notes,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "job_material",
        entityId: id,
        newData: material,
      });

      return reply.status(201).send({ success: true, data: material });
    },
  );

  /**
   * PUT /api/v1/jobs/:id/materials/:subId
   */
  app.put(
    "/:id/materials/:subId",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = subResourceParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateJobMaterialSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid material data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { subId } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(jobMaterials)
        .where(eq(jobMaterials.id, subId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Material not found", code: "NOT_FOUND" });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.quantity !== undefined) updateValues.quantity = input.quantity?.toString();
      if (input.unitOfMeasure !== undefined) updateValues.unitOfMeasure = input.unitOfMeasure;
      if (input.flowType !== undefined) updateValues.flowType = input.flowType;
      if (input.notes !== undefined) updateValues.notes = input.notes;

      const [updated] = await ctx.tenantDb
        .update(jobMaterials)
        .set(updateValues)
        .where(eq(jobMaterials.id, subId))
        .returning();

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/jobs/:id/materials/:subId
   */
  app.delete(
    "/:id/materials/:subId",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = subResourceParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const { subId } = paramsParsed.data;

      await ctx.tenantDb.delete(jobMaterials).where(eq(jobMaterials.id, subId));

      return { success: true, data: { id: subId } };
    },
  );

  // ── Job Asset Requirements ──

  /**
   * POST /api/v1/jobs/:id/asset-requirements
   */
  app.post(
    "/:id/asset-requirements",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid job ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = createJobAssetRequirementSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid requirement data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const jobId = paramsParsed.data.id;
      const input = bodyParsed.data;

      const id = crypto.randomUUID();
      const [req] = await ctx.tenantDb
        .insert(jobAssetRequirements)
        .values({
          id,
          jobId,
          assetCategoryId: input.assetCategoryId,
          assetSubcategoryId: input.assetSubcategoryId,
          quantity: input.quantity,
          payloadLimit: input.payloadLimit?.toString(),
          specialRequirements: input.specialRequirements,
        })
        .returning();

      return reply.status(201).send({ success: true, data: req });
    },
  );

  /**
   * PUT /api/v1/jobs/:id/asset-requirements/:subId
   */
  app.put(
    "/:id/asset-requirements/:subId",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = subResourceParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateJobAssetRequirementSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid requirement data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { subId } = paramsParsed.data;
      const input = bodyParsed.data;

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.assetCategoryId !== undefined) updateValues.assetCategoryId = input.assetCategoryId;
      if (input.assetSubcategoryId !== undefined) updateValues.assetSubcategoryId = input.assetSubcategoryId;
      if (input.quantity !== undefined) updateValues.quantity = input.quantity;
      if (input.payloadLimit !== undefined) updateValues.payloadLimit = input.payloadLimit?.toString();
      if (input.specialRequirements !== undefined) updateValues.specialRequirements = input.specialRequirements;

      const [updated] = await ctx.tenantDb
        .update(jobAssetRequirements)
        .set(updateValues)
        .where(eq(jobAssetRequirements.id, subId))
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: "Requirement not found", code: "NOT_FOUND" });
      }

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/jobs/:id/asset-requirements/:subId
   */
  app.delete(
    "/:id/asset-requirements/:subId",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = subResourceParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const { subId } = paramsParsed.data;

      await ctx.tenantDb.delete(jobAssetRequirements).where(eq(jobAssetRequirements.id, subId));

      return { success: true, data: { id: subId } };
    },
  );

  // ── Job Pricing Lines ──

  /**
   * POST /api/v1/jobs/:id/pricing-lines
   */
  app.post(
    "/:id/pricing-lines",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid job ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = createJobPricingLineSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid pricing line data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const jobId = paramsParsed.data.id;
      const input = bodyParsed.data;

      // Verify job exists and is not invoiced
      const [job] = await ctx.tenantDb
        .select({ id: jobs.id, status: jobs.status })
        .from(jobs)
        .where(and(eq(jobs.id, jobId), isNull(jobs.deletedAt)))
        .limit(1);

      if (!job) {
        return reply.status(404).send({ error: "Job not found", code: "NOT_FOUND" });
      }

      if (job.status === "invoiced") {
        return reply.status(400).send({
          error: "Cannot add pricing lines to an invoiced job",
          code: "JOB_LOCKED",
        });
      }

      const id = crypto.randomUUID();

      const [line] = await ctx.tenantDb
        .insert(jobPricingLines)
        .values({
          id,
          jobId,
          lineType: input.lineType,
          partyId: input.partyId,
          partyName: input.partyName,
          category: input.category,
          description: input.description,
          rateType: input.rateType,
          quantity: input.quantity.toString(),
          unitRate: input.unitRate.toString(),
          total: input.total.toString(),
          isLocked: input.isLocked,
          isVariation: input.isVariation,
          variationReason: input.variationReason,
          source: input.source,
          sourceReferenceId: input.sourceReferenceId,
          sortOrder: input.sortOrder,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "job_pricing_line",
        entityId: id,
        newData: { jobId, ...input },
      });

      return reply.status(201).send({ success: true, data: line });
    },
  );

  /**
   * PUT /api/v1/jobs/:id/pricing-lines/:subId
   */
  app.put(
    "/:id/pricing-lines/:subId",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = subResourceParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateJobPricingLineSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid pricing line data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { subId } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(jobPricingLines)
        .where(eq(jobPricingLines.id, subId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Pricing line not found", code: "NOT_FOUND" });
      }

      if (existing.isLocked) {
        return reply.status(400).send({
          error: "This pricing line is locked and cannot be edited",
          code: "LINE_LOCKED",
        });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.lineType !== undefined) updateValues.lineType = input.lineType;
      if (input.partyId !== undefined) updateValues.partyId = input.partyId;
      if (input.partyName !== undefined) updateValues.partyName = input.partyName;
      if (input.category !== undefined) updateValues.category = input.category;
      if (input.description !== undefined) updateValues.description = input.description;
      if (input.rateType !== undefined) updateValues.rateType = input.rateType;
      if (input.quantity !== undefined) updateValues.quantity = input.quantity.toString();
      if (input.unitRate !== undefined) updateValues.unitRate = input.unitRate.toString();
      if (input.total !== undefined) updateValues.total = input.total.toString();
      if (input.isLocked !== undefined) updateValues.isLocked = input.isLocked;
      if (input.isVariation !== undefined) updateValues.isVariation = input.isVariation;
      if (input.variationReason !== undefined) updateValues.variationReason = input.variationReason;
      if (input.source !== undefined) updateValues.source = input.source;
      if (input.sourceReferenceId !== undefined) updateValues.sourceReferenceId = input.sourceReferenceId;
      if (input.sortOrder !== undefined) updateValues.sortOrder = input.sortOrder;

      const [updated] = await ctx.tenantDb
        .update(jobPricingLines)
        .set(updateValues)
        .where(eq(jobPricingLines.id, subId))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "job_pricing_line",
        entityId: subId,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/jobs/:id/pricing-lines/:subId
   */
  app.delete(
    "/:id/pricing-lines/:subId",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = subResourceParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const { subId } = paramsParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(jobPricingLines)
        .where(eq(jobPricingLines.id, subId))
        .limit(1);

      if (existing?.isLocked) {
        return reply.status(400).send({
          error: "This pricing line is locked and cannot be deleted",
          code: "LINE_LOCKED",
        });
      }

      await ctx.tenantDb.delete(jobPricingLines).where(eq(jobPricingLines.id, subId));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "job_pricing_line",
        entityId: subId,
        previousData: existing,
      });

      return { success: true, data: { id: subId } };
    },
  );

  /**
   * GET /api/v1/jobs/:id/financial-summary
   * Compute financial summary from all pricing lines for a job.
   */
  app.get(
    "/:id/financial-summary",
    { preHandler: requirePermission("view:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid job ID", code: "VALIDATION_ERROR" });
      }

      const jobId = paramsParsed.data.id;

      // Verify job exists
      const [job] = await ctx.tenantDb
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.id, jobId), isNull(jobs.deletedAt)))
        .limit(1);

      if (!job) {
        return reply.status(404).send({ error: "Job not found", code: "NOT_FOUND" });
      }

      const lines = await ctx.tenantDb
        .select()
        .from(jobPricingLines)
        .where(eq(jobPricingLines.jobId, jobId));

      let totalRevenue = 0;
      let totalCost = 0;

      const categoryMap = new Map<string, { revenue: number; cost: number }>();

      for (const line of lines) {
        const total = Number(line.total);
        const category = line.category;

        if (!categoryMap.has(category)) {
          categoryMap.set(category, { revenue: 0, cost: 0 });
        }
        const cat = categoryMap.get(category)!;

        if (line.lineType === "revenue") {
          totalRevenue += total;
          cat.revenue += total;
        } else {
          totalCost += total;
          cat.cost += total;
        }
      }

      const grossProfit = totalRevenue - totalCost;
      const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : null;

      const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
        category,
        revenue: data.revenue,
        cost: data.cost,
      }));

      return {
        success: true,
        data: {
          totalRevenue,
          totalCost,
          grossProfit,
          marginPercent: marginPercent !== null ? Math.round(marginPercent * 100) / 100 : null,
          categoryBreakdown,
        },
      };
    },
  );

  // ── Job Assignments ──

  /**
   * POST /api/v1/jobs/:id/assignments
   * Assign an asset, driver, or contractor to a job.
   */
  app.post(
    "/:id/assignments",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid job ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = createJobAssignmentSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid assignment data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const jobId = paramsParsed.data.id;
      const input = bodyParsed.data;

      // Verify job exists and is in an assignable status
      const [job] = await ctx.tenantDb
        .select({ id: jobs.id, status: jobs.status, scheduledStart: jobs.scheduledStart })
        .from(jobs)
        .where(and(eq(jobs.id, jobId), isNull(jobs.deletedAt)))
        .limit(1);

      if (!job) {
        return reply.status(404).send({ error: "Job not found", code: "NOT_FOUND" });
      }

      if (job.status === "invoiced" || job.status === "cancelled") {
        return reply.status(400).send({
          error: `Cannot assign resources to a ${job.status} job`,
          code: "JOB_LOCKED",
        });
      }

      // Validate based on assignment type
      if (input.assignmentType === "asset") {
        if (!input.assetId) {
          return reply.status(400).send({
            error: "Asset ID is required for asset assignments",
            code: "VALIDATION_ERROR",
          });
        }
        const [asset] = await ctx.tenantDb
          .select({ id: assets.id, status: assets.status })
          .from(assets)
          .where(and(eq(assets.id, input.assetId), isNull(assets.deletedAt)))
          .limit(1);
        if (!asset) {
          return reply.status(400).send({
            error: "Asset not found",
            code: "INVALID_REFERENCE",
          });
        }
        if (asset.status !== "available" && asset.status !== "in_use") {
          return reply.status(400).send({
            error: `Asset is not available (current status: ${asset.status})`,
            code: "RESOURCE_UNAVAILABLE",
          });
        }
      }

      if (input.assignmentType === "driver") {
        if (!input.employeeId) {
          return reply.status(400).send({
            error: "Employee ID is required for driver assignments",
            code: "VALIDATION_ERROR",
          });
        }
        const [employee] = await ctx.tenantDb
          .select({ id: employees.id, isDriver: employees.isDriver, status: employees.status })
          .from(employees)
          .where(and(eq(employees.id, input.employeeId), isNull(employees.deletedAt)))
          .limit(1);
        if (!employee) {
          return reply.status(400).send({
            error: "Employee not found",
            code: "INVALID_REFERENCE",
          });
        }
        if (!employee.isDriver) {
          return reply.status(400).send({
            error: "Employee is not a driver",
            code: "INVALID_REFERENCE",
          });
        }
        if (employee.status !== "active") {
          return reply.status(400).send({
            error: `Driver is not active (current status: ${employee.status})`,
            code: "RESOURCE_UNAVAILABLE",
          });
        }
      }

      if (input.assignmentType === "contractor") {
        if (!input.contractorCompanyId) {
          return reply.status(400).send({
            error: "Contractor company ID is required for contractor assignments",
            code: "VALIDATION_ERROR",
          });
        }
        const [contractor] = await ctx.tenantDb
          .select({ id: companies.id, isContractor: companies.isContractor })
          .from(companies)
          .where(and(eq(companies.id, input.contractorCompanyId), isNull(companies.deletedAt)))
          .limit(1);
        if (!contractor) {
          return reply.status(400).send({
            error: "Contractor company not found",
            code: "INVALID_REFERENCE",
          });
        }
        if (!contractor.isContractor) {
          return reply.status(400).send({
            error: "Company is not a contractor",
            code: "INVALID_REFERENCE",
          });
        }
      }

      // Validate requirement reference if provided
      if (input.requirementId) {
        const [req] = await ctx.tenantDb
          .select({ id: jobAssetRequirements.id })
          .from(jobAssetRequirements)
          .where(and(
            eq(jobAssetRequirements.id, input.requirementId),
            eq(jobAssetRequirements.jobId, jobId),
          ))
          .limit(1);
        if (!req) {
          return reply.status(400).send({
            error: "Asset requirement not found on this job",
            code: "INVALID_REFERENCE",
          });
        }
      }

      const id = crypto.randomUUID();
      const [assignment] = await ctx.tenantDb
        .insert(jobAssignments)
        .values({
          id,
          jobId,
          assignmentType: input.assignmentType,
          assetId: input.assetId,
          employeeId: input.employeeId,
          contractorCompanyId: input.contractorCompanyId,
          requirementId: input.requirementId,
          status: "assigned",
          plannedStart: input.plannedStart ? new Date(input.plannedStart) : undefined,
          plannedEnd: input.plannedEnd ? new Date(input.plannedEnd) : undefined,
          notes: input.notes,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "job_assignment",
        entityId: id,
        newData: assignment,
      });

      // Auto-transition job status on allocation
      // confirmed → scheduled when first resource allocated
      // scheduled → in_progress if scheduledStart is in the past
      const currentStatus = job.status as JobStatus;
      let newStatus: JobStatus | null = null;

      if (currentStatus === "confirmed") {
        // Check if scheduledStart is in the past → go straight to in_progress
        if (job.scheduledStart && new Date(job.scheduledStart) <= new Date()) {
          newStatus = "in_progress";
        } else {
          newStatus = "scheduled";
        }
      } else if (currentStatus === "scheduled") {
        if (job.scheduledStart && new Date(job.scheduledStart) <= new Date()) {
          newStatus = "in_progress";
        }
      }

      if (newStatus) {
        const updateData: Record<string, unknown> = {
          status: newStatus,
          updatedAt: new Date(),
        };
        if (newStatus === "in_progress") {
          updateData.actualStart = new Date();
        }

        await ctx.tenantDb
          .update(jobs)
          .set(updateData)
          .where(eq(jobs.id, jobId));

        await ctx.tenantDb.insert(jobStatusHistory).values({
          jobId,
          fromStatus: currentStatus,
          toStatus: newStatus,
          changedBy: ctx.userId,
          reason: "Auto-transitioned on resource allocation",
        });

        await ctx.tenantDb.insert(auditLog).values({
          userId: ctx.userId,
          action: "STATUS_CHANGE",
          entityType: "job",
          entityId: jobId,
          previousData: { status: currentStatus },
          newData: { status: newStatus, trigger: "allocation" },
        });
      }

      return reply.status(201).send({ success: true, data: assignment });
    },
  );

  /**
   * PUT /api/v1/jobs/:id/assignments/:subId
   * Update an assignment (status, times, notes).
   */
  app.put(
    "/:id/assignments/:subId",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = subResourceParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateJobAssignmentSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid assignment data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { subId } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(jobAssignments)
        .where(eq(jobAssignments.id, subId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Assignment not found", code: "NOT_FOUND" });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.status !== undefined) updateValues.status = input.status;
      if (input.plannedStart !== undefined)
        updateValues.plannedStart = input.plannedStart ? new Date(input.plannedStart) : null;
      if (input.plannedEnd !== undefined)
        updateValues.plannedEnd = input.plannedEnd ? new Date(input.plannedEnd) : null;
      if (input.actualStart !== undefined)
        updateValues.actualStart = input.actualStart ? new Date(input.actualStart) : null;
      if (input.actualEnd !== undefined)
        updateValues.actualEnd = input.actualEnd ? new Date(input.actualEnd) : null;
      if (input.notes !== undefined) updateValues.notes = input.notes;

      const [updated] = await ctx.tenantDb
        .update(jobAssignments)
        .set(updateValues)
        .where(eq(jobAssignments.id, subId))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "job_assignment",
        entityId: subId,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/jobs/:id/assignments/:subId
   * Remove an assignment from a job.
   */
  app.delete(
    "/:id/assignments/:subId",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = subResourceParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const { subId } = paramsParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(jobAssignments)
        .where(eq(jobAssignments.id, subId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Assignment not found", code: "NOT_FOUND" });
      }

      await ctx.tenantDb.delete(jobAssignments).where(eq(jobAssignments.id, subId));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "job_assignment",
        entityId: subId,
        previousData: existing,
      });

      return { success: true, data: { id: subId } };
    },
  );
}
