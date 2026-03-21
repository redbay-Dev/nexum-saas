import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import { marginThresholds, auditLog } from "../db/schema/tenant.js";
import {
  createMarginThresholdSchema,
  updateMarginThresholdSchema,
  idParamSchema,
} from "@nexum/shared";

export async function marginThresholdRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ── GET /api/v1/margin-thresholds ──

  app.get(
    "/",
    { preHandler: requirePermission("view:pricing") },
    async (request: FastifyRequest) => {
      const ctx = tenant(request);
      const thresholds = await ctx.tenantDb
        .select()
        .from(marginThresholds)
        .where(isNull(marginThresholds.deletedAt));

      return { success: true, data: thresholds };
    },
  );

  // ── POST /api/v1/margin-thresholds ──

  app.post(
    "/",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const bodyParsed = createMarginThresholdSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid threshold data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const input = bodyParsed.data;
      const id = crypto.randomUUID();

      const [threshold] = await ctx.tenantDb
        .insert(marginThresholds)
        .values({
          id,
          level: input.level,
          referenceId: input.referenceId,
          minimumMarginPercent: input.minimumMarginPercent.toString(),
          warningMarginPercent: input.warningMarginPercent.toString(),
          requiresApproval: input.requiresApproval,
          isActive: input.isActive,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "margin_threshold",
        entityId: id,
        newData: input,
      });

      return reply.status(201).send({ success: true, data: threshold });
    },
  );

  // ── PUT /api/v1/margin-thresholds/:id ──

  app.put(
    "/:id",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateMarginThresholdSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid threshold data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const thresholdId = paramsParsed.data.id;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(marginThresholds)
        .where(and(eq(marginThresholds.id, thresholdId), isNull(marginThresholds.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Threshold not found", code: "NOT_FOUND" });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.level !== undefined) updateValues.level = input.level;
      if (input.referenceId !== undefined) updateValues.referenceId = input.referenceId;
      if (input.minimumMarginPercent !== undefined) updateValues.minimumMarginPercent = input.minimumMarginPercent.toString();
      if (input.warningMarginPercent !== undefined) updateValues.warningMarginPercent = input.warningMarginPercent.toString();
      if (input.requiresApproval !== undefined) updateValues.requiresApproval = input.requiresApproval;
      if (input.isActive !== undefined) updateValues.isActive = input.isActive;

      const [updated] = await ctx.tenantDb
        .update(marginThresholds)
        .set(updateValues)
        .where(eq(marginThresholds.id, thresholdId))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "margin_threshold",
        entityId: thresholdId,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  // ── DELETE /api/v1/margin-thresholds/:id ──

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
        .from(marginThresholds)
        .where(and(eq(marginThresholds.id, paramsParsed.data.id), isNull(marginThresholds.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Threshold not found", code: "NOT_FOUND" });
      }

      await ctx.tenantDb
        .update(marginThresholds)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(marginThresholds.id, paramsParsed.data.id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "margin_threshold",
        entityId: paramsParsed.data.id,
        previousData: existing,
      });

      return { success: true };
    },
  );
}
