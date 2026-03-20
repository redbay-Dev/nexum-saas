import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, ilike, sql, asc } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import { assetCategories, assetSubcategories, auditLog } from "../db/schema/tenant.js";
import {
  createAssetCategorySchema,
  updateAssetCategorySchema,
  createAssetSubcategorySchema,
  updateAssetSubcategorySchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";

// ── Query schemas ──

const categoryListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  includeInactive: z.coerce.boolean().optional(),
});

const subcategoryParamSchema = z.object({
  id: z.uuid(),
  subcategoryId: z.uuid(),
});

export async function assetCategoryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/asset-categories
   * List all asset categories with optional subcategories.
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = categoryListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query = parsed.data;
      const conditions = [isNull(assetCategories.deletedAt)];

      if (!query.includeInactive) {
        conditions.push(eq(assetCategories.isActive, true));
      }

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(ilike(assetCategories.name, searchPattern));
      }

      const rows = await ctx.tenantDb
        .select()
        .from(assetCategories)
        .where(and(...conditions))
        .orderBy(asc(assetCategories.sortOrder), asc(assetCategories.name));

      // Fetch subcategories for all categories
      const categoryIds = rows.map((r) => r.id);
      let subcategories: Array<typeof assetSubcategories.$inferSelect> = [];

      if (categoryIds.length > 0) {
        subcategories = await ctx.tenantDb
          .select()
          .from(assetSubcategories)
          .where(
            and(
              isNull(assetSubcategories.deletedAt),
              sql`${assetSubcategories.categoryId} = ANY(${sql.raw(`ARRAY[${categoryIds.map((id) => `'${id}'::uuid`).join(",")}]`)})`,
            ),
          )
          .orderBy(asc(assetSubcategories.sortOrder), asc(assetSubcategories.name));
      }

      // Group subcategories by categoryId
      const subcatMap = new Map<string, Array<typeof assetSubcategories.$inferSelect>>();
      for (const sub of subcategories) {
        const list = subcatMap.get(sub.categoryId) ?? [];
        list.push(sub);
        subcatMap.set(sub.categoryId, list);
      }

      const data = rows.map((cat) => ({
        ...cat,
        subcategories: subcatMap.get(cat.id) ?? [],
      }));

      return { success: true, data: { data } };
    },
  );

  /**
   * GET /api/v1/asset-categories/:id
   * Get a single category with its subcategories.
   */
  app.get(
    "/:id",
    { preHandler: requirePermission("view:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid category ID",
          code: "VALIDATION_ERROR",
        });
      }

      const [category] = await ctx.tenantDb
        .select()
        .from(assetCategories)
        .where(
          and(
            eq(assetCategories.id, parsed.data.id),
            isNull(assetCategories.deletedAt),
          ),
        )
        .limit(1);

      if (!category) {
        return reply.status(404).send({
          error: "Asset category not found",
          code: "NOT_FOUND",
        });
      }

      const subs = await ctx.tenantDb
        .select()
        .from(assetSubcategories)
        .where(
          and(
            eq(assetSubcategories.categoryId, category.id),
            isNull(assetSubcategories.deletedAt),
          ),
        )
        .orderBy(asc(assetSubcategories.sortOrder), asc(assetSubcategories.name));

      return { success: true, data: { ...category, subcategories: subs } };
    },
  );

  /**
   * POST /api/v1/asset-categories
   * Create a new asset category.
   */
  app.post(
    "/",
    { preHandler: requirePermission("manage:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = createAssetCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid category data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const input = parsed.data;
      const id = crypto.randomUUID();

      const [category] = await ctx.tenantDb
        .insert(assetCategories)
        .values({ id, ...input })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "asset_category",
        entityId: id,
        newData: category,
      });

      return reply.status(201).send({ success: true, data: category });
    },
  );

  /**
   * PUT /api/v1/asset-categories/:id
   * Update an asset category.
   */
  app.put(
    "/:id",
    { preHandler: requirePermission("manage:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid category ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = updateAssetCategorySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid category data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { id } = paramsParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(assetCategories)
        .where(and(eq(assetCategories.id, id), isNull(assetCategories.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Asset category not found",
          code: "NOT_FOUND",
        });
      }

      const [updated] = await ctx.tenantDb
        .update(assetCategories)
        .set({ ...bodyParsed.data, updatedAt: new Date() })
        .where(eq(assetCategories.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "asset_category",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/asset-categories/:id
   * Soft-delete an asset category.
   */
  app.delete(
    "/:id",
    { preHandler: requirePermission("manage:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid category ID",
          code: "VALIDATION_ERROR",
        });
      }

      const { id } = parsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(assetCategories)
        .where(and(eq(assetCategories.id, id), isNull(assetCategories.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Asset category not found",
          code: "NOT_FOUND",
        });
      }

      const [deleted] = await ctx.tenantDb
        .update(assetCategories)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(assetCategories.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "asset_category",
        entityId: id,
        previousData: existing,
        newData: deleted,
      });

      return { success: true, data: { id } };
    },
  );

  // ── Subcategory routes (nested under /:id/subcategories) ──

  /**
   * POST /api/v1/asset-categories/:id/subcategories
   * Create a subcategory within a category.
   */
  app.post(
    "/:id/subcategories",
    { preHandler: requirePermission("manage:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid category ID",
          code: "VALIDATION_ERROR",
        });
      }

      // Verify category exists
      const [category] = await ctx.tenantDb
        .select()
        .from(assetCategories)
        .where(
          and(
            eq(assetCategories.id, paramsParsed.data.id),
            isNull(assetCategories.deletedAt),
          ),
        )
        .limit(1);

      if (!category) {
        return reply.status(404).send({
          error: "Asset category not found",
          code: "NOT_FOUND",
        });
      }

      const bodyParsed = createAssetSubcategorySchema
        .omit({ categoryId: true })
        .safeParse(request.body);

      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid subcategory data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const id = crypto.randomUUID();
      const input = bodyParsed.data;
      const [subcategory] = await ctx.tenantDb
        .insert(assetSubcategories)
        .values({
          id,
          categoryId: category.id,
          name: input.name,
          vehicleConfiguration: input.vehicleConfiguration,
          defaultVolume: input.defaultVolume?.toString(),
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "asset_subcategory",
        entityId: id,
        newData: subcategory,
      });

      return reply.status(201).send({ success: true, data: subcategory });
    },
  );

  /**
   * PUT /api/v1/asset-categories/:id/subcategories/:subcategoryId
   * Update a subcategory.
   */
  app.put(
    "/:id/subcategories/:subcategoryId",
    { preHandler: requirePermission("manage:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = subcategoryParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid parameters",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = updateAssetSubcategorySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid subcategory data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(assetSubcategories)
        .where(
          and(
            eq(assetSubcategories.id, paramsParsed.data.subcategoryId),
            eq(assetSubcategories.categoryId, paramsParsed.data.id),
            isNull(assetSubcategories.deletedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Subcategory not found",
          code: "NOT_FOUND",
        });
      }

      const subInput = bodyParsed.data;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (subInput.name !== undefined) updateData.name = subInput.name;
      if (subInput.vehicleConfiguration !== undefined) updateData.vehicleConfiguration = subInput.vehicleConfiguration;
      if (subInput.defaultVolume !== undefined) updateData.defaultVolume = subInput.defaultVolume?.toString();
      if (subInput.sortOrder !== undefined) updateData.sortOrder = subInput.sortOrder;
      if (subInput.isActive !== undefined) updateData.isActive = subInput.isActive;

      const [updated] = await ctx.tenantDb
        .update(assetSubcategories)
        .set(updateData)
        .where(eq(assetSubcategories.id, paramsParsed.data.subcategoryId))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "asset_subcategory",
        entityId: paramsParsed.data.subcategoryId,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/asset-categories/:id/subcategories/:subcategoryId
   * Soft-delete a subcategory.
   */
  app.delete(
    "/:id/subcategories/:subcategoryId",
    { preHandler: requirePermission("manage:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = subcategoryParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid parameters",
          code: "VALIDATION_ERROR",
        });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(assetSubcategories)
        .where(
          and(
            eq(assetSubcategories.id, paramsParsed.data.subcategoryId),
            eq(assetSubcategories.categoryId, paramsParsed.data.id),
            isNull(assetSubcategories.deletedAt),
          ),
        )
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Subcategory not found",
          code: "NOT_FOUND",
        });
      }

      const [deleted] = await ctx.tenantDb
        .update(assetSubcategories)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(assetSubcategories.id, paramsParsed.data.subcategoryId))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "asset_subcategory",
        entityId: paramsParsed.data.subcategoryId,
        previousData: existing,
        newData: deleted,
      });

      return { success: true, data: { id: paramsParsed.data.subcategoryId } };
    },
  );
}
