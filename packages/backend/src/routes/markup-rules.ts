import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, asc } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import { markupRules, auditLog } from "../db/schema/tenant.js";
import {
  createMarkupRuleSchema,
  updateMarkupRuleSchema,
  markupRuleTestSchema,
  idParamSchema,
} from "@nexum/shared";
import { findMatchingRule, applyMarkup } from "../services/markup-engine.js";

export async function markupRuleRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ── GET /api/v1/markup-rules ──

  app.get(
    "/",
    { preHandler: requirePermission("view:pricing") },
    async (request: FastifyRequest) => {
      const ctx = tenant(request);
      const rules = await ctx.tenantDb
        .select()
        .from(markupRules)
        .where(isNull(markupRules.deletedAt))
        .orderBy(asc(markupRules.priority));

      return { success: true, data: rules };
    },
  );

  // ── GET /api/v1/markup-rules/:id ──

  app.get(
    "/:id",
    { preHandler: requirePermission("view:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [rule] = await ctx.tenantDb
        .select()
        .from(markupRules)
        .where(and(eq(markupRules.id, paramsParsed.data.id), isNull(markupRules.deletedAt)))
        .limit(1);

      if (!rule) {
        return reply.status(404).send({ error: "Markup rule not found", code: "NOT_FOUND" });
      }

      return { success: true, data: rule };
    },
  );

  // ── POST /api/v1/markup-rules ──

  app.post(
    "/",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const bodyParsed = createMarkupRuleSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid markup rule data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const input = bodyParsed.data;
      const id = crypto.randomUUID();

      const [rule] = await ctx.tenantDb
        .insert(markupRules)
        .values({
          id,
          name: input.name,
          type: input.type,
          markupPercentage: input.markupPercentage?.toString(),
          markupFixedAmount: input.markupFixedAmount?.toString(),
          materialCategoryId: input.materialCategoryId,
          supplierId: input.supplierId,
          priority: input.priority,
          isActive: input.isActive,
          notes: input.notes,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "markup_rule",
        entityId: id,
        newData: input,
      });

      return reply.status(201).send({ success: true, data: rule });
    },
  );

  // ── PUT /api/v1/markup-rules/:id ──

  app.put(
    "/:id",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateMarkupRuleSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid markup rule data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const ruleId = paramsParsed.data.id;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(markupRules)
        .where(and(eq(markupRules.id, ruleId), isNull(markupRules.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Markup rule not found", code: "NOT_FOUND" });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateValues.name = input.name;
      if (input.type !== undefined) updateValues.type = input.type;
      if (input.markupPercentage !== undefined) updateValues.markupPercentage = input.markupPercentage.toString();
      if (input.markupFixedAmount !== undefined) updateValues.markupFixedAmount = input.markupFixedAmount.toString();
      if (input.materialCategoryId !== undefined) updateValues.materialCategoryId = input.materialCategoryId;
      if (input.supplierId !== undefined) updateValues.supplierId = input.supplierId;
      if (input.priority !== undefined) updateValues.priority = input.priority;
      if (input.isActive !== undefined) updateValues.isActive = input.isActive;
      if (input.notes !== undefined) updateValues.notes = input.notes;

      const [updated] = await ctx.tenantDb
        .update(markupRules)
        .set(updateValues)
        .where(eq(markupRules.id, ruleId))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "markup_rule",
        entityId: ruleId,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  // ── DELETE /api/v1/markup-rules/:id ──

  app.delete(
    "/:id",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(markupRules)
        .where(and(eq(markupRules.id, paramsParsed.data.id), isNull(markupRules.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Markup rule not found", code: "NOT_FOUND" });
      }

      await ctx.tenantDb
        .update(markupRules)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(markupRules.id, paramsParsed.data.id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "markup_rule",
        entityId: paramsParsed.data.id,
        previousData: existing,
      });

      return { success: true };
    },
  );

  // ── POST /api/v1/markup-rules/test — test/preview which rule matches ──

  app.post(
    "/test",
    { preHandler: requirePermission("view:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const bodyParsed = markupRuleTestSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid test data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { materialCategoryId, supplierId, unitRate, quantity } = bodyParsed.data;

      const matchingRule = await findMatchingRule(ctx.tenantDb, materialCategoryId, supplierId);

      if (!matchingRule) {
        return {
          success: true,
          data: {
            matched: false,
            rule: null,
            result: null,
          },
        };
      }

      const result = applyMarkup(unitRate, quantity, matchingRule);

      return {
        success: true,
        data: {
          matched: true,
          rule: matchingRule,
          result: {
            costUnitRate: unitRate,
            revenueUnitRate: result.revenueUnitRate,
            costTotal: Math.round(unitRate * quantity * 100) / 100,
            revenueTotal: result.revenueTotal,
            marginPercent: result.revenueUnitRate > 0
              ? Math.round(((result.revenueUnitRate - unitRate) / result.revenueUnitRate) * 10000) / 100
              : 0,
          },
        },
      };
    },
  );
}
