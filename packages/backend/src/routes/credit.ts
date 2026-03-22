import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  companies,
  customerInvoiceSettings,
  creditTransactions,
  auditLog,
} from "../db/schema/tenant.js";
import {
  creditCheckSchema,
  creditStopSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";
import { calculateCreditUsed, checkCreditAvailability } from "../services/credit-manager.js";

export async function creditRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/credit/dashboard — Credit monitoring dashboard
   */
  app.get(
    "/dashboard",
    { preHandler: requirePermission("view:credit") },
    async (request: FastifyRequest) => {
      const ctx = tenant(request);

      const customers = await ctx.tenantDb
        .select({
          company: companies,
          settings: customerInvoiceSettings,
        })
        .from(companies)
        .leftJoin(customerInvoiceSettings, eq(companies.id, customerInvoiceSettings.companyId))
        .where(and(
          eq(companies.isCustomer, true),
          isNull(companies.deletedAt),
        ))
        .orderBy(companies.name);

      const dashboard = [];

      for (const row of customers) {
        const txns = await ctx.tenantDb
          .select()
          .from(creditTransactions)
          .where(eq(creditTransactions.companyId, row.company.id));

        const creditUsed = calculateCreditUsed(txns.map((t) => ({
          transactionType: t.transactionType,
          amount: t.amount,
        })));

        const limitStr = row.settings?.creditLimit;
        const creditLimit = limitStr ? parseFloat(limitStr) : null;
        const check = checkCreditAvailability(creditLimit, creditUsed, 0);

        dashboard.push({
          companyId: row.company.id,
          companyName: row.company.name,
          creditLimit: check.creditLimit,
          creditUsed: check.creditUsed,
          creditAvailable: check.creditAvailable,
          utilizationPercent: check.utilizationPercent,
          creditStop: row.settings?.creditStop ?? false,
          creditStopReason: row.settings?.creditStopReason ?? null,
        });
      }

      return { success: true, data: dashboard };
    },
  );

  /**
   * GET /api/v1/credit/:companyId — Credit detail for a company
   */
  app.get(
    "/:companyId",
    { preHandler: requirePermission("view:credit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = z.object({ companyId: z.uuid() }).safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [company] = await ctx.tenantDb
        .select()
        .from(companies)
        .where(and(eq(companies.id, parsed.data.companyId), isNull(companies.deletedAt)));

      if (!company) {
        return reply.status(404).send({ error: "Company not found", code: "NOT_FOUND" });
      }

      const [settings] = await ctx.tenantDb
        .select()
        .from(customerInvoiceSettings)
        .where(eq(customerInvoiceSettings.companyId, parsed.data.companyId));

      const txns = await ctx.tenantDb
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.companyId, parsed.data.companyId));

      const creditUsed = calculateCreditUsed(txns.map((t) => ({
        transactionType: t.transactionType,
        amount: t.amount,
      })));

      const limitStr = settings?.creditLimit;
      const creditLimit = limitStr ? parseFloat(limitStr) : null;
      const check = checkCreditAvailability(creditLimit, creditUsed, 0);

      return {
        success: true,
        data: {
          company,
          settings,
          credit: check,
        },
      };
    },
  );

  /**
   * GET /api/v1/credit/:companyId/transactions — Credit transaction history
   */
  app.get(
    "/:companyId/transactions",
    { preHandler: requirePermission("view:credit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = z.object({ companyId: z.uuid() }).safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const queryParsed = paginationQuerySchema.safeParse(request.query);
      if (!queryParsed.success) {
        return reply.status(400).send({ error: "Invalid query", code: "VALIDATION_ERROR" });
      }

      const limit = queryParsed.data.limit;
      const conditions = [eq(creditTransactions.companyId, paramsParsed.data.companyId)];

      if (queryParsed.data.cursor) {
        conditions.push(sql`${creditTransactions.id} < ${queryParsed.data.cursor}`);
      }

      const rows = await ctx.tenantDb
        .select()
        .from(creditTransactions)
        .where(and(...conditions))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

      return { success: true, data: { data, nextCursor, hasMore } };
    },
  );

  /**
   * POST /api/v1/credit/:companyId/stop — Set credit stop
   */
  app.post(
    "/:companyId/stop",
    { preHandler: requirePermission("manage:credit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = z.object({ companyId: z.uuid() }).safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = creditStopSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Reason is required", code: "VALIDATION_ERROR" });
      }

      const [settings] = await ctx.tenantDb
        .select()
        .from(customerInvoiceSettings)
        .where(eq(customerInvoiceSettings.companyId, paramsParsed.data.companyId));

      const now = new Date();

      if (settings) {
        await ctx.tenantDb
          .update(customerInvoiceSettings)
          .set({
            creditStop: true,
            creditStopReason: bodyParsed.data.reason,
            creditStopBy: ctx.userId,
            creditStopAt: now,
            updatedAt: now,
          })
          .where(eq(customerInvoiceSettings.id, settings.id));
      } else {
        await ctx.tenantDb.insert(customerInvoiceSettings).values({
          companyId: paramsParsed.data.companyId,
          creditStop: true,
          creditStopReason: bodyParsed.data.reason,
          creditStopBy: ctx.userId,
          creditStopAt: now,
        });
      }

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "credit_stop",
        entityId: paramsParsed.data.companyId,
        newData: { creditStop: true, reason: bodyParsed.data.reason },
      });

      return { success: true, data: { companyId: paramsParsed.data.companyId, creditStop: true } };
    },
  );

  /**
   * DELETE /api/v1/credit/:companyId/stop — Remove credit stop
   */
  app.delete(
    "/:companyId/stop",
    { preHandler: requirePermission("manage:credit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = z.object({ companyId: z.uuid() }).safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [settings] = await ctx.tenantDb
        .select()
        .from(customerInvoiceSettings)
        .where(eq(customerInvoiceSettings.companyId, paramsParsed.data.companyId));

      if (settings) {
        await ctx.tenantDb
          .update(customerInvoiceSettings)
          .set({
            creditStop: false,
            creditStopReason: null,
            creditStopBy: null,
            creditStopAt: null,
            updatedAt: new Date(),
          })
          .where(eq(customerInvoiceSettings.id, settings.id));
      }

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "credit_stop",
        entityId: paramsParsed.data.companyId,
        newData: { creditStop: false },
      });

      return { success: true, data: { companyId: paramsParsed.data.companyId, creditStop: false } };
    },
  );

  /**
   * POST /api/v1/credit/check — Check credit for a proposed amount
   */
  app.post(
    "/check",
    { preHandler: requirePermission("view:credit") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = creditCheckSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid data", code: "VALIDATION_ERROR" });
      }

      const [settings] = await ctx.tenantDb
        .select()
        .from(customerInvoiceSettings)
        .where(eq(customerInvoiceSettings.companyId, parsed.data.companyId));

      const txns = await ctx.tenantDb
        .select()
        .from(creditTransactions)
        .where(eq(creditTransactions.companyId, parsed.data.companyId));

      const creditUsed = calculateCreditUsed(txns.map((t) => ({
        transactionType: t.transactionType,
        amount: t.amount,
      })));

      const limitStr = settings?.creditLimit;
      const creditLimit = limitStr ? parseFloat(limitStr) : null;
      const result = checkCreditAvailability(creditLimit, creditUsed, parsed.data.amount);

      return {
        success: true,
        data: {
          ...result,
          creditStop: settings?.creditStop ?? false,
          blocked: result.wouldExceed || (settings?.creditStop ?? false),
        },
      };
    },
  );
}
