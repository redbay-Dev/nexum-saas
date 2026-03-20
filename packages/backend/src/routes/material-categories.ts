import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, ilike, asc, sql } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import { materialCategories, materialSubcategories, auditLog } from "../db/schema/tenant.js";
import {
  createMaterialCategorySchema,
  updateMaterialCategorySchema,
  createMaterialSubcategorySchema,
  updateMaterialSubcategorySchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";

const categoryListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  includeInactive: z.coerce.boolean().optional(),
});

const subcategoryParamSchema = z.object({
  id: z.uuid(),
  subcategoryId: z.uuid(),
});

export async function materialCategoryRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/material-categories
   * List all material categories with their subcategories.
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:materials") },
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
      const conditions = [isNull(materialCategories.deletedAt)];

      if (!query.includeInactive) {
        conditions.push(eq(materialCategories.isActive, true));
      }

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(ilike(materialCategories.name, searchPattern));
      }

      const rows = await ctx.tenantDb
        .select()
        .from(materialCategories)
        .where(and(...conditions))
        .orderBy(asc(materialCategories.sortOrder), asc(materialCategories.name));

      // Fetch subcategories for all categories
      const categoryIds = rows.map((r) => r.id);
      let subcategories: Array<typeof materialSubcategories.$inferSelect> = [];

      if (categoryIds.length > 0) {
        subcategories = await ctx.tenantDb
          .select()
          .from(materialSubcategories)
          .where(
            and(
              isNull(materialSubcategories.deletedAt),
              sql`${materialSubcategories.categoryId} = ANY(${sql.raw(`ARRAY[${categoryIds.map((id) => `'${id}'::uuid`).join(",")}]`)})`,
            ),
          )
          .orderBy(asc(materialSubcategories.sortOrder), asc(materialSubcategories.name));
      }

      // Group subcategories by categoryId
      const subcatMap = new Map<string, Array<typeof materialSubcategories.$inferSelect>>();
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
   * GET /api/v1/material-categories/:id
   * Get a single category with its subcategories.
   */
  app.get(
    "/:id",
    { preHandler: requirePermission("view:materials") },
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
        .from(materialCategories)
        .where(
          and(
            eq(materialCategories.id, parsed.data.id),
            isNull(materialCategories.deletedAt),
          ),
        )
        .limit(1);

      if (!category) {
        return reply.status(404).send({
          error: "Material category not found",
          code: "NOT_FOUND",
        });
      }

      const subs = await ctx.tenantDb
        .select()
        .from(materialSubcategories)
        .where(
          and(
            eq(materialSubcategories.categoryId, category.id),
            isNull(materialSubcategories.deletedAt),
          ),
        )
        .orderBy(asc(materialSubcategories.sortOrder), asc(materialSubcategories.name));

      return { success: true, data: { ...category, subcategories: subs } };
    },
  );

  /**
   * POST /api/v1/material-categories
   * Create a new material category.
   */
  app.post(
    "/",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = createMaterialCategorySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid category data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const id = crypto.randomUUID();
      const [category] = await ctx.tenantDb
        .insert(materialCategories)
        .values({ id, ...parsed.data })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "material_category",
        entityId: id,
        newData: category,
      });

      return reply.status(201).send({ success: true, data: category });
    },
  );

  /**
   * PUT /api/v1/material-categories/:id
   * Update a material category.
   */
  app.put(
    "/:id",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid category ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = updateMaterialCategorySchema.safeParse(request.body);
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
        .from(materialCategories)
        .where(and(eq(materialCategories.id, id), isNull(materialCategories.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Material category not found",
          code: "NOT_FOUND",
        });
      }

      const [updated] = await ctx.tenantDb
        .update(materialCategories)
        .set({ ...bodyParsed.data, updatedAt: new Date() })
        .where(eq(materialCategories.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "material_category",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/material-categories/:id
   * Soft-delete a material category.
   */
  app.delete(
    "/:id",
    { preHandler: requirePermission("manage:materials") },
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
        .from(materialCategories)
        .where(and(eq(materialCategories.id, id), isNull(materialCategories.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Material category not found",
          code: "NOT_FOUND",
        });
      }

      const [deleted] = await ctx.tenantDb
        .update(materialCategories)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(materialCategories.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "material_category",
        entityId: id,
        previousData: existing,
        newData: deleted,
      });

      return { success: true, data: { id } };
    },
  );

  // ── Subcategory routes (nested under /:id/subcategories) ──

  /**
   * POST /api/v1/material-categories/:id/subcategories
   */
  app.post(
    "/:id/subcategories",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid category ID",
          code: "VALIDATION_ERROR",
        });
      }

      const [category] = await ctx.tenantDb
        .select()
        .from(materialCategories)
        .where(
          and(
            eq(materialCategories.id, paramsParsed.data.id),
            isNull(materialCategories.deletedAt),
          ),
        )
        .limit(1);

      if (!category) {
        return reply.status(404).send({
          error: "Material category not found",
          code: "NOT_FOUND",
        });
      }

      const bodyParsed = createMaterialSubcategorySchema
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
        .insert(materialSubcategories)
        .values({
          id,
          categoryId: category.id,
          name: input.name,
          description: input.description,
          densityFactor: input.densityFactor?.toString(),
          sortOrder: input.sortOrder,
          isActive: input.isActive,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "material_subcategory",
        entityId: id,
        newData: subcategory,
      });

      return reply.status(201).send({ success: true, data: subcategory });
    },
  );

  /**
   * PUT /api/v1/material-categories/:id/subcategories/:subcategoryId
   */
  app.put(
    "/:id/subcategories/:subcategoryId",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = subcategoryParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid parameters",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = updateMaterialSubcategorySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid subcategory data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(materialSubcategories)
        .where(
          and(
            eq(materialSubcategories.id, paramsParsed.data.subcategoryId),
            eq(materialSubcategories.categoryId, paramsParsed.data.id),
            isNull(materialSubcategories.deletedAt),
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
      if (subInput.description !== undefined) updateData.description = subInput.description;
      if (subInput.densityFactor !== undefined) updateData.densityFactor = subInput.densityFactor?.toString();
      if (subInput.sortOrder !== undefined) updateData.sortOrder = subInput.sortOrder;
      if (subInput.isActive !== undefined) updateData.isActive = subInput.isActive;

      const [updated] = await ctx.tenantDb
        .update(materialSubcategories)
        .set(updateData)
        .where(eq(materialSubcategories.id, paramsParsed.data.subcategoryId))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "material_subcategory",
        entityId: paramsParsed.data.subcategoryId,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/material-categories/:id/subcategories/:subcategoryId
   */
  app.delete(
    "/:id/subcategories/:subcategoryId",
    { preHandler: requirePermission("manage:materials") },
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
        .from(materialSubcategories)
        .where(
          and(
            eq(materialSubcategories.id, paramsParsed.data.subcategoryId),
            eq(materialSubcategories.categoryId, paramsParsed.data.id),
            isNull(materialSubcategories.deletedAt),
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
        .update(materialSubcategories)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(materialSubcategories.id, paramsParsed.data.subcategoryId))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "material_subcategory",
        entityId: paramsParsed.data.subcategoryId,
        previousData: existing,
        newData: deleted,
      });

      return { success: true, data: { id: paramsParsed.data.subcategoryId } };
    },
  );
}
