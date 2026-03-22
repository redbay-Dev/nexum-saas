import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, ilike, or, sql, desc, inArray } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  invoices,
  invoiceLineItems,
  charges,
  jobs,
  companies,
  projects,
  invoiceSequences,
  arApprovals,
  payments,
  auditLog,
} from "../db/schema/tenant.js";
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  invoiceStatusTransitionSchema,
  verifyInvoiceSchema,
  rejectInvoiceSchema,
  arApprovalDecisionSchema,
  batchArApprovalSchema,
  createPaymentSchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";
import { generateNextNumber } from "../services/invoice-number.js";
import {
  buildInvoiceLineItems,
  calculateInvoiceTotals,
} from "../services/invoice-builder.js";
import {
  isValidInvoiceTransition,
  isInvoiceImmutable,
} from "../services/invoice-status.js";

const invoiceListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  status: z.string().optional(),
  customerId: z.uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  overdue: z.string().optional(),
});

type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;

export async function invoiceRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ══════════════════════════════════════════════════
  // ── AR Approval Queue ──
  // ══════════════════════════════════════════════════

  /**
   * GET /api/v1/invoices/ar-queue — List jobs pending AR approval
   */
  app.get(
    "/ar-queue",
    { preHandler: requirePermission("approve:invoicing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = paginationQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", code: "VALIDATION_ERROR" });
      }

      const limit = parsed.data.limit;

      // Find completed jobs with processed daysheets that don't have an AR approval yet
      const conditions = [
        isNull(jobs.deletedAt),
        eq(jobs.status, "completed"),
      ];

      if (parsed.data.cursor) {
        conditions.push(sql`${jobs.id} < ${parsed.data.cursor}`);
      }

      const rows = await ctx.tenantDb
        .select({
          job: jobs,
          customerName: companies.name,
          projectName: projects.name,
          arStatus: arApprovals.status,
        })
        .from(jobs)
        .leftJoin(companies, eq(jobs.customerId, companies.id))
        .leftJoin(projects, eq(jobs.projectId, projects.id))
        .leftJoin(arApprovals, eq(jobs.id, arApprovals.jobId))
        .where(and(...conditions))
        .orderBy(desc(jobs.updatedAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.job.id ?? null : null;

      const flatData = data.map((row) => ({
        ...row.job,
        customerName: row.customerName,
        projectName: row.projectName,
        arStatus: row.arStatus ?? "pending",
      }));

      return { success: true, data: { data: flatData, nextCursor, hasMore } };
    },
  );

  /**
   * POST /api/v1/invoices/ar-approve/:jobId — Approve a job for invoicing
   */
  app.post(
    "/ar-approve/:jobId",
    { preHandler: requirePermission("approve:invoicing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = z.object({ jobId: z.uuid() }).safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid job ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = arApprovalDecisionSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid decision", code: "VALIDATION_ERROR" });
      }

      const { jobId } = paramsParsed.data;
      const { decision, notes } = bodyParsed.data;

      // Check job exists
      const [job] = await ctx.tenantDb
        .select()
        .from(jobs)
        .where(and(eq(jobs.id, jobId), isNull(jobs.deletedAt)));

      if (!job) {
        return reply.status(404).send({ error: "Job not found", code: "NOT_FOUND" });
      }

      // Upsert AR approval
      const [existing] = await ctx.tenantDb
        .select()
        .from(arApprovals)
        .where(eq(arApprovals.jobId, jobId));

      const now = new Date();

      if (existing) {
        await ctx.tenantDb
          .update(arApprovals)
          .set({
            status: decision,
            approvedBy: decision === "approved" ? ctx.userId : null,
            approvedAt: decision === "approved" ? now : null,
            rejectedBy: decision === "rejected" ? ctx.userId : null,
            rejectedAt: decision === "rejected" ? now : null,
            rejectionNotes: decision === "rejected" ? (notes ?? null) : null,
            updatedAt: now,
          })
          .where(eq(arApprovals.id, existing.id));
      } else {
        await ctx.tenantDb.insert(arApprovals).values({
          jobId,
          status: decision,
          approvedBy: decision === "approved" ? ctx.userId : null,
          approvedAt: decision === "approved" ? now : null,
          rejectedBy: decision === "rejected" ? ctx.userId : null,
          rejectedAt: decision === "rejected" ? now : null,
          rejectionNotes: decision === "rejected" ? (notes ?? null) : null,
        });
      }

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "ar_approval",
        entityId: jobId,
        newData: { decision, notes },
      });

      return { success: true, data: { jobId, status: decision } };
    },
  );

  /**
   * POST /api/v1/invoices/ar-batch-approve — Batch approve jobs
   */
  app.post(
    "/ar-batch-approve",
    { preHandler: requirePermission("approve:invoicing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = batchArApprovalSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid request", code: "VALIDATION_ERROR" });
      }

      const now = new Date();
      let approved = 0;

      for (const jobId of parsed.data.jobIds) {
        const [existing] = await ctx.tenantDb
          .select()
          .from(arApprovals)
          .where(eq(arApprovals.jobId, jobId));

        if (existing) {
          await ctx.tenantDb
            .update(arApprovals)
            .set({ status: "approved", approvedBy: ctx.userId, approvedAt: now, updatedAt: now })
            .where(eq(arApprovals.id, existing.id));
        } else {
          await ctx.tenantDb.insert(arApprovals).values({
            jobId,
            status: "approved",
            approvedBy: ctx.userId,
            approvedAt: now,
          });
        }
        approved++;
      }

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "ar_approval",
        newData: { batchApproved: approved, jobIds: parsed.data.jobIds },
      });

      return { success: true, data: { approved } };
    },
  );

  // ══════════════════════════════════════════════════
  // ── Invoice CRUD ──
  // ══════════════════════════════════════════════════

  /**
   * GET /api/v1/invoices — List invoices with filters
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:invoicing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = invoiceListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", code: "VALIDATION_ERROR" });
      }

      const query: InvoiceListQuery = parsed.data;
      const limit = query.limit;

      const conditions = [isNull(invoices.deletedAt)];

      if (query.status) conditions.push(eq(invoices.status, query.status));
      if (query.customerId) conditions.push(eq(invoices.customerId, query.customerId));
      if (query.dateFrom) conditions.push(sql`${invoices.issueDate} >= ${query.dateFrom}`);
      if (query.dateTo) conditions.push(sql`${invoices.issueDate} <= ${query.dateTo}`);
      if (query.overdue === "true") conditions.push(eq(invoices.status, "overdue"));

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(
          or(
            ilike(invoices.invoiceNumber, searchPattern),
            ilike(invoices.notes, searchPattern),
          ) ?? sql`TRUE`,
        );
      }

      if (query.cursor) {
        conditions.push(sql`${invoices.id} < ${query.cursor}`);
      }

      const rows = await ctx.tenantDb
        .select({
          invoice: invoices,
          customerName: companies.name,
        })
        .from(invoices)
        .leftJoin(companies, eq(invoices.customerId, companies.id))
        .where(and(...conditions))
        .orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.invoice.id ?? null : null;

      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(invoices)
        .where(and(isNull(invoices.deletedAt)));

      const flatData = data.map((row) => ({
        ...row.invoice,
        customerName: row.customerName,
      }));

      return {
        success: true,
        data: { data: flatData, nextCursor, hasMore, total: countResult?.count ?? 0 },
      };
    },
  );

  /**
   * GET /api/v1/invoices/:id — Invoice detail with line items and payments
   */
  app.get(
    "/:id",
    { preHandler: requirePermission("view:invoicing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [invoice] = await ctx.tenantDb
        .select({
          invoice: invoices,
          customerName: companies.name,
          customerAbn: companies.abn,
          projectName: projects.name,
        })
        .from(invoices)
        .leftJoin(companies, eq(invoices.customerId, companies.id))
        .leftJoin(projects, eq(invoices.projectId, projects.id))
        .where(and(eq(invoices.id, parsed.data.id), isNull(invoices.deletedAt)));

      if (!invoice) {
        return reply.status(404).send({ error: "Invoice not found", code: "NOT_FOUND" });
      }

      const lines = await ctx.tenantDb
        .select()
        .from(invoiceLineItems)
        .where(eq(invoiceLineItems.invoiceId, parsed.data.id))
        .orderBy(invoiceLineItems.lineNumber);

      const invoicePayments = await ctx.tenantDb
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, parsed.data.id))
        .orderBy(desc(payments.createdAt));

      return {
        success: true,
        data: {
          ...invoice.invoice,
          customerName: invoice.customerName,
          customerAbn: invoice.customerAbn,
          projectName: invoice.projectName,
          lineItems: lines,
          payments: invoicePayments,
        },
      };
    },
  );

  /**
   * POST /api/v1/invoices — Create invoice from approved charges
   */
  app.post(
    "/",
    { preHandler: requirePermission("manage:invoicing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = createInvoiceSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid invoice data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { customerId, chargeIds, issueDate, dueDate, groupingMode, projectId, poNumber, notes, internalNotes } = parsed.data;

      // Verify customer exists
      const [customer] = await ctx.tenantDb
        .select()
        .from(companies)
        .where(and(eq(companies.id, customerId), isNull(companies.deletedAt)));

      if (!customer) {
        return reply.status(404).send({ error: "Customer not found", code: "NOT_FOUND" });
      }

      // Fetch charges and verify they belong to this customer and are approved
      const chargeRows = await ctx.tenantDb
        .select()
        .from(charges)
        .where(and(
          inArray(charges.id, chargeIds),
          eq(charges.lineType, "revenue"),
          eq(charges.status, "approved"),
          isNull(charges.invoiceId),
        ));

      if (chargeRows.length === 0) {
        return reply.status(400).send({
          error: "No approved, uninvoiced revenue charges found for the given IDs",
          code: "NO_CHARGES",
        });
      }

      // Generate invoice number
      const [sequence] = await ctx.tenantDb
        .select()
        .from(invoiceSequences)
        .where(eq(invoiceSequences.sequenceType, "invoice"));

      if (!sequence) {
        return reply.status(500).send({ error: "Invoice sequence not configured", code: "SEQUENCE_ERROR" });
      }

      const { formatted: invoiceNumber, nextValue } = generateNextNumber({
        prefix: sequence.prefix,
        suffix: sequence.suffix,
        nextNumber: sequence.nextNumber,
        minDigits: sequence.minDigits,
      });

      // Update sequence
      await ctx.tenantDb
        .update(invoiceSequences)
        .set({ nextNumber: nextValue, updatedAt: new Date() })
        .where(eq(invoiceSequences.id, sequence.id));

      // Fetch jobs for line item building
      const jobIds = [...new Set(chargeRows.map((c) => c.jobId))];
      const jobRows = await ctx.tenantDb
        .select({
          id: jobs.id,
          jobNumber: jobs.jobNumber,
          poNumber: jobs.poNumber,
          projectId: jobs.projectId,
          customerId: jobs.customerId,
        })
        .from(jobs)
        .where(inArray(jobs.id, jobIds));

      // Build line items
      const chargeInputs = chargeRows.map((c) => ({
        id: c.id,
        jobId: c.jobId,
        partyId: c.partyId,
        partyName: c.partyName,
        category: c.category,
        description: c.description,
        rateType: c.rateType,
        quantity: c.quantity,
        unitRate: c.unitRate,
        total: c.total,
        lineType: c.lineType,
        daysheetId: c.daysheetId,
      }));

      const jobInfos = jobRows.map((j) => ({
        id: j.id,
        jobNumber: j.jobNumber,
        poNumber: j.poNumber,
        projectId: j.projectId,
        customerId: j.customerId,
      }));

      const lineItemInputs = buildInvoiceLineItems(chargeInputs, jobInfos);
      const totals = calculateInvoiceTotals(lineItemInputs);

      // Calculate due date from payment terms if not provided
      const calculatedDueDate = dueDate ?? calculateDueDate(issueDate, 30);

      // Create invoice
      const [newInvoice] = await ctx.tenantDb.insert(invoices).values({
        invoiceNumber,
        customerId,
        status: "draft",
        issueDate,
        dueDate: calculatedDueDate,
        subtotal: String(totals.subtotal),
        total: String(totals.total),
        groupingMode: groupingMode ?? null,
        projectId: projectId ?? null,
        poNumber: poNumber ?? null,
        notes: notes ?? null,
        internalNotes: internalNotes ?? null,
        pricingSnapshot: { generatedAt: new Date().toISOString(), chargeCount: chargeRows.length },
      }).returning();

      if (!newInvoice) {
        return reply.status(500).send({ error: "Failed to create invoice", code: "CREATE_ERROR" });
      }

      // Insert line items
      for (let i = 0; i < lineItemInputs.length; i++) {
        const item = lineItemInputs[i];
        if (!item) continue;
        await ctx.tenantDb.insert(invoiceLineItems).values({
          invoiceId: newInvoice.id,
          lineNumber: i + 1,
          chargeId: item.chargeId,
          jobId: item.jobId,
          description: item.description,
          quantity: String(item.quantity),
          unitOfMeasure: item.unitOfMeasure,
          unitPrice: String(item.unitPrice),
          lineTotal: String(item.lineTotal),
          calculationMethod: item.calculationMethod,
          sourceJobNumber: item.sourceJobNumber,
          pricingSnapshot: item.pricingSnapshot,
          snapshotAt: new Date(),
        });
      }

      // Link charges to this invoice
      await ctx.tenantDb
        .update(charges)
        .set({ invoiceId: newInvoice.id, status: "invoiced", updatedAt: new Date() })
        .where(inArray(charges.id, chargeIds));

      // Audit log
      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "invoice",
        entityId: newInvoice.id,
        newData: { invoiceNumber, customerId, total: totals.total, lineCount: lineItemInputs.length },
      });

      return reply.status(201).send({ success: true, data: newInvoice });
    },
  );

  /**
   * PUT /api/v1/invoices/:id — Update draft invoice
   */
  app.put(
    "/:id",
    { preHandler: requirePermission("manage:invoicing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateInvoiceSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid data", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, paramsParsed.data.id), isNull(invoices.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "Invoice not found", code: "NOT_FOUND" });
      }

      if (isInvoiceImmutable(existing.status)) {
        return reply.status(400).send({
          error: `Cannot edit invoice in ${existing.status} status`,
          code: "INVOICE_IMMUTABLE",
        });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (bodyParsed.data.issueDate !== undefined) updateData.issueDate = bodyParsed.data.issueDate;
      if (bodyParsed.data.dueDate !== undefined) updateData.dueDate = bodyParsed.data.dueDate;
      if (bodyParsed.data.notes !== undefined) updateData.notes = bodyParsed.data.notes;
      if (bodyParsed.data.internalNotes !== undefined) updateData.internalNotes = bodyParsed.data.internalNotes;

      const [updated] = await ctx.tenantDb
        .update(invoices)
        .set(updateData)
        .where(eq(invoices.id, paramsParsed.data.id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "invoice",
        entityId: paramsParsed.data.id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/invoices/:id — Soft-delete draft invoice
   */
  app.delete(
    "/:id",
    { preHandler: requirePermission("manage:invoicing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, parsed.data.id), isNull(invoices.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "Invoice not found", code: "NOT_FOUND" });
      }

      if (existing.status !== "draft" && existing.status !== "rejected") {
        return reply.status(400).send({
          error: "Only draft or rejected invoices can be deleted",
          code: "INVALID_STATUS",
        });
      }

      // Unlink charges
      await ctx.tenantDb
        .update(charges)
        .set({ invoiceId: null, status: "approved", updatedAt: new Date() })
        .where(eq(charges.invoiceId, parsed.data.id));

      await ctx.tenantDb
        .update(invoices)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(invoices.id, parsed.data.id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "invoice",
        entityId: parsed.data.id,
      });

      return { success: true, data: { id: parsed.data.id } };
    },
  );

  // ══════════════════════════════════════════════════
  // ── Invoice Status Transitions ──
  // ══════════════════════════════════════════════════

  /**
   * POST /api/v1/invoices/:id/transition — Transition invoice status
   */
  app.post(
    "/:id/transition",
    { preHandler: requirePermission("manage:invoicing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = invoiceStatusTransitionSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid transition", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, paramsParsed.data.id), isNull(invoices.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "Invoice not found", code: "NOT_FOUND" });
      }

      const targetStatus = bodyParsed.data.status;
      if (!isValidInvoiceTransition(existing.status, targetStatus)) {
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
      }

      const [updated] = await ctx.tenantDb
        .update(invoices)
        .set(updateData)
        .where(eq(invoices.id, paramsParsed.data.id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "invoice",
        entityId: paramsParsed.data.id,
        previousData: { status: existing.status },
        newData: { status: targetStatus },
      });

      return { success: true, data: updated };
    },
  );

  /**
   * POST /api/v1/invoices/:id/verify — Mark invoice as verified
   */
  app.post(
    "/:id/verify",
    { preHandler: requirePermission("verify:invoicing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = verifyInvoiceSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid data", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, paramsParsed.data.id), isNull(invoices.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "Invoice not found", code: "NOT_FOUND" });
      }

      if (existing.status !== "draft") {
        return reply.status(400).send({
          error: "Only draft invoices can be verified",
          code: "INVALID_STATUS",
        });
      }

      const [updated] = await ctx.tenantDb
        .update(invoices)
        .set({
          status: "verified",
          verifiedBy: ctx.userId,
          verifiedAt: new Date(),
          verificationNotes: bodyParsed.data.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, paramsParsed.data.id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "invoice",
        entityId: paramsParsed.data.id,
        previousData: { status: "draft" },
        newData: { status: "verified", verifiedBy: ctx.userId },
      });

      return { success: true, data: updated };
    },
  );

  /**
   * POST /api/v1/invoices/:id/reject — Reject invoice back to operations
   */
  app.post(
    "/:id/reject",
    { preHandler: requirePermission("verify:invoicing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = rejectInvoiceSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Rejection reason is required",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, paramsParsed.data.id), isNull(invoices.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "Invoice not found", code: "NOT_FOUND" });
      }

      if (existing.status !== "draft" && existing.status !== "verified") {
        return reply.status(400).send({
          error: "Only draft or verified invoices can be rejected",
          code: "INVALID_STATUS",
        });
      }

      const [updated] = await ctx.tenantDb
        .update(invoices)
        .set({
          status: "rejected",
          rejectedBy: ctx.userId,
          rejectedAt: new Date(),
          rejectionReason: bodyParsed.data.reason,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, paramsParsed.data.id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "invoice",
        entityId: paramsParsed.data.id,
        previousData: { status: existing.status },
        newData: { status: "rejected", rejectedBy: ctx.userId, reason: bodyParsed.data.reason },
      });

      return { success: true, data: updated };
    },
  );

  // ══════════════════════════════════════════════════
  // ── Invoice Payments ──
  // ══════════════════════════════════════════════════

  /**
   * POST /api/v1/invoices/:id/payments — Record payment against invoice
   */
  app.post(
    "/:id/payments",
    { preHandler: requirePermission("manage:invoicing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = createPaymentSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid payment data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, paramsParsed.data.id), isNull(invoices.deletedAt)));

      if (!existing) {
        return reply.status(404).send({ error: "Invoice not found", code: "NOT_FOUND" });
      }

      if (existing.status !== "sent" && existing.status !== "partially_paid" && existing.status !== "overdue") {
        return reply.status(400).send({
          error: "Payments can only be recorded on sent, partially paid, or overdue invoices",
          code: "INVALID_STATUS",
        });
      }

      const [newPayment] = await ctx.tenantDb.insert(payments).values({
        invoiceId: paramsParsed.data.id,
        paymentDate: bodyParsed.data.paymentDate,
        amount: String(bodyParsed.data.amount),
        paymentMethod: bodyParsed.data.paymentMethod,
        referenceNumber: bodyParsed.data.referenceNumber ?? null,
        notes: bodyParsed.data.notes ?? null,
        createdBy: ctx.userId,
      }).returning();

      // Update invoice totals
      const newAmountPaid = parseFloat(existing.amountPaid) + bodyParsed.data.amount;
      const invoiceTotal = parseFloat(existing.total);
      const newStatus = newAmountPaid >= invoiceTotal ? "paid" : "partially_paid";

      const updateData: Record<string, unknown> = {
        amountPaid: String(Math.round(newAmountPaid * 100) / 100),
        status: newStatus,
        updatedAt: new Date(),
      };

      if (newStatus === "paid") {
        updateData.paidAt = new Date();
      }

      await ctx.tenantDb
        .update(invoices)
        .set(updateData)
        .where(eq(invoices.id, paramsParsed.data.id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "payment",
        entityId: newPayment?.id,
        newData: { invoiceId: paramsParsed.data.id, amount: bodyParsed.data.amount, newStatus },
      });

      return reply.status(201).send({ success: true, data: newPayment });
    },
  );
}

function calculateDueDate(issueDate: string, paymentTermsDays: number): string {
  const date = new Date(issueDate);
  date.setDate(date.getDate() + paymentTermsDays);
  return date.toISOString().slice(0, 10);
}
