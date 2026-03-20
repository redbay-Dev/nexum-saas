import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import { regions, addresses, auditLog } from "../db/schema/tenant.js";
import {
  createRegionSchema,
  updateRegionSchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";

const regionListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  active: z
    .string()
    .transform((v) => v === "true")
    .optional(),
});

type RegionListQuery = z.infer<typeof regionListQuerySchema>;

export async function regionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/regions
   * List regions with optional search and active filter.
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:regions") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = regionListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query: RegionListQuery = parsed.data;
      const limit = query.limit;

      const conditions = [];

      if (query.active !== undefined) {
        conditions.push(eq(regions.isActive, query.active));
      }

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(ilike(regions.name, searchPattern));
      }

      if (query.cursor) {
        conditions.push(sql`${regions.id} < ${query.cursor}`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await ctx.tenantDb
        .select()
        .from(regions)
        .where(whereClause)
        .orderBy(desc(regions.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(regions)
        .where(
          conditions.length > 0
            ? and(...conditions.filter((_, i) => i !== conditions.length - (query.cursor ? 1 : 0)))
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

  /**
   * GET /api/v1/regions/:id
   * Get a single region with the count of addresses assigned to it.
   */
  app.get(
    "/:id",
    { preHandler: requirePermission("view:regions") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid region ID",
          code: "VALIDATION_ERROR",
        });
      }

      const [region] = await ctx.tenantDb
        .select()
        .from(regions)
        .where(eq(regions.id, parsed.data.id))
        .limit(1);

      if (!region) {
        return reply.status(404).send({
          error: "Region not found",
          code: "NOT_FOUND",
        });
      }

      // Get count of addresses in this region
      const [addressCount] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(addresses)
        .where(eq(addresses.regionId, region.id));

      return {
        success: true,
        data: { ...region, addressCount: addressCount?.count ?? 0 },
      };
    },
  );

  /**
   * POST /api/v1/regions
   */
  app.post(
    "/",
    { preHandler: requirePermission("manage:regions") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = createRegionSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid region data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const input = parsed.data;
      const id = crypto.randomUUID();

      const [region] = await ctx.tenantDb
        .insert(regions)
        .values({
          id,
          name: input.name,
          description: input.description,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "region",
        entityId: id,
        newData: region,
      });

      return reply.status(201).send({ success: true, data: region });
    },
  );

  /**
   * PUT /api/v1/regions/:id
   */
  app.put(
    "/:id",
    { preHandler: requirePermission("manage:regions") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid region ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = updateRegionSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid region data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { id } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(regions)
        .where(eq(regions.id, id))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Region not found",
          code: "NOT_FOUND",
        });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };

      if (input.name !== undefined) updateValues.name = input.name;
      if (input.description !== undefined) updateValues.description = input.description;

      const [updated] = await ctx.tenantDb
        .update(regions)
        .set(updateValues)
        .where(eq(regions.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "region",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * PUT /api/v1/regions/:id/toggle
   * Toggle a region's active status.
   */
  app.put(
    "/:id/toggle",
    { preHandler: requirePermission("manage:regions") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid region ID",
          code: "VALIDATION_ERROR",
        });
      }

      const { id } = parsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(regions)
        .where(eq(regions.id, id))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Region not found",
          code: "NOT_FOUND",
        });
      }

      const [updated] = await ctx.tenantDb
        .update(regions)
        .set({ isActive: !existing.isActive, updatedAt: new Date() })
        .where(eq(regions.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "region",
        entityId: id,
        previousData: { isActive: existing.isActive },
        newData: { isActive: updated?.isActive },
      });

      return { success: true, data: updated };
    },
  );
}
