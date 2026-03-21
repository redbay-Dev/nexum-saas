import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, ilike, or, sql, desc } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import { jobTypes, auditLog } from "../db/schema/tenant.js";
import {
  createJobTypeSchema,
  updateJobTypeSchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";

const jobTypeListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

type JobTypeListQuery = z.infer<typeof jobTypeListQuerySchema>;

export async function jobTypeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/job-types
   * List job types with pagination and search.
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = jobTypeListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query: JobTypeListQuery = parsed.data;
      const limit = query.limit;

      const conditions = [isNull(jobTypes.deletedAt)];

      if (query.isActive !== undefined) {
        conditions.push(eq(jobTypes.isActive, query.isActive));
      }

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(
          or(
            ilike(jobTypes.name, searchPattern),
            ilike(jobTypes.code, searchPattern),
          ) ?? sql`TRUE`,
        );
      }

      if (query.cursor) {
        conditions.push(sql`${jobTypes.id} < ${query.cursor}`);
      }

      const rows = await ctx.tenantDb
        .select()
        .from(jobTypes)
        .where(and(...conditions))
        .orderBy(jobTypes.sortOrder, desc(jobTypes.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

      return {
        success: true,
        data: { data, nextCursor, hasMore },
      };
    },
  );

  /**
   * GET /api/v1/job-types/:id
   */
  app.get(
    "/:id",
    { preHandler: requirePermission("view:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid job type ID",
          code: "VALIDATION_ERROR",
        });
      }

      const [row] = await ctx.tenantDb
        .select()
        .from(jobTypes)
        .where(and(eq(jobTypes.id, parsed.data.id), isNull(jobTypes.deletedAt)))
        .limit(1);

      if (!row) {
        return reply.status(404).send({
          error: "Job type not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: row };
    },
  );

  /**
   * POST /api/v1/job-types
   */
  app.post(
    "/",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = createJobTypeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid job type data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const input = parsed.data;

      // Check unique code
      const [existingCode] = await ctx.tenantDb
        .select({ id: jobTypes.id })
        .from(jobTypes)
        .where(and(eq(jobTypes.code, input.code), isNull(jobTypes.deletedAt)))
        .limit(1);

      if (existingCode) {
        return reply.status(409).send({
          error: "A job type with this code already exists",
          code: "DUPLICATE",
        });
      }

      const id = crypto.randomUUID();
      const [jobType] = await ctx.tenantDb
        .insert(jobTypes)
        .values({
          id,
          name: input.name,
          code: input.code,
          description: input.description,
          isSystem: input.isSystem,
          visibleSections: input.visibleSections,
          requiredFields: input.requiredFields,
          availablePricingMethods: input.availablePricingMethods,
          defaults: input.defaults,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "job_type",
        entityId: id,
        newData: jobType,
      });

      return reply.status(201).send({ success: true, data: jobType });
    },
  );

  /**
   * PUT /api/v1/job-types/:id
   */
  app.put(
    "/:id",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid job type ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = updateJobTypeSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid job type data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { id } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(jobTypes)
        .where(and(eq(jobTypes.id, id), isNull(jobTypes.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Job type not found",
          code: "NOT_FOUND",
        });
      }

      // Check unique code if changing
      if (input.code && input.code !== existing.code) {
        const [existingCode] = await ctx.tenantDb
          .select({ id: jobTypes.id })
          .from(jobTypes)
          .where(
            and(
              eq(jobTypes.code, input.code),
              isNull(jobTypes.deletedAt),
              sql`${jobTypes.id} != ${id}`,
            ),
          )
          .limit(1);

        if (existingCode) {
          return reply.status(409).send({
            error: "A job type with this code already exists",
            code: "DUPLICATE",
          });
        }
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateValues.name = input.name;
      if (input.code !== undefined) updateValues.code = input.code;
      if (input.description !== undefined) updateValues.description = input.description;
      if (input.visibleSections !== undefined) updateValues.visibleSections = input.visibleSections;
      if (input.requiredFields !== undefined) updateValues.requiredFields = input.requiredFields;
      if (input.availablePricingMethods !== undefined) updateValues.availablePricingMethods = input.availablePricingMethods;
      if (input.defaults !== undefined) updateValues.defaults = input.defaults;
      if (input.sortOrder !== undefined) updateValues.sortOrder = input.sortOrder;
      if (input.isActive !== undefined) updateValues.isActive = input.isActive;

      const [updated] = await ctx.tenantDb
        .update(jobTypes)
        .set(updateValues)
        .where(eq(jobTypes.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "job_type",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/job-types/:id
   * Soft-delete. Block deletion of system types.
   */
  app.delete(
    "/:id",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid job type ID",
          code: "VALIDATION_ERROR",
        });
      }

      const { id } = parsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(jobTypes)
        .where(and(eq(jobTypes.id, id), isNull(jobTypes.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Job type not found",
          code: "NOT_FOUND",
        });
      }

      if (existing.isSystem) {
        return reply.status(400).send({
          error: "System job types cannot be deleted",
          code: "SYSTEM_TYPE",
        });
      }

      const [deleted] = await ctx.tenantDb
        .update(jobTypes)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(jobTypes.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "job_type",
        entityId: id,
        previousData: existing,
        newData: deleted,
      });

      return { success: true, data: { id } };
    },
  );
}
