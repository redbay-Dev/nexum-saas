import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, ilike, sql, desc } from "drizzle-orm";
import {
  requireTenant,
  requirePermission,
  tenant,
} from "../middleware/tenant.js";
import { qualificationTypes, auditLog } from "../db/schema/tenant.js";
import {
  createQualificationTypeSchema,
  updateQualificationTypeSchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";

const qualTypeListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
});

type QualTypeListQuery = z.infer<typeof qualTypeListQuerySchema>;

export async function qualificationTypeRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ── LIST ──

  app.get(
    "/",
    { preHandler: requirePermission("view:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = qualTypeListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query: QualTypeListQuery = parsed.data;
      const limit = query.limit;

      const conditions: Array<ReturnType<typeof eq>> = [];

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(ilike(qualificationTypes.name, searchPattern));
      }

      if (query.cursor) {
        conditions.push(
          sql`${qualificationTypes.id} < ${query.cursor}` as ReturnType<
            typeof eq
          >,
        );
      }

      const whereClause =
        conditions.length > 0 ? sql.join(conditions, sql` AND `) : undefined;

      const rows = await ctx.tenantDb
        .select()
        .from(qualificationTypes)
        .where(whereClause)
        .orderBy(desc(qualificationTypes.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(qualificationTypes)
        .where(
          conditions.length > 0
            ? sql.join(
                conditions.filter(
                  (_, i) =>
                    i !== conditions.length - (query.cursor ? 1 : 0),
                ),
                sql` AND `,
              )
            : undefined,
        );

      return {
        success: true,
        data: {
          data,
          nextCursor,
          hasMore,
          total: countResult?.count ?? 0,
        },
      };
    },
  );

  // ── GET BY ID ──

  app.get(
    "/:id",
    { preHandler: requirePermission("view:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid qualification type ID",
          code: "VALIDATION_ERROR",
        });
      }

      const [qualType] = await ctx.tenantDb
        .select()
        .from(qualificationTypes)
        .where(eq(qualificationTypes.id, parsed.data.id))
        .limit(1);

      if (!qualType) {
        return reply.status(404).send({
          error: "Qualification type not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: qualType };
    },
  );

  // ── CREATE ──

  app.post(
    "/",
    { preHandler: requirePermission("manage:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = createQualificationTypeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid qualification type data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const input = parsed.data;
      const id = crypto.randomUUID();

      const [qualType] = await ctx.tenantDb
        .insert(qualificationTypes)
        .values({
          id,
          name: input.name,
          description: input.description,
          hasExpiry: input.hasExpiry,
          requiresEvidence: input.requiresEvidence,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "qualification_type",
        entityId: id,
        newData: qualType,
      });

      return reply.status(201).send({ success: true, data: qualType });
    },
  );

  // ── UPDATE ──

  app.put(
    "/:id",
    { preHandler: requirePermission("manage:drivers") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid qualification type ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = updateQualificationTypeSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid qualification type data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { id } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(qualificationTypes)
        .where(eq(qualificationTypes.id, id))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Qualification type not found",
          code: "NOT_FOUND",
        });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateValues.name = input.name;
      if (input.description !== undefined)
        updateValues.description = input.description;
      if (input.hasExpiry !== undefined) updateValues.hasExpiry = input.hasExpiry;
      if (input.requiresEvidence !== undefined)
        updateValues.requiresEvidence = input.requiresEvidence;

      const [updated] = await ctx.tenantDb
        .update(qualificationTypes)
        .set(updateValues)
        .where(eq(qualificationTypes.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "qualification_type",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );
}
