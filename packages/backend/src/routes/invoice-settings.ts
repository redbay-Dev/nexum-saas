import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  invoiceSequences,
  customerInvoiceSettings,
  contractorPaymentSettings,
  companies,
  auditLog,
} from "../db/schema/tenant.js";
import {
  updateInvoiceSequenceSchema,
  updateCustomerInvoiceSettingsSchema,
  updateContractorPaymentSettingsSchema,
} from "@nexum/shared";
import { z } from "zod";

export async function invoiceSettingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ── Sequences ──

  app.get(
    "/sequences",
    { preHandler: requirePermission("view:invoicing") },
    async (request: FastifyRequest) => {
      const ctx = tenant(request);
      const sequences = await ctx.tenantDb
        .select()
        .from(invoiceSequences)
        .orderBy(invoiceSequences.sequenceType);

      return { success: true, data: sequences };
    },
  );

  app.put(
    "/sequences/:id",
    { preHandler: requirePermission("manage:invoicing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = z.object({ id: z.uuid() }).safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateInvoiceSequenceSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid data", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(invoiceSequences)
        .where(eq(invoiceSequences.id, paramsParsed.data.id));

      if (!existing) {
        return reply.status(404).send({ error: "Sequence not found", code: "NOT_FOUND" });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (bodyParsed.data.prefix !== undefined) updateData.prefix = bodyParsed.data.prefix;
      if (bodyParsed.data.suffix !== undefined) updateData.suffix = bodyParsed.data.suffix;
      if (bodyParsed.data.nextNumber !== undefined) updateData.nextNumber = bodyParsed.data.nextNumber;
      if (bodyParsed.data.minDigits !== undefined) updateData.minDigits = bodyParsed.data.minDigits;

      const [updated] = await ctx.tenantDb
        .update(invoiceSequences)
        .set(updateData)
        .where(eq(invoiceSequences.id, paramsParsed.data.id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "invoice_sequence",
        entityId: paramsParsed.data.id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  // ── Customer Invoice Settings ──

  app.get(
    "/customer/:companyId",
    { preHandler: requirePermission("view:invoicing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = z.object({ companyId: z.uuid() }).safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [settings] = await ctx.tenantDb
        .select()
        .from(customerInvoiceSettings)
        .where(eq(customerInvoiceSettings.companyId, parsed.data.companyId));

      return { success: true, data: settings ?? null };
    },
  );

  app.put(
    "/customer/:companyId",
    { preHandler: requirePermission("manage:invoicing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = z.object({ companyId: z.uuid() }).safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateCustomerInvoiceSettingsSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid data", code: "VALIDATION_ERROR" });
      }

      // Verify company exists
      const [company] = await ctx.tenantDb
        .select()
        .from(companies)
        .where(and(eq(companies.id, paramsParsed.data.companyId), isNull(companies.deletedAt)));

      if (!company) {
        return reply.status(404).send({ error: "Company not found", code: "NOT_FOUND" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(customerInvoiceSettings)
        .where(eq(customerInvoiceSettings.companyId, paramsParsed.data.companyId));

      const now = new Date();
      const updateData: Record<string, unknown> = { updatedAt: now };
      if (bodyParsed.data.invoiceSchedule !== undefined) updateData.invoiceSchedule = bodyParsed.data.invoiceSchedule;
      if (bodyParsed.data.invoiceGrouping !== undefined) updateData.invoiceGrouping = bodyParsed.data.invoiceGrouping;
      if (bodyParsed.data.scheduleDayOfWeek !== undefined) updateData.scheduleDayOfWeek = bodyParsed.data.scheduleDayOfWeek;
      if (bodyParsed.data.scheduleDayOfMonth !== undefined) updateData.scheduleDayOfMonth = bodyParsed.data.scheduleDayOfMonth;
      if (bodyParsed.data.paymentTermsDays !== undefined) updateData.paymentTermsDays = bodyParsed.data.paymentTermsDays;
      if (bodyParsed.data.creditLimit !== undefined) updateData.creditLimit = bodyParsed.data.creditLimit !== null ? String(bodyParsed.data.creditLimit) : null;
      if (bodyParsed.data.creditWarningPercent !== undefined) updateData.creditWarningPercent = bodyParsed.data.creditWarningPercent;
      if (bodyParsed.data.creditStop !== undefined) updateData.creditStop = bodyParsed.data.creditStop;
      if (bodyParsed.data.creditStopReason !== undefined) updateData.creditStopReason = bodyParsed.data.creditStopReason;

      let result;
      if (existing) {
        [result] = await ctx.tenantDb
          .update(customerInvoiceSettings)
          .set(updateData)
          .where(eq(customerInvoiceSettings.id, existing.id))
          .returning();
      } else {
        [result] = await ctx.tenantDb.insert(customerInvoiceSettings).values({
          companyId: paramsParsed.data.companyId,
          ...updateData,
        }).returning();
      }

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: existing ? "UPDATE" : "CREATE",
        entityType: "customer_invoice_settings",
        entityId: paramsParsed.data.companyId,
        previousData: existing ?? undefined,
        newData: result,
      });

      return { success: true, data: result };
    },
  );

  // ── Contractor Payment Settings ──

  app.get(
    "/contractor/:companyId",
    { preHandler: requirePermission("view:rcti") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = z.object({ companyId: z.uuid() }).safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [settings] = await ctx.tenantDb
        .select()
        .from(contractorPaymentSettings)
        .where(eq(contractorPaymentSettings.companyId, parsed.data.companyId));

      return { success: true, data: settings ?? null };
    },
  );

  app.put(
    "/contractor/:companyId",
    { preHandler: requirePermission("manage:rcti") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = z.object({ companyId: z.uuid() }).safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateContractorPaymentSettingsSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid data", code: "VALIDATION_ERROR" });
      }

      const [company] = await ctx.tenantDb
        .select()
        .from(companies)
        .where(and(eq(companies.id, paramsParsed.data.companyId), isNull(companies.deletedAt)));

      if (!company) {
        return reply.status(404).send({ error: "Company not found", code: "NOT_FOUND" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(contractorPaymentSettings)
        .where(eq(contractorPaymentSettings.companyId, paramsParsed.data.companyId));

      const now = new Date();
      const updateData: Record<string, unknown> = { updatedAt: now };
      if (bodyParsed.data.paymentFrequency !== undefined) updateData.paymentFrequency = bodyParsed.data.paymentFrequency;
      if (bodyParsed.data.paymentDay1 !== undefined) updateData.paymentDay1 = bodyParsed.data.paymentDay1;
      if (bodyParsed.data.paymentDay2 !== undefined) updateData.paymentDay2 = bodyParsed.data.paymentDay2;
      if (bodyParsed.data.cutoffTime !== undefined) updateData.cutoffTime = bodyParsed.data.cutoffTime;
      if (bodyParsed.data.paymentTermsDays !== undefined) updateData.paymentTermsDays = bodyParsed.data.paymentTermsDays;
      if (bodyParsed.data.gstInclusive !== undefined) updateData.gstInclusive = bodyParsed.data.gstInclusive;
      if (bodyParsed.data.requireApproval !== undefined) updateData.requireApproval = bodyParsed.data.requireApproval;

      let result;
      if (existing) {
        [result] = await ctx.tenantDb
          .update(contractorPaymentSettings)
          .set(updateData)
          .where(eq(contractorPaymentSettings.id, existing.id))
          .returning();
      } else {
        [result] = await ctx.tenantDb.insert(contractorPaymentSettings).values({
          companyId: paramsParsed.data.companyId,
          ...updateData,
        }).returning();
      }

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: existing ? "UPDATE" : "CREATE",
        entityType: "contractor_payment_settings",
        entityId: paramsParsed.data.companyId,
        previousData: existing ?? undefined,
        newData: result,
      });

      return { success: true, data: result };
    },
  );
}
