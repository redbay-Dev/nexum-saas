import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, ilike, or, sql, desc } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  daysheets,
  daysheetLoads,
  dockets,
  charges,
  overages,
  jobs,
  jobPricingLines,
  jobAssignments,
  jobAssetRequirements,
  employees,
  assets,
  companies,
  auditLog,
} from "../db/schema/tenant.js";
import type { getTenantDb } from "../db/client.js";
import {
  createDaysheetSchema,
  updateDaysheetSchema,
  createDaysheetLoadSchema,
  updateDaysheetLoadSchema,
  daysheetStatusTransitionSchema,
  batchProcessDaysheetsSchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import type { DaysheetStatus } from "@nexum/shared";
import { z } from "zod";
import { calculateNetWeight, aggregateLoadWeights } from "../services/weight-calculator.js";
import { calculateTimeWorked } from "../services/time-calculator.js";
import { generateChargesFromPricingLines } from "../services/charge-creator.js";
import { detectAllOverages } from "../services/overage-detector.js";
import { isEligibleForAutoProcessing } from "../services/reconciliation.js";

const daysheetListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  status: z.string().optional(),
  jobId: z.uuid().optional(),
  driverId: z.uuid().optional(),
  assetId: z.uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

type DaysheetListQuery = z.infer<typeof daysheetListQuerySchema>;

const subResourceParamSchema = z.object({
  id: z.uuid(),
  subId: z.uuid(),
});

const VALID_DAYSHEET_TRANSITIONS: Record<string, string[]> = {
  submitted: ["review", "rejected"],
  review: ["reconciled", "processed", "rejected"],
  reconciled: ["processed", "rejected"],
  processed: [],
  rejected: ["submitted"],
};

function isValidDaysheetTransition(from: string, to: string): boolean {
  return VALID_DAYSHEET_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function daysheetRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ── Daysheet CRUD ──

  /**
   * GET /api/v1/daysheets — List daysheets with filters
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = daysheetListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query: DaysheetListQuery = parsed.data;
      const limit = query.limit;

      const conditions = [isNull(daysheets.deletedAt)];

      if (query.status) conditions.push(eq(daysheets.status, query.status));
      if (query.jobId) conditions.push(eq(daysheets.jobId, query.jobId));
      if (query.driverId) conditions.push(eq(daysheets.driverId, query.driverId));
      if (query.assetId) conditions.push(eq(daysheets.assetId, query.assetId));
      if (query.dateFrom) conditions.push(sql`${daysheets.workDate} >= ${query.dateFrom}`);
      if (query.dateTo) conditions.push(sql`${daysheets.workDate} <= ${query.dateTo}`);

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(
          or(
            ilike(daysheets.notes, searchPattern),
          ) ?? sql`TRUE`,
        );
      }

      if (query.cursor) {
        conditions.push(sql`${daysheets.id} < ${query.cursor}`);
      }

      const rows = await ctx.tenantDb
        .select({
          daysheet: daysheets,
          jobName: jobs.name,
          jobNumber: jobs.jobNumber,
          driverName: sql<string | null>`COALESCE(${employees.firstName} || ' ' || ${employees.lastName}, NULL)`,
          assetRegistration: assets.registrationNumber,
          customerName: companies.name,
        })
        .from(daysheets)
        .leftJoin(jobs, eq(daysheets.jobId, jobs.id))
        .leftJoin(employees, eq(daysheets.driverId, employees.id))
        .leftJoin(assets, eq(daysheets.assetId, assets.id))
        .leftJoin(companies, eq(jobs.customerId, companies.id))
        .where(and(...conditions))
        .orderBy(desc(daysheets.workDate), desc(daysheets.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.daysheet.id ?? null : null;

      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(daysheets)
        .where(and(isNull(daysheets.deletedAt)));

      const flatData = data.map((row) => ({
        ...row.daysheet,
        jobName: row.jobName,
        jobNumber: row.jobNumber,
        driverName: row.driverName,
        assetRegistration: row.assetRegistration,
        customerName: row.customerName,
      }));

      return {
        success: true,
        data: { data: flatData, nextCursor, hasMore, total: countResult?.count ?? 0 },
      };
    },
  );

  /**
   * GET /api/v1/daysheets/:id — Get daysheet detail with loads, dockets, charges, overages
   */
  app.get(
    "/:id",
    { preHandler: requirePermission("view:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [daysheet] = await ctx.tenantDb
        .select({
          daysheet: daysheets,
          jobName: jobs.name,
          jobNumber: jobs.jobNumber,
          driverName: sql<string | null>`COALESCE(${employees.firstName} || ' ' || ${employees.lastName}, NULL)`,
          assetRegistration: assets.registrationNumber,
          assetNumber: assets.assetNumber,
          customerName: companies.name,
        })
        .from(daysheets)
        .leftJoin(jobs, eq(daysheets.jobId, jobs.id))
        .leftJoin(employees, eq(daysheets.driverId, employees.id))
        .leftJoin(assets, eq(daysheets.assetId, assets.id))
        .leftJoin(companies, eq(jobs.customerId, companies.id))
        .where(and(eq(daysheets.id, parsed.data.id), isNull(daysheets.deletedAt)));

      if (!daysheet) {
        return reply.status(404).send({ error: "Daysheet not found", code: "NOT_FOUND" });
      }

      // Fetch sub-resources in parallel
      const [loadRows, docketRows, chargeRows, overageRows] = await Promise.all([
        ctx.tenantDb.select().from(daysheetLoads).where(eq(daysheetLoads.daysheetId, parsed.data.id)).orderBy(daysheetLoads.loadNumber),
        ctx.tenantDb.select().from(dockets).where(and(eq(dockets.daysheetId, parsed.data.id), isNull(dockets.deletedAt))),
        ctx.tenantDb.select().from(charges).where(eq(charges.daysheetId, parsed.data.id)),
        ctx.tenantDb.select().from(overages).where(eq(overages.daysheetId, parsed.data.id)),
      ]);

      return {
        success: true,
        data: {
          ...daysheet.daysheet,
          jobName: daysheet.jobName,
          jobNumber: daysheet.jobNumber,
          driverName: daysheet.driverName,
          assetRegistration: daysheet.assetRegistration,
          assetNumber: daysheet.assetNumber,
          customerName: daysheet.customerName,
          loads: loadRows,
          dockets: docketRows,
          charges: chargeRows,
          overages: overageRows,
        },
      };
    },
  );

  /**
   * POST /api/v1/daysheets — Create a daysheet
   */
  app.post(
    "/",
    { preHandler: requirePermission("manage:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = createDaysheetSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      // Verify job exists
      const [job] = await ctx.tenantDb
        .select({ id: jobs.id, status: jobs.status })
        .from(jobs)
        .where(and(eq(jobs.id, parsed.data.jobId), isNull(jobs.deletedAt)));

      if (!job) {
        return reply.status(404).send({ error: "Job not found", code: "JOB_NOT_FOUND" });
      }

      // Calculate time if hourly data provided
      let hoursWorked: string | undefined;
      let totalBillableHours: string | undefined;

      if (parsed.data.startTime && parsed.data.endTime) {
        const timeResult = calculateTimeWorked({
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          breakMinutes: parsed.data.breakMinutes,
        });
        hoursWorked = String(timeResult.hoursWorked);
        totalBillableHours = String(timeResult.totalBillableHours);
      }

      const [created] = await ctx.tenantDb
        .insert(daysheets)
        .values({
          jobId: parsed.data.jobId,
          assignmentId: parsed.data.assignmentId,
          driverId: parsed.data.driverId,
          assetId: parsed.data.assetId,
          workDate: parsed.data.workDate,
          submissionChannel: parsed.data.submissionChannel,
          status: "submitted",
          loadCount: parsed.data.loadCount,
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          breakMinutes: parsed.data.breakMinutes,
          overtimeHours: parsed.data.overtimeHours !== undefined ? String(parsed.data.overtimeHours) : undefined,
          hoursWorked,
          totalBillableHours,
          pickupLocationId: parsed.data.pickupLocationId,
          deliveryLocationId: parsed.data.deliveryLocationId,
          notes: parsed.data.notes,
          internalNotes: parsed.data.internalNotes,
        })
        .returning();

      // Audit log
      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "daysheet",
        entityId: created?.id,
        newData: created,
      });

      return reply.status(201).send({ success: true, data: created });
    },
  );

  /**
   * PUT /api/v1/daysheets/:id — Update a daysheet (only if not yet processed)
   */
  app.put(
    "/:id",
    { preHandler: requirePermission("manage:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      const bodyParsed = updateDaysheetSchema.safeParse(request.body);
      if (!paramsParsed.success || !bodyParsed.success) {
        return reply.status(400).send({ error: "Validation failed", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(daysheets)
        .where(and(eq(daysheets.id, paramsParsed.data.id), isNull(daysheets.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "Daysheet not found", code: "NOT_FOUND" });
      }

      if (existing.status === "processed") {
        return reply.status(400).send({
          error: "Cannot edit a processed daysheet",
          code: "DAYSHEET_ALREADY_PROCESSED",
        });
      }

      // Recalculate time if updated
      const updateData: Record<string, unknown> = {
        ...bodyParsed.data,
        updatedAt: new Date(),
      };

      if (bodyParsed.data.overtimeHours !== undefined) {
        updateData.overtimeHours = String(bodyParsed.data.overtimeHours);
      }

      const startTime = bodyParsed.data.startTime ?? existing.startTime;
      const endTime = bodyParsed.data.endTime ?? existing.endTime;

      if (startTime && endTime) {
        const timeResult = calculateTimeWorked({
          startTime,
          endTime,
          breakMinutes: bodyParsed.data.breakMinutes ?? existing.breakMinutes ?? undefined,
        });
        updateData.hoursWorked = String(timeResult.hoursWorked);
        updateData.totalBillableHours = String(timeResult.totalBillableHours);
      }

      const [updated] = await ctx.tenantDb
        .update(daysheets)
        .set(updateData)
        .where(eq(daysheets.id, paramsParsed.data.id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "daysheet",
        entityId: paramsParsed.data.id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/daysheets/:id — Soft-delete a daysheet
   */
  app.delete(
    "/:id",
    { preHandler: requirePermission("manage:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(daysheets)
        .where(and(eq(daysheets.id, parsed.data.id), isNull(daysheets.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "Daysheet not found", code: "NOT_FOUND" });
      }

      if (existing.status === "processed") {
        return reply.status(400).send({
          error: "Cannot delete a processed daysheet",
          code: "DAYSHEET_ALREADY_PROCESSED",
        });
      }

      await ctx.tenantDb
        .update(daysheets)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(daysheets.id, parsed.data.id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "daysheet",
        entityId: parsed.data.id,
      });

      return { success: true, data: { id: parsed.data.id } };
    },
  );

  // ── Daysheet Status Transitions ──

  /**
   * POST /api/v1/daysheets/:id/transition — Transition daysheet status
   */
  app.post(
    "/:id/transition",
    { preHandler: requirePermission("manage:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      const bodyParsed = daysheetStatusTransitionSchema.safeParse(request.body);
      if (!paramsParsed.success || !bodyParsed.success) {
        return reply.status(400).send({ error: "Validation failed", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(daysheets)
        .where(and(eq(daysheets.id, paramsParsed.data.id), isNull(daysheets.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "Daysheet not found", code: "NOT_FOUND" });
      }

      const targetStatus = bodyParsed.data.status;
      if (!isValidDaysheetTransition(existing.status, targetStatus)) {
        return reply.status(400).send({
          error: `Cannot transition from ${existing.status} to ${targetStatus}`,
          code: "INVALID_TRANSITION",
        });
      }

      const updateData: Record<string, unknown> = {
        status: targetStatus,
        updatedAt: new Date(),
      };

      if (targetStatus === "rejected") {
        updateData.rejectionReason = bodyParsed.data.reason;
      }

      const [updated] = await ctx.tenantDb
        .update(daysheets)
        .set(updateData)
        .where(eq(daysheets.id, paramsParsed.data.id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "daysheet",
        entityId: paramsParsed.data.id,
        previousData: { status: existing.status },
        newData: { status: targetStatus, reason: bodyParsed.data.reason },
      });

      return { success: true, data: updated };
    },
  );

  // ── Daysheet Loads ──

  /**
   * POST /api/v1/daysheets/:id/loads — Add a load to a daysheet
   */
  app.post(
    "/:id/loads",
    { preHandler: requirePermission("manage:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      const bodyParsed = createDaysheetLoadSchema.safeParse(request.body);
      if (!paramsParsed.success || !bodyParsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: bodyParsed.success ? undefined : bodyParsed.error.flatten().fieldErrors,
        });
      }

      // Verify daysheet exists and is editable
      const [daysheet] = await ctx.tenantDb
        .select()
        .from(daysheets)
        .where(and(eq(daysheets.id, paramsParsed.data.id), isNull(daysheets.deletedAt)));

      if (!daysheet) {
        return reply.status(404).send({ error: "Daysheet not found", code: "NOT_FOUND" });
      }

      if (daysheet.status === "processed") {
        return reply.status(400).send({ error: "Cannot add loads to a processed daysheet", code: "DAYSHEET_ALREADY_PROCESSED" });
      }

      // Calculate net weight if gross and tare provided
      let netWeight: string | undefined;
      if (bodyParsed.data.grossWeight !== undefined && bodyParsed.data.tareWeight !== undefined) {
        const weightResult = calculateNetWeight({
          grossWeight: bodyParsed.data.grossWeight,
          tareWeight: bodyParsed.data.tareWeight,
        });
        netWeight = String(weightResult.netWeight);
      }

      const [created] = await ctx.tenantDb
        .insert(daysheetLoads)
        .values({
          daysheetId: paramsParsed.data.id,
          loadNumber: bodyParsed.data.loadNumber,
          materialSourceType: bodyParsed.data.materialSourceType,
          materialSourceId: bodyParsed.data.materialSourceId,
          materialName: bodyParsed.data.materialName,
          unitOfMeasure: bodyParsed.data.unitOfMeasure,
          quantity: bodyParsed.data.quantity !== undefined ? String(bodyParsed.data.quantity) : undefined,
          grossWeight: bodyParsed.data.grossWeight !== undefined ? String(bodyParsed.data.grossWeight) : undefined,
          tareWeight: bodyParsed.data.tareWeight !== undefined ? String(bodyParsed.data.tareWeight) : undefined,
          netWeight,
          docketNumber: bodyParsed.data.docketNumber,
          notes: bodyParsed.data.notes,
        })
        .returning();

      // Recalculate daysheet totals
      await recalculateDaysheetTotals(ctx.tenantDb, paramsParsed.data.id);

      return reply.status(201).send({ success: true, data: created });
    },
  );

  /**
   * PUT /api/v1/daysheets/:id/loads/:subId — Update a load
   */
  app.put(
    "/:id/loads/:subId",
    { preHandler: requirePermission("manage:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = subResourceParamSchema.safeParse(request.params);
      const bodyParsed = updateDaysheetLoadSchema.safeParse(request.body);
      if (!paramsParsed.success || !bodyParsed.success) {
        return reply.status(400).send({ error: "Validation failed", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(daysheetLoads)
        .where(and(eq(daysheetLoads.id, paramsParsed.data.subId), eq(daysheetLoads.daysheetId, paramsParsed.data.id)));

      if (!existing) {
        return reply.status(404).send({ error: "Load not found", code: "NOT_FOUND" });
      }

      const updateData: Record<string, unknown> = { ...bodyParsed.data, updatedAt: new Date() };

      // Recalculate net weight if gross or tare changed
      const grossWeight = bodyParsed.data.grossWeight ?? (existing.grossWeight ? parseFloat(existing.grossWeight) : undefined);
      const tareWeight = bodyParsed.data.tareWeight ?? (existing.tareWeight ? parseFloat(existing.tareWeight) : undefined);

      if (grossWeight !== undefined && tareWeight !== undefined) {
        const weightResult = calculateNetWeight({ grossWeight, tareWeight });
        updateData.netWeight = String(weightResult.netWeight);
      }

      if (bodyParsed.data.grossWeight !== undefined) updateData.grossWeight = String(bodyParsed.data.grossWeight);
      if (bodyParsed.data.tareWeight !== undefined) updateData.tareWeight = String(bodyParsed.data.tareWeight);
      if (bodyParsed.data.quantity !== undefined) updateData.quantity = String(bodyParsed.data.quantity);

      const [updated] = await ctx.tenantDb
        .update(daysheetLoads)
        .set(updateData)
        .where(eq(daysheetLoads.id, paramsParsed.data.subId))
        .returning();

      // Recalculate daysheet totals
      await recalculateDaysheetTotals(ctx.tenantDb, paramsParsed.data.id);

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/daysheets/:id/loads/:subId — Remove a load
   */
  app.delete(
    "/:id/loads/:subId",
    { preHandler: requirePermission("manage:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = subResourceParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(daysheetLoads)
        .where(and(eq(daysheetLoads.id, paramsParsed.data.subId), eq(daysheetLoads.daysheetId, paramsParsed.data.id)));

      if (!existing) {
        return reply.status(404).send({ error: "Load not found", code: "NOT_FOUND" });
      }

      await ctx.tenantDb.delete(daysheetLoads).where(eq(daysheetLoads.id, paramsParsed.data.subId));

      // Recalculate daysheet totals
      await recalculateDaysheetTotals(ctx.tenantDb, paramsParsed.data.id);

      return { success: true, data: { id: paramsParsed.data.subId } };
    },
  );

  // ── Processing ──

  /**
   * POST /api/v1/daysheets/:id/process — Process a daysheet (create charges from pricing lines)
   */
  app.post(
    "/:id/process",
    { preHandler: requirePermission("approve:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [daysheet] = await ctx.tenantDb
        .select()
        .from(daysheets)
        .where(and(eq(daysheets.id, paramsParsed.data.id), isNull(daysheets.deletedAt)));

      if (!daysheet) {
        return reply.status(404).send({ error: "Daysheet not found", code: "NOT_FOUND" });
      }

      if (daysheet.status === "processed") {
        return reply.status(400).send({ error: "Daysheet already processed", code: "DAYSHEET_ALREADY_PROCESSED" });
      }

      if (daysheet.status === "rejected") {
        return reply.status(400).send({ error: "Cannot process a rejected daysheet", code: "DAYSHEET_REJECTED" });
      }

      // Check for pending overages
      const pendingOverages = await ctx.tenantDb
        .select({ id: overages.id })
        .from(overages)
        .where(and(eq(overages.daysheetId, daysheet.id), eq(overages.approvalStatus, "pending")));

      if (pendingOverages.length > 0) {
        return reply.status(400).send({
          error: `${pendingOverages.length} pending overage(s) must be resolved before processing`,
          code: "PENDING_OVERAGES",
        });
      }

      // Get job pricing lines
      const pricingLines = await ctx.tenantDb
        .select()
        .from(jobPricingLines)
        .where(eq(jobPricingLines.jobId, daysheet.jobId));

      // Get daysheet quantities
      const daysheetQuantities = {
        totalNetWeight: parseFloat(daysheet.totalNetWeight ?? "0"),
        totalQuantity: parseFloat(daysheet.totalQuantity ?? "0"),
        totalBillableHours: parseFloat(daysheet.totalBillableHours ?? "0"),
        loadCount: daysheet.loadCount ?? 0,
        overtimeHours: parseFloat(daysheet.overtimeHours ?? "0"),
      };

      // Generate charges from pricing lines
      const generatedCharges = generateChargesFromPricingLines(
        pricingLines.map((pl) => ({
          id: pl.id,
          lineType: pl.lineType,
          partyId: pl.partyId,
          partyName: pl.partyName,
          category: pl.category,
          description: pl.description,
          rateType: pl.rateType,
          quantity: pl.quantity,
          unitRate: pl.unitRate,
          total: pl.total,
          isLocked: pl.isLocked,
        })),
        daysheetQuantities,
      );

      // Insert charges
      const chargeRows = [];
      for (const charge of generatedCharges) {
        const [row] = await ctx.tenantDb
          .insert(charges)
          .values({
            daysheetId: daysheet.id,
            jobId: daysheet.jobId,
            pricingLineId: charge.pricingLineId,
            lineType: charge.lineType,
            partyId: charge.partyId,
            partyName: charge.partyName,
            category: charge.category,
            description: charge.description,
            rateType: charge.rateType,
            quantity: String(charge.quantity),
            unitRate: String(charge.unitRate),
            total: String(charge.total),
          })
          .returning();
        if (row) chargeRows.push(row);
      }

      // Update daysheet status to processed
      const [updated] = await ctx.tenantDb
        .update(daysheets)
        .set({
          status: "processed" as DaysheetStatus,
          processedAt: new Date(),
          processedBy: ctx.userName,
          updatedAt: new Date(),
        })
        .where(eq(daysheets.id, daysheet.id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "daysheet",
        entityId: daysheet.id,
        previousData: { status: daysheet.status },
        newData: { status: "processed", chargeCount: chargeRows.length },
      });

      return {
        success: true,
        data: {
          daysheet: updated,
          charges: chargeRows,
          chargeCount: chargeRows.length,
        },
      };
    },
  );

  /**
   * POST /api/v1/daysheets/batch-process — Batch process multiple daysheets
   */
  app.post(
    "/batch-process",
    { preHandler: requirePermission("approve:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = batchProcessDaysheetsSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const results: Array<{ daysheetId: string; status: string; chargeCount: number; error?: string }> = [];

      for (const daysheetId of parsed.data.daysheetIds) {
        try {
          const [ds] = await ctx.tenantDb
            .select()
            .from(daysheets)
            .where(and(eq(daysheets.id, daysheetId), isNull(daysheets.deletedAt)));

          if (!ds) {
            results.push({ daysheetId, status: "error", chargeCount: 0, error: "Not found" });
            continue;
          }

          if (ds.status === "processed") {
            results.push({ daysheetId, status: "skipped", chargeCount: 0, error: "Already processed" });
            continue;
          }

          if (ds.status === "rejected") {
            results.push({ daysheetId, status: "skipped", chargeCount: 0, error: "Rejected" });
            continue;
          }

          // Check pending overages
          const pending = await ctx.tenantDb
            .select({ id: overages.id })
            .from(overages)
            .where(and(eq(overages.daysheetId, daysheetId), eq(overages.approvalStatus, "pending")));

          if (pending.length > 0) {
            results.push({ daysheetId, status: "skipped", chargeCount: 0, error: "Pending overages" });
            continue;
          }

          // Get pricing lines and generate charges
          const pricingLines = await ctx.tenantDb
            .select()
            .from(jobPricingLines)
            .where(eq(jobPricingLines.jobId, ds.jobId));

          const quantities = {
            totalNetWeight: parseFloat(ds.totalNetWeight ?? "0"),
            totalQuantity: parseFloat(ds.totalQuantity ?? "0"),
            totalBillableHours: parseFloat(ds.totalBillableHours ?? "0"),
            loadCount: ds.loadCount ?? 0,
            overtimeHours: parseFloat(ds.overtimeHours ?? "0"),
          };

          const generated = generateChargesFromPricingLines(
            pricingLines.map((pl) => ({
              id: pl.id,
              lineType: pl.lineType,
              partyId: pl.partyId,
              partyName: pl.partyName,
              category: pl.category,
              description: pl.description,
              rateType: pl.rateType,
              quantity: pl.quantity,
              unitRate: pl.unitRate,
              total: pl.total,
              isLocked: pl.isLocked,
            })),
            quantities,
          );

          let chargeCount = 0;
          for (const charge of generated) {
            await ctx.tenantDb.insert(charges).values({
              daysheetId: ds.id,
              jobId: ds.jobId,
              pricingLineId: charge.pricingLineId,
              lineType: charge.lineType,
              partyId: charge.partyId,
              partyName: charge.partyName,
              category: charge.category,
              description: charge.description,
              rateType: charge.rateType,
              quantity: String(charge.quantity),
              unitRate: String(charge.unitRate),
              total: String(charge.total),
            });
            chargeCount++;
          }

          await ctx.tenantDb
            .update(daysheets)
            .set({
              status: "processed" as DaysheetStatus,
              processedAt: new Date(),
              processedBy: ctx.userName,
              updatedAt: new Date(),
            })
            .where(eq(daysheets.id, daysheetId));

          results.push({ daysheetId, status: "processed", chargeCount });
        } catch {
          results.push({ daysheetId, status: "error", chargeCount: 0, error: "Processing failed" });
        }
      }

      const processed = results.filter((r) => r.status === "processed").length;
      const skipped = results.filter((r) => r.status === "skipped").length;
      const errors = results.filter((r) => r.status === "error").length;

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "daysheet_batch",
        newData: { processed, skipped, errors },
      });

      return {
        success: true,
        data: { results, summary: { processed, skipped, errors, total: parsed.data.daysheetIds.length } },
      };
    },
  );

  /**
   * POST /api/v1/daysheets/:id/detect-overages — Run overage detection on a daysheet
   */
  app.post(
    "/:id/detect-overages",
    { preHandler: requirePermission("manage:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [daysheet] = await ctx.tenantDb
        .select()
        .from(daysheets)
        .where(and(eq(daysheets.id, paramsParsed.data.id), isNull(daysheets.deletedAt)));

      if (!daysheet) {
        return reply.status(404).send({ error: "Daysheet not found", code: "NOT_FOUND" });
      }

      // Get asset limits if assigned
      let assetGvm: number | undefined;
      let assetTareWeight: number | undefined;
      let assetMaxVolume: number | undefined;

      if (daysheet.assetId) {
        const [asset] = await ctx.tenantDb
          .select({ gvm: assets.gvm, tareWeight: assets.tareWeight, capacity: assets.capacity })
          .from(assets)
          .where(eq(assets.id, daysheet.assetId));

        if (asset) {
          assetGvm = asset.gvm ? parseFloat(asset.gvm) : undefined;
          assetTareWeight = asset.tareWeight ? parseFloat(asset.tareWeight) : undefined;
          assetMaxVolume = asset.capacity ? parseFloat(asset.capacity) : undefined;
        }
      }

      // Get job contract limit (from asset requirement payload limit)
      let contractLimit: number | undefined;
      if (daysheet.assignmentId) {
        const [assignment] = await ctx.tenantDb
          .select({ requirementId: jobAssignments.requirementId })
          .from(jobAssignments)
          .where(eq(jobAssignments.id, daysheet.assignmentId));

        if (assignment?.requirementId) {
          const [req] = await ctx.tenantDb
            .select({ payloadLimit: jobAssetRequirements.payloadLimit })
            .from(jobAssetRequirements)
            .where(eq(jobAssetRequirements.id, assignment.requirementId));

          contractLimit = req?.payloadLimit ? parseFloat(req.payloadLimit) : undefined;
        }
      }

      // Get loads and run overage detection per load
      const loadRows = await ctx.tenantDb
        .select()
        .from(daysheetLoads)
        .where(eq(daysheetLoads.daysheetId, daysheet.id));

      const detectedOverages: Array<{
        loadId: string;
        overageType: string;
        severity: string;
        actualValue: number;
        limitValue: number;
        overageAmount: number;
        overagePercent: number;
      }> = [];

      for (const load of loadRows) {
        const netWeight = parseFloat(load.netWeight ?? "0");
        const quantity = parseFloat(load.quantity ?? "0");

        const loadOverages = detectAllOverages({
          netWeight,
          quantity,
          assetGvm,
          assetTareWeight,
          assetMaxVolume,
          contractLimit,
        });

        for (const overage of loadOverages) {
          // Insert overage record
          await ctx.tenantDb.insert(overages).values({
            daysheetId: daysheet.id,
            daysheetLoadId: load.id,
            jobId: daysheet.jobId,
            overageType: overage.overageType,
            severity: overage.severity,
            actualValue: String(overage.actualValue),
            limitValue: String(overage.limitValue),
            overageAmount: String(overage.overageAmount),
            overagePercent: String(overage.overagePercent),
            driverId: daysheet.driverId,
            assetId: daysheet.assetId,
            materialName: load.materialName,
            // Auto-approve minor overages
            approvalStatus: overage.severity === "minor" ? "auto_approved" : "pending",
            approvedBy: overage.severity === "minor" ? "system" : undefined,
            approvedAt: overage.severity === "minor" ? new Date() : undefined,
          });

          detectedOverages.push({
            loadId: load.id,
            overageType: overage.overageType,
            severity: overage.severity,
            actualValue: overage.actualValue,
            limitValue: overage.limitValue,
            overageAmount: overage.overageAmount,
            overagePercent: overage.overagePercent,
          });
        }
      }

      return {
        success: true,
        data: {
          overages: detectedOverages,
          totalOverages: detectedOverages.length,
          pendingApproval: detectedOverages.filter((o) => o.severity !== "minor").length,
          autoApproved: detectedOverages.filter((o) => o.severity === "minor").length,
        },
      };
    },
  );

  /**
   * POST /api/v1/daysheets/:id/check-auto-process — Check if daysheet is eligible for auto-processing
   */
  app.post(
    "/:id/check-auto-process",
    { preHandler: requirePermission("manage:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [daysheet] = await ctx.tenantDb
        .select()
        .from(daysheets)
        .where(and(eq(daysheets.id, paramsParsed.data.id), isNull(daysheets.deletedAt)));

      if (!daysheet) {
        return reply.status(404).send({ error: "Daysheet not found", code: "NOT_FOUND" });
      }

      // Check for pending overages
      const pendingOverageCount = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(overages)
        .where(and(eq(overages.daysheetId, daysheet.id), eq(overages.approvalStatus, "pending")));

      // Check for docket discrepancies
      const discrepantDockets = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(dockets)
        .where(and(eq(dockets.daysheetId, daysheet.id), eq(dockets.hasDiscrepancy, true)));

      const result = isEligibleForAutoProcessing({
        loadCount: daysheet.loadCount ?? undefined,
        totalNetWeight: daysheet.totalNetWeight ? parseFloat(daysheet.totalNetWeight) : undefined,
        totalBillableHours: daysheet.totalBillableHours ? parseFloat(daysheet.totalBillableHours) : undefined,
        hasOverages: (pendingOverageCount[0]?.count ?? 0) > 0,
        hasDocketDiscrepancies: (discrepantDockets[0]?.count ?? 0) > 0,
      });

      return { success: true, data: result };
    },
  );
}

/**
 * Recalculate daysheet totals from its loads.
 */
async function recalculateDaysheetTotals(
  tenantDb: ReturnType<typeof getTenantDb>,
  daysheetId: string,
): Promise<void> {
  const loadRows = await tenantDb
    .select()
    .from(daysheetLoads)
    .where(eq(daysheetLoads.daysheetId, daysheetId));

  const aggregated = aggregateLoadWeights(
    loadRows.map((l) => ({
      grossWeight: l.grossWeight ? parseFloat(l.grossWeight) : undefined,
      tareWeight: l.tareWeight ? parseFloat(l.tareWeight) : undefined,
      netWeight: l.netWeight ? parseFloat(l.netWeight) : undefined,
      quantity: l.quantity ? parseFloat(l.quantity) : undefined,
    })),
  );

  await tenantDb
    .update(daysheets)
    .set({
      loadCount: aggregated.loadCount,
      totalGrossWeight: String(aggregated.totalGross),
      totalTareWeight: String(aggregated.totalTare),
      totalNetWeight: String(aggregated.totalNet),
      totalQuantity: String(aggregated.totalQuantity),
      updatedAt: new Date(),
    })
    .where(eq(daysheets.id, daysheetId));
}
