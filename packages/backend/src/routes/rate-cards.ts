import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, desc } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  customerRateCards,
  customerRateCardEntries,
  auditLog,
} from "../db/schema/tenant.js";
import {
  createCustomerRateCardSchema,
  updateCustomerRateCardSchema,
  createRateCardEntrySchema,
  updateRateCardEntrySchema,
  rateLookupQuerySchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { lookupRate } from "../services/rate-lookup.js";

const subResourceParamSchema = idParamSchema.extend({
  subId: idParamSchema.shape.id,
});

export async function rateCardRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ── GET /api/v1/rate-cards — list rate cards ──

  app.get(
    "/",
    { preHandler: requirePermission("view:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const query = paginationQuerySchema.extend({
        customerId: idParamSchema.shape.id.optional(),
      }).safeParse(request.query);

      if (!query.success) {
        return reply.status(400).send({ error: "Invalid query", code: "VALIDATION_ERROR" });
      }

      const conditions = [isNull(customerRateCards.deletedAt)];
      if (query.data.customerId) {
        conditions.push(eq(customerRateCards.customerId, query.data.customerId));
      }

      const cards = await ctx.tenantDb
        .select()
        .from(customerRateCards)
        .where(and(...conditions))
        .orderBy(desc(customerRateCards.createdAt))
        .limit(query.data.limit);

      return { success: true, data: cards };
    },
  );

  // ── GET /api/v1/rate-cards/lookup — rate lookup ──

  app.get(
    "/lookup",
    { preHandler: requirePermission("view:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = rateLookupQuerySchema.safeParse(request.query);

      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid lookup query",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const result = await lookupRate(
        ctx.tenantDb,
        parsed.data.customerId,
        parsed.data.materialSubcategoryId,
        parsed.data.category,
        parsed.data.rateType,
        parsed.data.jobDate,
      );

      return { success: true, data: result };
    },
  );

  // ── GET /api/v1/rate-cards/:id — get rate card with entries ──

  app.get(
    "/:id",
    { preHandler: requirePermission("view:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [card] = await ctx.tenantDb
        .select()
        .from(customerRateCards)
        .where(and(eq(customerRateCards.id, paramsParsed.data.id), isNull(customerRateCards.deletedAt)))
        .limit(1);

      if (!card) {
        return reply.status(404).send({ error: "Rate card not found", code: "NOT_FOUND" });
      }

      const entries = await ctx.tenantDb
        .select()
        .from(customerRateCardEntries)
        .where(eq(customerRateCardEntries.rateCardId, card.id))
        .orderBy(customerRateCardEntries.sortOrder);

      return { success: true, data: { ...card, entries } };
    },
  );

  // ── POST /api/v1/rate-cards — create rate card ──

  app.post(
    "/",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const bodyParsed = createCustomerRateCardSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid rate card data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const input = bodyParsed.data;
      const id = crypto.randomUUID();

      const [card] = await ctx.tenantDb
        .insert(customerRateCards)
        .values({
          id,
          customerId: input.customerId,
          name: input.name,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
          isActive: input.isActive,
          notes: input.notes,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "customer_rate_card",
        entityId: id,
        newData: input,
      });

      return reply.status(201).send({ success: true, data: card });
    },
  );

  // ── PUT /api/v1/rate-cards/:id — update rate card ──

  app.put(
    "/:id",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateCustomerRateCardSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid rate card data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const cardId = paramsParsed.data.id;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(customerRateCards)
        .where(and(eq(customerRateCards.id, cardId), isNull(customerRateCards.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Rate card not found", code: "NOT_FOUND" });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateValues.name = input.name;
      if (input.effectiveFrom !== undefined) updateValues.effectiveFrom = input.effectiveFrom;
      if (input.effectiveTo !== undefined) updateValues.effectiveTo = input.effectiveTo;
      if (input.isActive !== undefined) updateValues.isActive = input.isActive;
      if (input.notes !== undefined) updateValues.notes = input.notes;

      const [updated] = await ctx.tenantDb
        .update(customerRateCards)
        .set(updateValues)
        .where(eq(customerRateCards.id, cardId))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "customer_rate_card",
        entityId: cardId,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  // ── DELETE /api/v1/rate-cards/:id — soft delete ──

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
        .from(customerRateCards)
        .where(and(eq(customerRateCards.id, paramsParsed.data.id), isNull(customerRateCards.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Rate card not found", code: "NOT_FOUND" });
      }

      await ctx.tenantDb
        .update(customerRateCards)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(customerRateCards.id, paramsParsed.data.id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "customer_rate_card",
        entityId: paramsParsed.data.id,
        previousData: existing,
      });

      return { success: true };
    },
  );

  // ── POST /api/v1/rate-cards/:id/entries — add entry ──

  app.post(
    "/:id/entries",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = createRateCardEntrySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid entry data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const cardId = paramsParsed.data.id;

      // Verify card exists
      const [card] = await ctx.tenantDb
        .select({ id: customerRateCards.id })
        .from(customerRateCards)
        .where(and(eq(customerRateCards.id, cardId), isNull(customerRateCards.deletedAt)))
        .limit(1);

      if (!card) {
        return reply.status(404).send({ error: "Rate card not found", code: "NOT_FOUND" });
      }

      const input = bodyParsed.data;
      const entryId = crypto.randomUUID();

      const [entry] = await ctx.tenantDb
        .insert(customerRateCardEntries)
        .values({
          id: entryId,
          rateCardId: cardId,
          materialSubcategoryId: input.materialSubcategoryId,
          category: input.category,
          rateType: input.rateType,
          unitRate: input.unitRate.toString(),
          description: input.description,
          sortOrder: input.sortOrder,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "rate_card_entry",
        entityId: entryId,
        newData: { rateCardId: cardId, ...input },
      });

      return reply.status(201).send({ success: true, data: entry });
    },
  );

  // ── PUT /api/v1/rate-cards/:id/entries/:subId — update entry ──

  app.put(
    "/:id/entries/:subId",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = subResourceParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateRateCardEntrySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid entry data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { subId } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(customerRateCardEntries)
        .where(eq(customerRateCardEntries.id, subId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Entry not found", code: "NOT_FOUND" });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.materialSubcategoryId !== undefined) updateValues.materialSubcategoryId = input.materialSubcategoryId;
      if (input.category !== undefined) updateValues.category = input.category;
      if (input.rateType !== undefined) updateValues.rateType = input.rateType;
      if (input.unitRate !== undefined) updateValues.unitRate = input.unitRate.toString();
      if (input.description !== undefined) updateValues.description = input.description;
      if (input.sortOrder !== undefined) updateValues.sortOrder = input.sortOrder;

      const [updated] = await ctx.tenantDb
        .update(customerRateCardEntries)
        .set(updateValues)
        .where(eq(customerRateCardEntries.id, subId))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "rate_card_entry",
        entityId: subId,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  // ── DELETE /api/v1/rate-cards/:id/entries/:subId — delete entry ──

  app.delete(
    "/:id/entries/:subId",
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
        .from(customerRateCardEntries)
        .where(eq(customerRateCardEntries.id, subId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Entry not found", code: "NOT_FOUND" });
      }

      await ctx.tenantDb
        .delete(customerRateCardEntries)
        .where(eq(customerRateCardEntries.id, subId));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "rate_card_entry",
        entityId: subId,
        previousData: existing,
      });

      return { success: true };
    },
  );
}
