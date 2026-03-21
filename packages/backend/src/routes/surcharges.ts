import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import { surcharges, surchargeHistory, auditLog } from "../db/schema/tenant.js";
import {
  createSurchargeSchema,
  updateSurchargeSchema,
  idParamSchema,
} from "@nexum/shared";

export async function surchargeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ── GET /api/v1/surcharges ──

  app.get(
    "/",
    { preHandler: requirePermission("view:pricing") },
    async (request: FastifyRequest) => {
      const ctx = tenant(request);
      const results = await ctx.tenantDb
        .select()
        .from(surcharges)
        .where(isNull(surcharges.deletedAt));

      return { success: true, data: results };
    },
  );

  // ── GET /api/v1/surcharges/:id ──

  app.get(
    "/:id",
    { preHandler: requirePermission("view:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [surcharge] = await ctx.tenantDb
        .select()
        .from(surcharges)
        .where(and(eq(surcharges.id, paramsParsed.data.id), isNull(surcharges.deletedAt)))
        .limit(1);

      if (!surcharge) {
        return reply.status(404).send({ error: "Surcharge not found", code: "NOT_FOUND" });
      }

      // Get value history
      const history = await ctx.tenantDb
        .select()
        .from(surchargeHistory)
        .where(eq(surchargeHistory.surchargeId, surcharge.id));

      return { success: true, data: { ...surcharge, history } };
    },
  );

  // ── POST /api/v1/surcharges ──

  app.post(
    "/",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const bodyParsed = createSurchargeSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid surcharge data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const input = bodyParsed.data;
      const id = crypto.randomUUID();

      const [surcharge] = await ctx.tenantDb
        .insert(surcharges)
        .values({
          id,
          name: input.name,
          type: input.type,
          value: input.value.toString(),
          appliesTo: input.appliesTo,
          autoApply: input.autoApply,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
          isActive: input.isActive,
          notes: input.notes,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "surcharge",
        entityId: id,
        newData: input,
      });

      return reply.status(201).send({ success: true, data: surcharge });
    },
  );

  // ── PUT /api/v1/surcharges/:id ──

  app.put(
    "/:id",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateSurchargeSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid surcharge data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const surchargeId = paramsParsed.data.id;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(surcharges)
        .where(and(eq(surcharges.id, surchargeId), isNull(surcharges.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Surcharge not found", code: "NOT_FOUND" });
      }

      // Track value changes in history
      if (input.value !== undefined && input.value.toString() !== existing.value) {
        await ctx.tenantDb.insert(surchargeHistory).values({
          surchargeId,
          previousValue: existing.value,
          newValue: input.value.toString(),
          effectiveDate: input.effectiveFrom ?? existing.effectiveFrom,
          changedBy: ctx.userId,
        });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateValues.name = input.name;
      if (input.type !== undefined) updateValues.type = input.type;
      if (input.value !== undefined) updateValues.value = input.value.toString();
      if (input.appliesTo !== undefined) updateValues.appliesTo = input.appliesTo;
      if (input.autoApply !== undefined) updateValues.autoApply = input.autoApply;
      if (input.effectiveFrom !== undefined) updateValues.effectiveFrom = input.effectiveFrom;
      if (input.effectiveTo !== undefined) updateValues.effectiveTo = input.effectiveTo;
      if (input.isActive !== undefined) updateValues.isActive = input.isActive;
      if (input.notes !== undefined) updateValues.notes = input.notes;

      const [updated] = await ctx.tenantDb
        .update(surcharges)
        .set(updateValues)
        .where(eq(surcharges.id, surchargeId))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "surcharge",
        entityId: surchargeId,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  // ── DELETE /api/v1/surcharges/:id ──

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
        .from(surcharges)
        .where(and(eq(surcharges.id, paramsParsed.data.id), isNull(surcharges.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Surcharge not found", code: "NOT_FOUND" });
      }

      await ctx.tenantDb
        .update(surcharges)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(surcharges.id, paramsParsed.data.id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "surcharge",
        entityId: paramsParsed.data.id,
        previousData: existing,
      });

      return { success: true };
    },
  );
}
