import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, ilike, or, sql, desc, inArray } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  rctis,
  rctiLineItems,
  rctiBatches,
  charges,
  jobs,
  companies,
  daysheets,
  assets,
  invoiceSequences,
  payments,
  auditLog,
} from "../db/schema/tenant.js";
import {
  generateRctiSchema,
  batchGenerateRctisSchema,
  updateRctiSchema,
  rctiStatusTransitionSchema,
  approveRctiSchema,
  createRctiDeductionSchema,
  createPaymentSchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";
import { generateNextNumber } from "../services/invoice-number.js";
import { buildRctiLineItems, calculateRctiTotals } from "../services/rcti-builder.js";
import { isValidRctiTransition, isRctiImmutable } from "../services/rcti-status.js";

const rctiListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  status: z.string().optional(),
  contractorId: z.uuid().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
});

type RctiListQuery = z.infer<typeof rctiListQuerySchema>;

const subResourceParamSchema = z.object({
  id: z.uuid(),
  subId: z.uuid(),
});

export async function rctiRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ── List RCTIs ──

  app.get(
    "/",
    { preHandler: requirePermission("view:rcti") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = rctiListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", code: "VALIDATION_ERROR" });
      }

      const query: RctiListQuery = parsed.data;
      const limit = query.limit;
      const conditions = [isNull(rctis.deletedAt)];

      if (query.status) conditions.push(eq(rctis.status, query.status));
      if (query.contractorId) conditions.push(eq(rctis.contractorId, query.contractorId));
      if (query.periodStart) conditions.push(sql`${rctis.periodStart} >= ${query.periodStart}`);
      if (query.periodEnd) conditions.push(sql`${rctis.periodEnd} <= ${query.periodEnd}`);

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(
          or(
            ilike(rctis.rctiNumber, searchPattern),
            ilike(rctis.notes, searchPattern),
          ) ?? sql`TRUE`,
        );
      }

      if (query.cursor) {
        conditions.push(sql`${rctis.id} < ${query.cursor}`);
      }

      const rows = await ctx.tenantDb
        .select({
          rcti: rctis,
          contractorName: companies.name,
        })
        .from(rctis)
        .leftJoin(companies, eq(rctis.contractorId, companies.id))
        .where(and(...conditions))
        .orderBy(desc(rctis.periodEnd), desc(rctis.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.rcti.id ?? null : null;

      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(rctis)
        .where(and(isNull(rctis.deletedAt)));

      const flatData = data.map((row) => ({
        ...row.rcti,
        contractorName: row.contractorName,
      }));

      return {
        success: true,
        data: { data: flatData, nextCursor, hasMore, total: countResult?.count ?? 0 },
      };
    },
  );

  // ── RCTI Detail ──

  app.get(
    "/:id",
    { preHandler: requirePermission("view:rcti") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [rcti] = await ctx.tenantDb
        .select({
          rcti: rctis,
          contractorName: companies.name,
          contractorAbn: companies.abn,
        })
        .from(rctis)
        .leftJoin(companies, eq(rctis.contractorId, companies.id))
        .where(and(eq(rctis.id, parsed.data.id), isNull(rctis.deletedAt)));

      if (!rcti) {
        return reply.status(404).send({ error: "RCTI not found", code: "NOT_FOUND" });
      }

      const lines = await ctx.tenantDb
        .select()
        .from(rctiLineItems)
        .where(eq(rctiLineItems.rctiId, parsed.data.id))
        .orderBy(rctiLineItems.lineNumber);

      const rctiPayments = await ctx.tenantDb
        .select()
        .from(payments)
        .where(eq(payments.rctiId, parsed.data.id))
        .orderBy(desc(payments.createdAt));

      return {
        success: true,
        data: {
          ...rcti.rcti,
          contractorName: rcti.contractorName,
          contractorAbn: rcti.contractorAbn,
          lineItems: lines,
          payments: rctiPayments,
        },
      };
    },
  );

  // ── Generate RCTI ──

  app.post(
    "/generate",
    { preHandler: requirePermission("manage:rcti") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = generateRctiSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { contractorId, periodStart, periodEnd } = parsed.data;

      // Verify contractor exists
      const [contractor] = await ctx.tenantDb
        .select()
        .from(companies)
        .where(and(eq(companies.id, contractorId), isNull(companies.deletedAt)));

      if (!contractor) {
        return reply.status(404).send({ error: "Contractor not found", code: "NOT_FOUND" });
      }

      // Fetch cost charges for this contractor in the period
      const costCharges = await ctx.tenantDb
        .select()
        .from(charges)
        .where(and(
          eq(charges.lineType, "cost"),
          eq(charges.partyId, contractorId),
          eq(charges.status, "approved"),
          isNull(charges.rctiId),
          sql`EXISTS (
            SELECT 1 FROM daysheets ds
            WHERE ds.id = ${charges.daysheetId}
            AND ds.work_date >= ${periodStart}
            AND ds.work_date <= ${periodEnd}
          )`,
        ));

      if (costCharges.length === 0) {
        return reply.status(400).send({
          error: "No approved cost charges found for this contractor in the specified period",
          code: "NO_CHARGES",
        });
      }

      // Generate RCTI number
      const [sequence] = await ctx.tenantDb
        .select()
        .from(invoiceSequences)
        .where(eq(invoiceSequences.sequenceType, "rcti"));

      if (!sequence) {
        return reply.status(500).send({ error: "RCTI sequence not configured", code: "SEQUENCE_ERROR" });
      }

      const { formatted: rctiNumber, nextValue } = generateNextNumber({
        prefix: sequence.prefix,
        suffix: sequence.suffix,
        nextNumber: sequence.nextNumber,
        minDigits: sequence.minDigits,
      });

      await ctx.tenantDb
        .update(invoiceSequences)
        .set({ nextNumber: nextValue, updatedAt: new Date() })
        .where(eq(invoiceSequences.id, sequence.id));

      // Fetch jobs and daysheets for line item building
      const jobIds = [...new Set(costCharges.map((c) => c.jobId))];
      const daysheetIds = [...new Set(costCharges.map((c) => c.daysheetId))];

      const jobRows = await ctx.tenantDb
        .select({ id: jobs.id, jobNumber: jobs.jobNumber })
        .from(jobs)
        .where(inArray(jobs.id, jobIds));

      const daysheetRows = await ctx.tenantDb
        .select({
          id: daysheets.id,
          assetId: daysheets.assetId,
          assetRegistration: assets.registrationNumber,
        })
        .from(daysheets)
        .leftJoin(assets, eq(daysheets.assetId, assets.id))
        .where(inArray(daysheets.id, daysheetIds));

      // Build line items
      const chargeInputs = costCharges.map((c) => ({
        id: c.id,
        jobId: c.jobId,
        daysheetId: c.daysheetId,
        partyId: c.partyId,
        partyName: c.partyName,
        category: c.category,
        description: c.description,
        rateType: c.rateType,
        quantity: c.quantity,
        unitRate: c.unitRate,
        total: c.total,
      }));

      const lineItemInputs = buildRctiLineItems(
        chargeInputs,
        jobRows.map((j) => ({ id: j.id, jobNumber: j.jobNumber })),
        daysheetRows.map((d) => ({ id: d.id, assetId: d.assetId, assetRegistration: d.assetRegistration })),
      );

      const totals = calculateRctiTotals(lineItemInputs);

      // Create RCTI
      const [newRcti] = await ctx.tenantDb.insert(rctis).values({
        rctiNumber,
        contractorId,
        status: "draft",
        periodStart,
        periodEnd,
        subtotal: String(totals.subtotal),
        deductionsTotal: String(totals.deductionsTotal),
        total: String(totals.total),
      }).returning();

      if (!newRcti) {
        return reply.status(500).send({ error: "Failed to create RCTI", code: "CREATE_ERROR" });
      }

      // Insert line items
      for (let i = 0; i < lineItemInputs.length; i++) {
        const item = lineItemInputs[i];
        if (!item) continue;
        await ctx.tenantDb.insert(rctiLineItems).values({
          rctiId: newRcti.id,
          lineNumber: i + 1,
          lineType: item.lineType,
          chargeId: item.chargeId,
          jobId: item.jobId,
          daysheetId: item.daysheetId,
          description: item.description,
          quantity: String(item.quantity),
          unitOfMeasure: item.unitOfMeasure,
          unitPrice: String(item.unitPrice),
          lineTotal: String(item.lineTotal),
          deductionCategory: item.deductionCategory,
          deductionDetails: item.deductionDetails,
          assetRegistration: item.assetRegistration,
          materialName: item.materialName,
          sourceJobNumber: item.sourceJobNumber,
        });
      }

      // Link charges
      const chargeIds = costCharges.map((c) => c.id);
      await ctx.tenantDb
        .update(charges)
        .set({ rctiId: newRcti.id, status: "invoiced", updatedAt: new Date() })
        .where(inArray(charges.id, chargeIds));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "rcti",
        entityId: newRcti.id,
        newData: { rctiNumber, contractorId, total: totals.total, lineCount: lineItemInputs.length },
      });

      return reply.status(201).send({ success: true, data: newRcti });
    },
  );

  // ── Batch Generate RCTIs ──

  app.post(
    "/batch-generate",
    { preHandler: requirePermission("manage:rcti") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = batchGenerateRctisSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid data", code: "VALIDATION_ERROR" });
      }

      const { periodStart, periodEnd } = parsed.data;

      // Find all contractors with approved cost charges in this period
      const contractorsWithCharges = await ctx.tenantDb
        .select({
          contractorId: charges.partyId,
          contractorName: charges.partyName,
          chargeCount: sql<number>`count(*)::int`,
        })
        .from(charges)
        .where(and(
          eq(charges.lineType, "cost"),
          eq(charges.status, "approved"),
          isNull(charges.rctiId),
          sql`${charges.partyId} IS NOT NULL`,
          sql`EXISTS (
            SELECT 1 FROM daysheets ds
            WHERE ds.id = ${charges.daysheetId}
            AND ds.work_date >= ${periodStart}
            AND ds.work_date <= ${periodEnd}
          )`,
        ))
        .groupBy(charges.partyId, charges.partyName);

      if (contractorsWithCharges.length === 0) {
        return reply.status(400).send({
          error: "No contractors with approved charges in this period",
          code: "NO_CHARGES",
        });
      }

      // Create batch record
      const [batch] = await ctx.tenantDb.insert(rctiBatches).values({
        batchNumber: `BATCH-${periodStart}-${periodEnd}`,
        periodStart,
        periodEnd,
        contractorCount: contractorsWithCharges.length,
        generatedBy: ctx.userId,
      }).returning();

      return reply.status(201).send({
        success: true,
        data: {
          batch,
          contractorCount: contractorsWithCharges.length,
          contractors: contractorsWithCharges,
          message: `Found ${contractorsWithCharges.length} contractors with charges. Use POST /generate for each contractor.`,
        },
      });
    },
  );

  // ── Update RCTI ──

  app.put(
    "/:id",
    { preHandler: requirePermission("manage:rcti") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateRctiSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid data", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(rctis)
        .where(and(eq(rctis.id, paramsParsed.data.id), isNull(rctis.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "RCTI not found", code: "NOT_FOUND" });
      }

      if (isRctiImmutable(existing.status)) {
        return reply.status(400).send({
          error: `Cannot edit RCTI in ${existing.status} status`,
          code: "RCTI_IMMUTABLE",
        });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (bodyParsed.data.notes !== undefined) updateData.notes = bodyParsed.data.notes;
      if (bodyParsed.data.internalNotes !== undefined) updateData.internalNotes = bodyParsed.data.internalNotes;

      const [updated] = await ctx.tenantDb
        .update(rctis)
        .set(updateData)
        .where(eq(rctis.id, paramsParsed.data.id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "rcti",
        entityId: paramsParsed.data.id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  // ── Delete RCTI ──

  app.delete(
    "/:id",
    { preHandler: requirePermission("manage:rcti") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(rctis)
        .where(and(eq(rctis.id, parsed.data.id), isNull(rctis.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "RCTI not found", code: "NOT_FOUND" });
      }

      if (existing.status !== "draft") {
        return reply.status(400).send({
          error: "Only draft RCTIs can be deleted",
          code: "INVALID_STATUS",
        });
      }

      // Unlink charges
      await ctx.tenantDb
        .update(charges)
        .set({ rctiId: null, status: "approved", updatedAt: new Date() })
        .where(eq(charges.rctiId, parsed.data.id));

      await ctx.tenantDb
        .update(rctis)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(rctis.id, parsed.data.id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "rcti",
        entityId: parsed.data.id,
      });

      return { success: true, data: { id: parsed.data.id } };
    },
  );

  // ── Status Transition ──

  app.post(
    "/:id/transition",
    { preHandler: requirePermission("manage:rcti") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = rctiStatusTransitionSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid transition", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(rctis)
        .where(and(eq(rctis.id, paramsParsed.data.id), isNull(rctis.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "RCTI not found", code: "NOT_FOUND" });
      }

      const targetStatus = bodyParsed.data.status;
      if (!isValidRctiTransition(existing.status, targetStatus)) {
        return reply.status(400).send({
          error: `Cannot transition from ${existing.status} to ${targetStatus}`,
          code: "INVALID_TRANSITION",
        });
      }

      const updateData: Record<string, unknown> = {
        status: targetStatus,
        updatedAt: new Date(),
      };

      if (targetStatus === "sent") {
        updateData.sentAt = new Date();
        updateData.sentBy = ctx.userId;
      } else if (targetStatus === "cancelled") {
        updateData.cancelledAt = new Date();
        updateData.cancelledBy = ctx.userId;
        updateData.cancellationReason = bodyParsed.data.reason ?? null;
      } else if (targetStatus === "disputed") {
        updateData.disputedAt = new Date();
        updateData.disputeReason = bodyParsed.data.reason ?? null;
      }

      const [updated] = await ctx.tenantDb
        .update(rctis)
        .set(updateData)
        .where(eq(rctis.id, paramsParsed.data.id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "rcti",
        entityId: paramsParsed.data.id,
        previousData: { status: existing.status },
        newData: { status: targetStatus },
      });

      return { success: true, data: updated };
    },
  );

  // ── Approve RCTI ──

  app.post(
    "/:id/approve",
    { preHandler: requirePermission("approve:rcti") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = approveRctiSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid data", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(rctis)
        .where(and(eq(rctis.id, paramsParsed.data.id), isNull(rctis.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "RCTI not found", code: "NOT_FOUND" });
      }

      if (existing.status !== "ready" && existing.status !== "pending_approval") {
        return reply.status(400).send({
          error: "Only ready or pending_approval RCTIs can be approved",
          code: "INVALID_STATUS",
        });
      }

      const [updated] = await ctx.tenantDb
        .update(rctis)
        .set({
          status: "approved",
          approvedBy: ctx.userId,
          approvedAt: new Date(),
          approvalNotes: bodyParsed.data.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(rctis.id, paramsParsed.data.id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "rcti",
        entityId: paramsParsed.data.id,
        previousData: { status: existing.status },
        newData: { status: "approved", approvedBy: ctx.userId },
      });

      return { success: true, data: updated };
    },
  );

  // ── Add Deduction ──

  app.post(
    "/:id/deductions",
    { preHandler: requirePermission("manage:rcti") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = createRctiDeductionSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid deduction",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(rctis)
        .where(and(eq(rctis.id, paramsParsed.data.id), isNull(rctis.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "RCTI not found", code: "NOT_FOUND" });
      }

      if (isRctiImmutable(existing.status)) {
        return reply.status(400).send({
          error: `Cannot add deductions to RCTI in ${existing.status} status`,
          code: "RCTI_IMMUTABLE",
        });
      }

      // Get next line number
      const [maxLine] = await ctx.tenantDb
        .select({ maxNum: sql<number>`COALESCE(MAX(${rctiLineItems.lineNumber}), 0)::int` })
        .from(rctiLineItems)
        .where(eq(rctiLineItems.rctiId, paramsParsed.data.id));

      const nextLineNumber = (maxLine?.maxNum ?? 0) + 1;

      const [newLine] = await ctx.tenantDb.insert(rctiLineItems).values({
        rctiId: paramsParsed.data.id,
        lineNumber: nextLineNumber,
        lineType: "deduction",
        description: bodyParsed.data.description,
        quantity: "1",
        unitPrice: String(bodyParsed.data.amount),
        lineTotal: String(-bodyParsed.data.amount), // Negative for deductions
        deductionCategory: bodyParsed.data.deductionCategory,
        deductionDetails: bodyParsed.data.details ?? null,
      }).returning();

      // Recalculate totals
      const allLines = await ctx.tenantDb
        .select()
        .from(rctiLineItems)
        .where(eq(rctiLineItems.rctiId, paramsParsed.data.id));

      const lineInputs = allLines.map((l) => ({
        chargeId: l.chargeId,
        jobId: l.jobId,
        daysheetId: l.daysheetId,
        lineType: l.lineType as "charge" | "deduction",
        description: l.description,
        quantity: parseFloat(l.quantity),
        unitOfMeasure: l.unitOfMeasure,
        unitPrice: parseFloat(l.unitPrice),
        lineTotal: parseFloat(l.lineTotal),
        deductionCategory: l.deductionCategory,
        deductionDetails: l.deductionDetails,
        assetRegistration: l.assetRegistration,
        materialName: l.materialName,
        sourceJobNumber: l.sourceJobNumber,
      }));

      const totals = calculateRctiTotals(lineInputs);

      await ctx.tenantDb
        .update(rctis)
        .set({
          subtotal: String(totals.subtotal),
          deductionsTotal: String(totals.deductionsTotal),
          total: String(totals.total),
          updatedAt: new Date(),
        })
        .where(eq(rctis.id, paramsParsed.data.id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "rcti_deduction",
        entityId: newLine?.id,
        newData: bodyParsed.data,
      });

      return reply.status(201).send({ success: true, data: newLine });
    },
  );

  // ── Delete Deduction ──

  app.delete(
    "/:id/deductions/:subId",
    { preHandler: requirePermission("manage:rcti") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = subResourceParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid IDs", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(rctis)
        .where(and(eq(rctis.id, paramsParsed.data.id), isNull(rctis.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "RCTI not found", code: "NOT_FOUND" });
      }

      if (isRctiImmutable(existing.status)) {
        return reply.status(400).send({ error: "RCTI is immutable", code: "RCTI_IMMUTABLE" });
      }

      const [deduction] = await ctx.tenantDb
        .select()
        .from(rctiLineItems)
        .where(and(
          eq(rctiLineItems.id, paramsParsed.data.subId),
          eq(rctiLineItems.rctiId, paramsParsed.data.id),
          eq(rctiLineItems.lineType, "deduction"),
        ));

      if (!deduction) {
        return reply.status(404).send({ error: "Deduction not found", code: "NOT_FOUND" });
      }

      await ctx.tenantDb
        .delete(rctiLineItems)
        .where(eq(rctiLineItems.id, paramsParsed.data.subId));

      // Recalculate totals
      const allLines = await ctx.tenantDb
        .select()
        .from(rctiLineItems)
        .where(eq(rctiLineItems.rctiId, paramsParsed.data.id));

      const lineInputs = allLines.map((l) => ({
        chargeId: l.chargeId,
        jobId: l.jobId,
        daysheetId: l.daysheetId,
        lineType: l.lineType as "charge" | "deduction",
        description: l.description,
        quantity: parseFloat(l.quantity),
        unitOfMeasure: l.unitOfMeasure,
        unitPrice: parseFloat(l.unitPrice),
        lineTotal: parseFloat(l.lineTotal),
        deductionCategory: l.deductionCategory,
        deductionDetails: l.deductionDetails,
        assetRegistration: l.assetRegistration,
        materialName: l.materialName,
        sourceJobNumber: l.sourceJobNumber,
      }));

      const totals = calculateRctiTotals(lineInputs);

      await ctx.tenantDb
        .update(rctis)
        .set({
          subtotal: String(totals.subtotal),
          deductionsTotal: String(totals.deductionsTotal),
          total: String(totals.total),
          updatedAt: new Date(),
        })
        .where(eq(rctis.id, paramsParsed.data.id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "rcti_deduction",
        entityId: paramsParsed.data.subId,
      });

      return { success: true, data: { id: paramsParsed.data.subId } };
    },
  );

  // ── Record Payment ──

  app.post(
    "/:id/payments",
    { preHandler: requirePermission("manage:rcti") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = createPaymentSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid payment", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(rctis)
        .where(and(eq(rctis.id, paramsParsed.data.id), isNull(rctis.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "RCTI not found", code: "NOT_FOUND" });
      }

      if (existing.status !== "sent" && existing.status !== "partially_paid") {
        return reply.status(400).send({
          error: "Payments can only be recorded on sent or partially paid RCTIs",
          code: "INVALID_STATUS",
        });
      }

      const [newPayment] = await ctx.tenantDb.insert(payments).values({
        rctiId: paramsParsed.data.id,
        paymentDate: bodyParsed.data.paymentDate,
        amount: String(bodyParsed.data.amount),
        paymentMethod: bodyParsed.data.paymentMethod,
        referenceNumber: bodyParsed.data.referenceNumber ?? null,
        notes: bodyParsed.data.notes ?? null,
        createdBy: ctx.userId,
      }).returning();

      const newAmountPaid = parseFloat(existing.amountPaid) + bodyParsed.data.amount;
      const rctiTotal = parseFloat(existing.total);
      const newStatus = newAmountPaid >= rctiTotal ? "paid" : "partially_paid";

      const updateData: Record<string, unknown> = {
        amountPaid: String(Math.round(newAmountPaid * 100) / 100),
        status: newStatus,
        updatedAt: new Date(),
      };

      if (newStatus === "paid") {
        updateData.paidAt = new Date();
      }

      await ctx.tenantDb
        .update(rctis)
        .set(updateData)
        .where(eq(rctis.id, paramsParsed.data.id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "payment",
        entityId: newPayment?.id,
        newData: { rctiId: paramsParsed.data.id, amount: bodyParsed.data.amount, newStatus },
      });

      return reply.status(201).send({ success: true, data: newPayment });
    },
  );
}
