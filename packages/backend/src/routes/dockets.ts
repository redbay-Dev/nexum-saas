import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, ilike, or, sql, desc } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  dockets,
  docketFiles,
  daysheets,
  jobs,
  companies,
  overages,
  auditLog,
} from "../db/schema/tenant.js";
import {
  createDocketSchema,
  updateDocketSchema,
  docketStatusTransitionSchema,
  overageDecisionSchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";
import { reconcileDocketWithDaysheet } from "../services/reconciliation.js";

const docketListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  status: z.string().optional(),
  jobId: z.uuid().optional(),
  daysheetId: z.uuid().optional(),
  docketType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

type DocketListQuery = z.infer<typeof docketListQuerySchema>;

const VALID_DOCKET_TRANSITIONS: Record<string, string[]> = {
  uploaded: ["matched"],
  matched: ["reconciled"],
  reconciled: ["filed"],
  filed: [],
};

function isValidDocketTransition(from: string, to: string): boolean {
  return VALID_DOCKET_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function docketRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ── Docket CRUD ──

  /**
   * GET /api/v1/dockets — List dockets with filters
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = docketListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query: DocketListQuery = parsed.data;
      const limit = query.limit;

      const conditions = [isNull(dockets.deletedAt)];

      if (query.status) conditions.push(eq(dockets.status, query.status));
      if (query.jobId) conditions.push(eq(dockets.jobId, query.jobId));
      if (query.daysheetId) conditions.push(eq(dockets.daysheetId, query.daysheetId));
      if (query.docketType) conditions.push(eq(dockets.docketType, query.docketType));
      if (query.dateFrom) conditions.push(sql`${dockets.issueDate} >= ${query.dateFrom}`);
      if (query.dateTo) conditions.push(sql`${dockets.issueDate} <= ${query.dateTo}`);

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(
          or(
            ilike(dockets.docketNumber, searchPattern),
            ilike(dockets.issuerName, searchPattern),
            ilike(dockets.materialName, searchPattern),
          ) ?? sql`TRUE`,
        );
      }

      if (query.cursor) {
        conditions.push(sql`${dockets.id} < ${query.cursor}`);
      }

      const rows = await ctx.tenantDb
        .select({
          docket: dockets,
          jobName: jobs.name,
          jobNumber: jobs.jobNumber,
          customerName: companies.name,
        })
        .from(dockets)
        .leftJoin(jobs, eq(dockets.jobId, jobs.id))
        .leftJoin(companies, eq(jobs.customerId, companies.id))
        .where(and(...conditions))
        .orderBy(desc(dockets.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.docket.id ?? null : null;

      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(dockets)
        .where(and(isNull(dockets.deletedAt)));

      const flatData = data.map((row) => ({
        ...row.docket,
        jobName: row.jobName,
        jobNumber: row.jobNumber,
        customerName: row.customerName,
      }));

      return {
        success: true,
        data: { data: flatData, nextCursor, hasMore, total: countResult?.count ?? 0 },
      };
    },
  );

  /**
   * GET /api/v1/dockets/:id — Get docket detail with files
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

      const [docket] = await ctx.tenantDb
        .select({
          docket: dockets,
          jobName: jobs.name,
          jobNumber: jobs.jobNumber,
          customerName: companies.name,
        })
        .from(dockets)
        .leftJoin(jobs, eq(dockets.jobId, jobs.id))
        .leftJoin(companies, eq(jobs.customerId, companies.id))
        .where(and(eq(dockets.id, parsed.data.id), isNull(dockets.deletedAt)));

      if (!docket) {
        return reply.status(404).send({ error: "Docket not found", code: "NOT_FOUND" });
      }

      const files = await ctx.tenantDb
        .select()
        .from(docketFiles)
        .where(eq(docketFiles.docketId, parsed.data.id));

      return {
        success: true,
        data: {
          ...docket.docket,
          jobName: docket.jobName,
          jobNumber: docket.jobNumber,
          customerName: docket.customerName,
          files,
        },
      };
    },
  );

  /**
   * POST /api/v1/dockets — Create a docket
   */
  app.post(
    "/",
    { preHandler: requirePermission("manage:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = createDocketSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      // Verify job exists
      const [job] = await ctx.tenantDb
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.id, parsed.data.jobId), isNull(jobs.deletedAt)));

      if (!job) {
        return reply.status(404).send({ error: "Job not found", code: "JOB_NOT_FOUND" });
      }

      // Calculate net weight if both provided
      let netWeight: string | undefined;
      if (parsed.data.grossWeight !== undefined && parsed.data.tareWeight !== undefined) {
        netWeight = String(Math.max(0, parsed.data.grossWeight - parsed.data.tareWeight));
      }

      const [created] = await ctx.tenantDb
        .insert(dockets)
        .values({
          jobId: parsed.data.jobId,
          daysheetId: parsed.data.daysheetId,
          docketType: parsed.data.docketType,
          docketNumber: parsed.data.docketNumber,
          status: parsed.data.daysheetId ? "matched" : "uploaded",
          issuerName: parsed.data.issuerName,
          issueDate: parsed.data.issueDate,
          materialName: parsed.data.materialName,
          quantity: parsed.data.quantity !== undefined ? String(parsed.data.quantity) : undefined,
          unitOfMeasure: parsed.data.unitOfMeasure,
          grossWeight: parsed.data.grossWeight !== undefined ? String(parsed.data.grossWeight) : undefined,
          tareWeight: parsed.data.tareWeight !== undefined ? String(parsed.data.tareWeight) : undefined,
          netWeight,
          tipFee: parsed.data.tipFee !== undefined ? String(parsed.data.tipFee) : undefined,
          environmentalLevy: parsed.data.environmentalLevy !== undefined ? String(parsed.data.environmentalLevy) : undefined,
          aiConfidence: parsed.data.aiConfidence,
          aiProcessed: parsed.data.aiConfidence !== undefined,
          notes: parsed.data.notes,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "docket",
        entityId: created?.id,
        newData: created,
      });

      return reply.status(201).send({ success: true, data: created });
    },
  );

  /**
   * PUT /api/v1/dockets/:id — Update a docket
   */
  app.put(
    "/:id",
    { preHandler: requirePermission("manage:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      const bodyParsed = updateDocketSchema.safeParse(request.body);
      if (!paramsParsed.success || !bodyParsed.success) {
        return reply.status(400).send({ error: "Validation failed", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(dockets)
        .where(and(eq(dockets.id, paramsParsed.data.id), isNull(dockets.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "Docket not found", code: "NOT_FOUND" });
      }

      if (existing.status === "filed") {
        return reply.status(400).send({ error: "Cannot edit a filed docket", code: "DOCKET_FILED" });
      }

      const updateData: Record<string, unknown> = { ...bodyParsed.data, updatedAt: new Date() };

      // Recalculate net weight
      const grossWeight = bodyParsed.data.grossWeight ?? (existing.grossWeight ? parseFloat(existing.grossWeight) : undefined);
      const tareWeight = bodyParsed.data.tareWeight ?? (existing.tareWeight ? parseFloat(existing.tareWeight) : undefined);

      if (grossWeight !== undefined && tareWeight !== undefined) {
        updateData.netWeight = String(Math.max(0, grossWeight - tareWeight));
      }

      if (bodyParsed.data.grossWeight !== undefined) updateData.grossWeight = String(bodyParsed.data.grossWeight);
      if (bodyParsed.data.tareWeight !== undefined) updateData.tareWeight = String(bodyParsed.data.tareWeight);
      if (bodyParsed.data.quantity !== undefined) updateData.quantity = String(bodyParsed.data.quantity);
      if (bodyParsed.data.tipFee !== undefined) updateData.tipFee = String(bodyParsed.data.tipFee);
      if (bodyParsed.data.environmentalLevy !== undefined) updateData.environmentalLevy = String(bodyParsed.data.environmentalLevy);

      const [updated] = await ctx.tenantDb
        .update(dockets)
        .set(updateData)
        .where(eq(dockets.id, paramsParsed.data.id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "docket",
        entityId: paramsParsed.data.id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/dockets/:id — Soft-delete a docket
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
        .from(dockets)
        .where(and(eq(dockets.id, parsed.data.id), isNull(dockets.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "Docket not found", code: "NOT_FOUND" });
      }

      await ctx.tenantDb
        .update(dockets)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(dockets.id, parsed.data.id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "docket",
        entityId: parsed.data.id,
      });

      return { success: true, data: { id: parsed.data.id } };
    },
  );

  // ── Docket Status Transitions ──

  /**
   * POST /api/v1/dockets/:id/transition — Transition docket status
   */
  app.post(
    "/:id/transition",
    { preHandler: requirePermission("manage:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      const bodyParsed = docketStatusTransitionSchema.safeParse(request.body);
      if (!paramsParsed.success || !bodyParsed.success) {
        return reply.status(400).send({ error: "Validation failed", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(dockets)
        .where(and(eq(dockets.id, paramsParsed.data.id), isNull(dockets.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "Docket not found", code: "NOT_FOUND" });
      }

      if (!isValidDocketTransition(existing.status, bodyParsed.data.status)) {
        return reply.status(400).send({
          error: `Cannot transition from ${existing.status} to ${bodyParsed.data.status}`,
          code: "INVALID_TRANSITION",
        });
      }

      const [updated] = await ctx.tenantDb
        .update(dockets)
        .set({ status: bodyParsed.data.status, updatedAt: new Date() })
        .where(eq(dockets.id, paramsParsed.data.id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "docket",
        entityId: paramsParsed.data.id,
        previousData: { status: existing.status },
        newData: { status: bodyParsed.data.status },
      });

      return { success: true, data: updated };
    },
  );

  // ── Reconciliation ──

  /**
   * POST /api/v1/dockets/:id/reconcile — Reconcile a docket against its matched daysheet
   */
  app.post(
    "/:id/reconcile",
    { preHandler: requirePermission("manage:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [docket] = await ctx.tenantDb
        .select()
        .from(dockets)
        .where(and(eq(dockets.id, paramsParsed.data.id), isNull(dockets.deletedAt)));

      if (!docket) {
        return reply.status(404).send({ error: "Docket not found", code: "NOT_FOUND" });
      }

      if (!docket.daysheetId) {
        return reply.status(400).send({
          error: "Docket must be matched to a daysheet before reconciliation",
          code: "DOCKET_NOT_MATCHED",
        });
      }

      const [daysheet] = await ctx.tenantDb
        .select()
        .from(daysheets)
        .where(eq(daysheets.id, docket.daysheetId));

      if (!daysheet) {
        return reply.status(404).send({ error: "Matched daysheet not found", code: "DAYSHEET_NOT_FOUND" });
      }

      const result = reconcileDocketWithDaysheet(
        {
          totalNetWeight: daysheet.totalNetWeight ? parseFloat(daysheet.totalNetWeight) : undefined,
          totalGrossWeight: daysheet.totalGrossWeight ? parseFloat(daysheet.totalGrossWeight) : undefined,
          totalTareWeight: daysheet.totalTareWeight ? parseFloat(daysheet.totalTareWeight) : undefined,
          totalQuantity: daysheet.totalQuantity ? parseFloat(daysheet.totalQuantity) : undefined,
          loadCount: daysheet.loadCount ?? undefined,
        },
        {
          netWeight: docket.netWeight ? parseFloat(docket.netWeight) : undefined,
          grossWeight: docket.grossWeight ? parseFloat(docket.grossWeight) : undefined,
          tareWeight: docket.tareWeight ? parseFloat(docket.tareWeight) : undefined,
          quantity: docket.quantity ? parseFloat(docket.quantity) : undefined,
        },
      );

      // Update docket with reconciliation result
      await ctx.tenantDb
        .update(dockets)
        .set({
          status: "reconciled",
          hasDiscrepancy: result.hasDiscrepancy,
          discrepancyNotes: result.discrepancyNotes || null,
          updatedAt: new Date(),
        })
        .where(eq(dockets.id, docket.id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "docket",
        entityId: docket.id,
        newData: { status: "reconciled", hasDiscrepancy: result.hasDiscrepancy },
      });

      return { success: true, data: result };
    },
  );

  // ── Overage Approval ──

  /**
   * GET /api/v1/dockets/overages — List all overages (for the overage approval dashboard)
   */
  app.get(
    "/overages",
    { preHandler: requirePermission("approve:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const querySchema = paginationQuerySchema.extend({
        approvalStatus: z.string().optional(),
        severity: z.string().optional(),
        driverId: z.uuid().optional(),
        assetId: z.uuid().optional(),
      });

      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", code: "VALIDATION_ERROR" });
      }

      const conditions = [];
      if (parsed.data.approvalStatus) conditions.push(eq(overages.approvalStatus, parsed.data.approvalStatus));
      if (parsed.data.severity) conditions.push(eq(overages.severity, parsed.data.severity));
      if (parsed.data.driverId) conditions.push(eq(overages.driverId, parsed.data.driverId));
      if (parsed.data.assetId) conditions.push(eq(overages.assetId, parsed.data.assetId));

      if (parsed.data.cursor) {
        conditions.push(sql`${overages.id} < ${parsed.data.cursor}`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await ctx.tenantDb
        .select()
        .from(overages)
        .where(whereClause)
        .orderBy(desc(overages.createdAt))
        .limit(parsed.data.limit + 1);

      const hasMore = rows.length > parsed.data.limit;
      const data = hasMore ? rows.slice(0, parsed.data.limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(overages)
        .where(whereClause);

      return {
        success: true,
        data: { data, nextCursor, hasMore, total: countResult?.count ?? 0 },
      };
    },
  );

  /**
   * POST /api/v1/dockets/overages/:id/decision — Approve or reject an overage
   */
  app.post(
    "/overages/:id/decision",
    { preHandler: requirePermission("approve:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      const bodyParsed = overageDecisionSchema.safeParse(request.body);
      if (!paramsParsed.success || !bodyParsed.success) {
        return reply.status(400).send({ error: "Validation failed", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(overages)
        .where(eq(overages.id, paramsParsed.data.id));

      if (!existing) {
        return reply.status(404).send({ error: "Overage not found", code: "NOT_FOUND" });
      }

      if (existing.approvalStatus !== "pending") {
        return reply.status(400).send({
          error: `Overage already ${existing.approvalStatus}`,
          code: "OVERAGE_ALREADY_DECIDED",
        });
      }

      const [updated] = await ctx.tenantDb
        .update(overages)
        .set({
          approvalStatus: bodyParsed.data.approvalStatus,
          approvedBy: ctx.userName,
          approvedAt: new Date(),
          approvalNotes: bodyParsed.data.approvalNotes,
        })
        .where(eq(overages.id, paramsParsed.data.id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "overage",
        entityId: paramsParsed.data.id,
        previousData: { approvalStatus: existing.approvalStatus },
        newData: { approvalStatus: bodyParsed.data.approvalStatus },
      });

      return { success: true, data: updated };
    },
  );

  // ── Charges ──

  /**
   * GET /api/v1/dockets/charges — List charges (for invoicing pipeline)
   */
  app.get(
    "/charges",
    { preHandler: requirePermission("view:dockets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const querySchema = paginationQuerySchema.extend({
        status: z.string().optional(),
        jobId: z.uuid().optional(),
        daysheetId: z.uuid().optional(),
      });

      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", code: "VALIDATION_ERROR" });
      }

      const { charges: chargesTable } = await import("../db/schema/tenant.js");
      const conditions = [];
      if (parsed.data.status) conditions.push(eq(chargesTable.status, parsed.data.status));
      if (parsed.data.jobId) conditions.push(eq(chargesTable.jobId, parsed.data.jobId));
      if (parsed.data.daysheetId) conditions.push(eq(chargesTable.daysheetId, parsed.data.daysheetId));

      if (parsed.data.cursor) {
        conditions.push(sql`${chargesTable.id} < ${parsed.data.cursor}`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await ctx.tenantDb
        .select()
        .from(chargesTable)
        .where(whereClause)
        .orderBy(desc(chargesTable.createdAt))
        .limit(parsed.data.limit + 1);

      const hasMore = rows.length > parsed.data.limit;
      const data = hasMore ? rows.slice(0, parsed.data.limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

      return {
        success: true,
        data: { data, nextCursor, hasMore },
      };
    },
  );
}
