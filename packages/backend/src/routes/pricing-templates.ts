import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  pricingTemplates,
  pricingTemplateLines,
  jobPricingLines,
  jobs,
  auditLog,
} from "../db/schema/tenant.js";
import {
  createPricingTemplateSchema,
  updatePricingTemplateSchema,
  createTemplateLineSchema,
  applyPricingTemplateSchema,
  idParamSchema,
} from "@nexum/shared";

const subResourceParamSchema = idParamSchema.extend({
  subId: idParamSchema.shape.id,
});

export async function pricingTemplateRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ── GET /api/v1/pricing-templates ──

  app.get(
    "/",
    { preHandler: requirePermission("view:pricing") },
    async (request: FastifyRequest) => {
      const ctx = tenant(request);
      const templates = await ctx.tenantDb
        .select()
        .from(pricingTemplates)
        .where(isNull(pricingTemplates.deletedAt));

      return { success: true, data: templates };
    },
  );

  // ── GET /api/v1/pricing-templates/:id ──

  app.get(
    "/:id",
    { preHandler: requirePermission("view:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const [tmpl] = await ctx.tenantDb
        .select()
        .from(pricingTemplates)
        .where(and(eq(pricingTemplates.id, paramsParsed.data.id), isNull(pricingTemplates.deletedAt)))
        .limit(1);

      if (!tmpl) {
        return reply.status(404).send({ error: "Template not found", code: "NOT_FOUND" });
      }

      const lines = await ctx.tenantDb
        .select()
        .from(pricingTemplateLines)
        .where(eq(pricingTemplateLines.templateId, tmpl.id))
        .orderBy(pricingTemplateLines.sortOrder);

      return { success: true, data: { ...tmpl, lines } };
    },
  );

  // ── POST /api/v1/pricing-templates ──

  app.post(
    "/",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const bodyParsed = createPricingTemplateSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid template data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const input = bodyParsed.data;
      const id = crypto.randomUUID();

      const [tmpl] = await ctx.tenantDb
        .insert(pricingTemplates)
        .values({
          id,
          name: input.name,
          description: input.description,
          isActive: input.isActive,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "pricing_template",
        entityId: id,
        newData: input,
      });

      return reply.status(201).send({ success: true, data: tmpl });
    },
  );

  // ── PUT /api/v1/pricing-templates/:id ──

  app.put(
    "/:id",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updatePricingTemplateSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid template data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const templateId = paramsParsed.data.id;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(pricingTemplates)
        .where(and(eq(pricingTemplates.id, templateId), isNull(pricingTemplates.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Template not found", code: "NOT_FOUND" });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateValues.name = input.name;
      if (input.description !== undefined) updateValues.description = input.description;
      if (input.isActive !== undefined) updateValues.isActive = input.isActive;

      const [updated] = await ctx.tenantDb
        .update(pricingTemplates)
        .set(updateValues)
        .where(eq(pricingTemplates.id, templateId))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "pricing_template",
        entityId: templateId,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  // ── DELETE /api/v1/pricing-templates/:id ──

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
        .from(pricingTemplates)
        .where(and(eq(pricingTemplates.id, paramsParsed.data.id), isNull(pricingTemplates.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Template not found", code: "NOT_FOUND" });
      }

      await ctx.tenantDb
        .update(pricingTemplates)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(pricingTemplates.id, paramsParsed.data.id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "pricing_template",
        entityId: paramsParsed.data.id,
        previousData: existing,
      });

      return { success: true };
    },
  );

  // ── POST /api/v1/pricing-templates/:id/lines ──

  app.post(
    "/:id/lines",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = createTemplateLineSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid line data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const templateId = paramsParsed.data.id;
      const input = bodyParsed.data;

      const [tmpl] = await ctx.tenantDb
        .select({ id: pricingTemplates.id })
        .from(pricingTemplates)
        .where(and(eq(pricingTemplates.id, templateId), isNull(pricingTemplates.deletedAt)))
        .limit(1);

      if (!tmpl) {
        return reply.status(404).send({ error: "Template not found", code: "NOT_FOUND" });
      }

      const lineId = crypto.randomUUID();

      const [line] = await ctx.tenantDb
        .insert(pricingTemplateLines)
        .values({
          id: lineId,
          templateId,
          lineType: input.lineType,
          category: input.category,
          description: input.description,
          rateType: input.rateType,
          unitRate: input.unitRate?.toString(),
          quantity: input.quantity?.toString(),
          partyId: input.partyId,
          sortOrder: input.sortOrder,
        })
        .returning();

      return reply.status(201).send({ success: true, data: line });
    },
  );

  // ── DELETE /api/v1/pricing-templates/:id/lines/:subId ──

  app.delete(
    "/:id/lines/:subId",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = subResourceParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid parameters", code: "VALIDATION_ERROR" });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(pricingTemplateLines)
        .where(eq(pricingTemplateLines.id, paramsParsed.data.subId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Template line not found", code: "NOT_FOUND" });
      }

      await ctx.tenantDb
        .delete(pricingTemplateLines)
        .where(eq(pricingTemplateLines.id, paramsParsed.data.subId));

      return { success: true };
    },
  );

  // ── POST /api/v1/pricing-templates/:id/apply — bulk-create pricing lines on a job ──

  app.post(
    "/:id/apply",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = applyPricingTemplateSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid apply data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const templateId = paramsParsed.data.id;
      const { jobId } = bodyParsed.data;

      // Verify template exists
      const [tmpl] = await ctx.tenantDb
        .select()
        .from(pricingTemplates)
        .where(and(eq(pricingTemplates.id, templateId), isNull(pricingTemplates.deletedAt)))
        .limit(1);

      if (!tmpl) {
        return reply.status(404).send({ error: "Template not found", code: "NOT_FOUND" });
      }

      // Verify job exists and not invoiced
      const [job] = await ctx.tenantDb
        .select({ id: jobs.id, status: jobs.status })
        .from(jobs)
        .where(and(eq(jobs.id, jobId), isNull(jobs.deletedAt)))
        .limit(1);

      if (!job) {
        return reply.status(404).send({ error: "Job not found", code: "NOT_FOUND" });
      }

      if (job.status === "invoiced") {
        return reply.status(400).send({ error: "Cannot add pricing to invoiced job", code: "JOB_LOCKED" });
      }

      // Get template lines
      const templateLines = await ctx.tenantDb
        .select()
        .from(pricingTemplateLines)
        .where(eq(pricingTemplateLines.templateId, templateId))
        .orderBy(pricingTemplateLines.sortOrder);

      if (templateLines.length === 0) {
        return reply.status(400).send({ error: "Template has no lines", code: "EMPTY_TEMPLATE" });
      }

      // Bulk create pricing lines
      const createdLines = [];
      for (const tLine of templateLines) {
        const lineId = crypto.randomUUID();
        const quantity = tLine.quantity ? parseFloat(tLine.quantity) : 0;
        const unitRate = tLine.unitRate ? parseFloat(tLine.unitRate) : 0;

        const [created] = await ctx.tenantDb
          .insert(jobPricingLines)
          .values({
            id: lineId,
            jobId,
            lineType: tLine.lineType,
            partyId: tLine.partyId,
            category: tLine.category,
            description: tLine.description,
            rateType: tLine.rateType,
            quantity: quantity.toString(),
            unitRate: unitRate.toString(),
            total: (Math.round(quantity * unitRate * 100) / 100).toString(),
            source: "manual",
            sortOrder: tLine.sortOrder,
          })
          .returning();

        createdLines.push(created);
      }

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "job_pricing_line",
        entityId: jobId,
        newData: { templateId, templateName: tmpl.name, linesCreated: createdLines.length },
      });

      return reply.status(201).send({
        success: true,
        data: { templateName: tmpl.name, linesCreated: createdLines.length, lines: createdLines },
      });
    },
  );
}
