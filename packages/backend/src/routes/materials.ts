import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, ilike, asc, gt, sql } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  tenantMaterials,
  supplierMaterials,
  customerMaterials,
  disposalMaterials,
  disposalSiteSettings,
  materialSubcategories,
  materialCategories,
  companies,
  addresses,
  auditLog,
} from "../db/schema/tenant.js";
import {
  createTenantMaterialSchema,
  updateTenantMaterialSchema,
  createSupplierMaterialSchema,
  updateSupplierMaterialSchema,
  createCustomerMaterialSchema,
  updateCustomerMaterialSchema,
  createDisposalMaterialSchema,
  updateDisposalMaterialSchema,
  updateDisposalSiteSettingsSchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";

// ── Shared query schemas ──

const materialListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  subcategoryId: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
  addressId: z.string().optional(),
});

const supplierMaterialListQuerySchema = materialListQuerySchema.extend({
  supplierId: z.string().optional(),
});

const customerMaterialListQuerySchema = materialListQuerySchema.extend({
  customerId: z.string().optional(),
});

const disposalMaterialListQuerySchema = materialListQuerySchema.extend({
  materialMode: z.enum(["disposal", "supply"]).optional(),
});

export async function materialRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ════════════════════════════════════════════════════
  // TENANT MATERIALS — own stockpile
  // ════════════════════════════════════════════════════

  /**
   * GET /api/v1/materials/tenant
   */
  app.get(
    "/tenant",
    { preHandler: requirePermission("view:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = materialListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", code: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors });
      }

      const query = parsed.data;
      const conditions = [isNull(tenantMaterials.deletedAt)];
      if (query.search) conditions.push(ilike(tenantMaterials.name, `%${query.search}%`));
      if (query.status) conditions.push(eq(tenantMaterials.status, query.status));
      if (query.subcategoryId) conditions.push(eq(tenantMaterials.subcategoryId, query.subcategoryId));
      if (query.addressId) conditions.push(eq(tenantMaterials.addressId, query.addressId));

      if (query.cursor) {
        conditions.push(gt(tenantMaterials.createdAt, new Date(query.cursor)));
      }

      const rows = await ctx.tenantDb
        .select({
          material: tenantMaterials,
          subcategoryName: materialSubcategories.name,
          categoryName: materialCategories.name,
          addressLabel: sql<string>`concat(${addresses.streetAddress}, ', ', ${addresses.suburb})`,
        })
        .from(tenantMaterials)
        .leftJoin(materialSubcategories, eq(tenantMaterials.subcategoryId, materialSubcategories.id))
        .leftJoin(materialCategories, eq(materialSubcategories.categoryId, materialCategories.id))
        .leftJoin(addresses, eq(tenantMaterials.addressId, addresses.id))
        .where(and(...conditions))
        .orderBy(asc(tenantMaterials.name))
        .limit(query.limit + 1);

      const hasMore = rows.length > query.limit;
      if (hasMore) rows.pop();

      const data = rows.map((r) => ({
        ...r.material,
        subcategoryName: r.subcategoryName,
        categoryName: r.categoryName,
        addressLabel: r.addressLabel,
      }));

      const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.createdAt.toISOString() : null;

      return { success: true, data: { data, nextCursor, hasMore } };
    },
  );

  /**
   * GET /api/v1/materials/tenant/:id
   */
  app.get(
    "/tenant/:id",
    { preHandler: requirePermission("view:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });

      const rows = await ctx.tenantDb
        .select({
          material: tenantMaterials,
          subcategoryName: materialSubcategories.name,
          categoryName: materialCategories.name,
          addressLabel: sql<string>`concat(${addresses.streetAddress}, ', ', ${addresses.suburb})`,
        })
        .from(tenantMaterials)
        .leftJoin(materialSubcategories, eq(tenantMaterials.subcategoryId, materialSubcategories.id))
        .leftJoin(materialCategories, eq(materialSubcategories.categoryId, materialCategories.id))
        .leftJoin(addresses, eq(tenantMaterials.addressId, addresses.id))
        .where(and(eq(tenantMaterials.id, parsed.data.id), isNull(tenantMaterials.deletedAt)))
        .limit(1);

      if (rows.length === 0) return reply.status(404).send({ error: "Material not found", code: "NOT_FOUND" });
      const row = rows[0]!;
      return { success: true, data: { ...row.material, subcategoryName: row.subcategoryName, categoryName: row.categoryName, addressLabel: row.addressLabel } };
    },
  );

  /**
   * POST /api/v1/materials/tenant
   */
  app.post(
    "/tenant",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = createTenantMaterialSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid material data", code: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors });
      }

      const id = crypto.randomUUID();
      const input = parsed.data;
      const [material] = await ctx.tenantDb
        .insert(tenantMaterials)
        .values({
          id,
          name: input.name,
          subcategoryId: input.subcategoryId,
          unitOfMeasure: input.unitOfMeasure,
          addressId: input.addressId,
          description: input.description,
          densityFactor: input.densityFactor?.toString(),
          status: input.status,
          compliance: input.compliance,
          notes: input.notes,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId, action: "CREATE", entityType: "tenant_material", entityId: id, newData: material,
      });

      return reply.status(201).send({ success: true, data: material });
    },
  );

  /**
   * PUT /api/v1/materials/tenant/:id
   */
  app.put(
    "/tenant/:id",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });

      const bodyParsed = updateTenantMaterialSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid material data", code: "VALIDATION_ERROR", details: bodyParsed.error.flatten().fieldErrors });
      }

      const { id } = paramsParsed.data;
      const [existing] = await ctx.tenantDb
        .select().from(tenantMaterials)
        .where(and(eq(tenantMaterials.id, id), isNull(tenantMaterials.deletedAt)))
        .limit(1);

      if (!existing) return reply.status(404).send({ error: "Material not found", code: "NOT_FOUND" });

      const input = bodyParsed.data;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.subcategoryId !== undefined) updateData.subcategoryId = input.subcategoryId;
      if (input.unitOfMeasure !== undefined) updateData.unitOfMeasure = input.unitOfMeasure;
      if (input.addressId !== undefined) updateData.addressId = input.addressId;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.densityFactor !== undefined) updateData.densityFactor = input.densityFactor?.toString();
      if (input.status !== undefined) updateData.status = input.status;
      if (input.compliance !== undefined) updateData.compliance = input.compliance;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const [updated] = await ctx.tenantDb
        .update(tenantMaterials).set(updateData).where(eq(tenantMaterials.id, id)).returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId, action: "UPDATE", entityType: "tenant_material", entityId: id, previousData: existing, newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/materials/tenant/:id
   */
  app.delete(
    "/tenant/:id",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });

      const { id } = parsed.data;
      const [existing] = await ctx.tenantDb
        .select().from(tenantMaterials)
        .where(and(eq(tenantMaterials.id, id), isNull(tenantMaterials.deletedAt)))
        .limit(1);

      if (!existing) return reply.status(404).send({ error: "Material not found", code: "NOT_FOUND" });

      await ctx.tenantDb.update(tenantMaterials).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(tenantMaterials.id, id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId, action: "DELETE", entityType: "tenant_material", entityId: id, previousData: existing,
      });

      return { success: true, data: { id } };
    },
  );

  // ════════════════════════════════════════════════════
  // SUPPLIER MATERIALS — buy-side
  // ════════════════════════════════════════════════════

  /**
   * GET /api/v1/materials/supplier
   */
  app.get(
    "/supplier",
    { preHandler: requirePermission("view:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = supplierMaterialListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", code: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors });
      }

      const query = parsed.data;
      const conditions = [isNull(supplierMaterials.deletedAt)];
      if (query.search) conditions.push(ilike(supplierMaterials.name, `%${query.search}%`));
      if (query.status) conditions.push(eq(supplierMaterials.status, query.status));
      if (query.supplierId) conditions.push(eq(supplierMaterials.supplierId, query.supplierId));
      if (query.subcategoryId) conditions.push(eq(supplierMaterials.subcategoryId, query.subcategoryId));
      if (query.addressId) conditions.push(eq(supplierMaterials.addressId, query.addressId));

      if (query.cursor) {
        conditions.push(gt(supplierMaterials.createdAt, new Date(query.cursor)));
      }

      const rows = await ctx.tenantDb
        .select({
          material: supplierMaterials,
          subcategoryName: materialSubcategories.name,
          categoryName: materialCategories.name,
          companyName: companies.name,
          addressLabel: sql<string>`concat(${addresses.streetAddress}, ', ', ${addresses.suburb})`,
        })
        .from(supplierMaterials)
        .leftJoin(materialSubcategories, eq(supplierMaterials.subcategoryId, materialSubcategories.id))
        .leftJoin(materialCategories, eq(materialSubcategories.categoryId, materialCategories.id))
        .leftJoin(companies, eq(supplierMaterials.supplierId, companies.id))
        .leftJoin(addresses, eq(supplierMaterials.addressId, addresses.id))
        .where(and(...conditions))
        .orderBy(asc(supplierMaterials.name))
        .limit(query.limit + 1);

      const hasMore = rows.length > query.limit;
      if (hasMore) rows.pop();

      const data = rows.map((r) => ({
        ...r.material,
        subcategoryName: r.subcategoryName,
        categoryName: r.categoryName,
        companyName: r.companyName,
        addressLabel: r.addressLabel,
      }));

      const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.createdAt.toISOString() : null;

      return { success: true, data: { data, nextCursor, hasMore } };
    },
  );

  /**
   * GET /api/v1/materials/supplier/:id
   */
  app.get(
    "/supplier/:id",
    { preHandler: requirePermission("view:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });

      const rows = await ctx.tenantDb
        .select({
          material: supplierMaterials,
          subcategoryName: materialSubcategories.name,
          categoryName: materialCategories.name,
          companyName: companies.name,
          addressLabel: sql<string>`concat(${addresses.streetAddress}, ', ', ${addresses.suburb})`,
        })
        .from(supplierMaterials)
        .leftJoin(materialSubcategories, eq(supplierMaterials.subcategoryId, materialSubcategories.id))
        .leftJoin(materialCategories, eq(materialSubcategories.categoryId, materialCategories.id))
        .leftJoin(companies, eq(supplierMaterials.supplierId, companies.id))
        .leftJoin(addresses, eq(supplierMaterials.addressId, addresses.id))
        .where(and(eq(supplierMaterials.id, parsed.data.id), isNull(supplierMaterials.deletedAt)))
        .limit(1);

      if (rows.length === 0) return reply.status(404).send({ error: "Material not found", code: "NOT_FOUND" });
      const row = rows[0]!;
      return { success: true, data: { ...row.material, subcategoryName: row.subcategoryName, categoryName: row.categoryName, companyName: row.companyName, addressLabel: row.addressLabel } };
    },
  );

  /**
   * POST /api/v1/materials/supplier
   */
  app.post(
    "/supplier",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = createSupplierMaterialSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid material data", code: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors });
      }

      // Validate supplier is a supplier company
      const [supplier] = await ctx.tenantDb
        .select().from(companies)
        .where(and(eq(companies.id, parsed.data.supplierId), eq(companies.isSupplier, true), isNull(companies.deletedAt)))
        .limit(1);
      if (!supplier) return reply.status(400).send({ error: "Supplier company not found or not marked as supplier", code: "VALIDATION_ERROR" });

      const id = crypto.randomUUID();
      const input = parsed.data;
      const [material] = await ctx.tenantDb
        .insert(supplierMaterials)
        .values({
          id,
          supplierId: input.supplierId,
          supplierName: input.supplierName,
          name: input.name,
          subcategoryId: input.subcategoryId,
          unitOfMeasure: input.unitOfMeasure,
          addressId: input.addressId,
          supplierProductCode: input.supplierProductCode,
          purchasePrice: input.purchasePrice?.toString(),
          minimumOrderQty: input.minimumOrderQty?.toString(),
          description: input.description,
          densityFactor: input.densityFactor?.toString(),
          status: input.status,
          compliance: input.compliance,
          notes: input.notes,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId, action: "CREATE", entityType: "supplier_material", entityId: id, newData: material,
      });

      return reply.status(201).send({ success: true, data: material });
    },
  );

  /**
   * PUT /api/v1/materials/supplier/:id
   */
  app.put(
    "/supplier/:id",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });

      const bodyParsed = updateSupplierMaterialSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid material data", code: "VALIDATION_ERROR", details: bodyParsed.error.flatten().fieldErrors });
      }

      const { id } = paramsParsed.data;
      const [existing] = await ctx.tenantDb
        .select().from(supplierMaterials)
        .where(and(eq(supplierMaterials.id, id), isNull(supplierMaterials.deletedAt)))
        .limit(1);

      if (!existing) return reply.status(404).send({ error: "Material not found", code: "NOT_FOUND" });

      const input = bodyParsed.data;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.supplierName !== undefined) updateData.supplierName = input.supplierName;
      if (input.subcategoryId !== undefined) updateData.subcategoryId = input.subcategoryId;
      if (input.unitOfMeasure !== undefined) updateData.unitOfMeasure = input.unitOfMeasure;
      if (input.addressId !== undefined) updateData.addressId = input.addressId;
      if (input.supplierProductCode !== undefined) updateData.supplierProductCode = input.supplierProductCode;
      if (input.purchasePrice !== undefined) updateData.purchasePrice = input.purchasePrice?.toString();
      if (input.minimumOrderQty !== undefined) updateData.minimumOrderQty = input.minimumOrderQty?.toString();
      if (input.description !== undefined) updateData.description = input.description;
      if (input.densityFactor !== undefined) updateData.densityFactor = input.densityFactor?.toString();
      if (input.status !== undefined) updateData.status = input.status;
      if (input.compliance !== undefined) updateData.compliance = input.compliance;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const [updated] = await ctx.tenantDb
        .update(supplierMaterials).set(updateData).where(eq(supplierMaterials.id, id)).returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId, action: "UPDATE", entityType: "supplier_material", entityId: id, previousData: existing, newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/materials/supplier/:id
   */
  app.delete(
    "/supplier/:id",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });

      const { id } = parsed.data;
      const [existing] = await ctx.tenantDb
        .select().from(supplierMaterials)
        .where(and(eq(supplierMaterials.id, id), isNull(supplierMaterials.deletedAt)))
        .limit(1);

      if (!existing) return reply.status(404).send({ error: "Material not found", code: "NOT_FOUND" });

      await ctx.tenantDb.update(supplierMaterials).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(supplierMaterials.id, id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId, action: "DELETE", entityType: "supplier_material", entityId: id, previousData: existing,
      });

      return { success: true, data: { id } };
    },
  );

  // ════════════════════════════════════════════════════
  // CUSTOMER MATERIALS — sell-side
  // ════════════════════════════════════════════════════

  /**
   * GET /api/v1/materials/customer
   */
  app.get(
    "/customer",
    { preHandler: requirePermission("view:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = customerMaterialListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", code: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors });
      }

      const query = parsed.data;
      const conditions = [isNull(customerMaterials.deletedAt)];
      if (query.search) conditions.push(ilike(customerMaterials.name, `%${query.search}%`));
      if (query.status) conditions.push(eq(customerMaterials.status, query.status));
      if (query.customerId) conditions.push(eq(customerMaterials.customerId, query.customerId));
      if (query.subcategoryId) conditions.push(eq(customerMaterials.subcategoryId, query.subcategoryId));
      if (query.addressId) conditions.push(eq(customerMaterials.addressId, query.addressId));

      if (query.cursor) {
        conditions.push(gt(customerMaterials.createdAt, new Date(query.cursor)));
      }

      const rows = await ctx.tenantDb
        .select({
          material: customerMaterials,
          subcategoryName: materialSubcategories.name,
          categoryName: materialCategories.name,
          companyName: companies.name,
          addressLabel: sql<string>`concat(${addresses.streetAddress}, ', ', ${addresses.suburb})`,
        })
        .from(customerMaterials)
        .leftJoin(materialSubcategories, eq(customerMaterials.subcategoryId, materialSubcategories.id))
        .leftJoin(materialCategories, eq(materialSubcategories.categoryId, materialCategories.id))
        .leftJoin(companies, eq(customerMaterials.customerId, companies.id))
        .leftJoin(addresses, eq(customerMaterials.addressId, addresses.id))
        .where(and(...conditions))
        .orderBy(asc(customerMaterials.name))
        .limit(query.limit + 1);

      const hasMore = rows.length > query.limit;
      if (hasMore) rows.pop();

      const data = rows.map((r) => ({
        ...r.material,
        subcategoryName: r.subcategoryName,
        categoryName: r.categoryName,
        companyName: r.companyName,
        addressLabel: r.addressLabel,
      }));

      const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.createdAt.toISOString() : null;

      return { success: true, data: { data, nextCursor, hasMore } };
    },
  );

  /**
   * GET /api/v1/materials/customer/:id
   */
  app.get(
    "/customer/:id",
    { preHandler: requirePermission("view:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });

      const rows = await ctx.tenantDb
        .select({
          material: customerMaterials,
          subcategoryName: materialSubcategories.name,
          categoryName: materialCategories.name,
          companyName: companies.name,
          addressLabel: sql<string>`concat(${addresses.streetAddress}, ', ', ${addresses.suburb})`,
        })
        .from(customerMaterials)
        .leftJoin(materialSubcategories, eq(customerMaterials.subcategoryId, materialSubcategories.id))
        .leftJoin(materialCategories, eq(materialSubcategories.categoryId, materialCategories.id))
        .leftJoin(companies, eq(customerMaterials.customerId, companies.id))
        .leftJoin(addresses, eq(customerMaterials.addressId, addresses.id))
        .where(and(eq(customerMaterials.id, parsed.data.id), isNull(customerMaterials.deletedAt)))
        .limit(1);

      if (rows.length === 0) return reply.status(404).send({ error: "Material not found", code: "NOT_FOUND" });
      const row = rows[0]!;
      return { success: true, data: { ...row.material, subcategoryName: row.subcategoryName, categoryName: row.categoryName, companyName: row.companyName, addressLabel: row.addressLabel } };
    },
  );

  /**
   * POST /api/v1/materials/customer
   */
  app.post(
    "/customer",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = createCustomerMaterialSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid material data", code: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors });
      }

      // Validate customer
      const [customer] = await ctx.tenantDb
        .select().from(companies)
        .where(and(eq(companies.id, parsed.data.customerId), eq(companies.isCustomer, true), isNull(companies.deletedAt)))
        .limit(1);
      if (!customer) return reply.status(400).send({ error: "Customer company not found or not marked as customer", code: "VALIDATION_ERROR" });

      const id = crypto.randomUUID();
      const input = parsed.data;
      const [material] = await ctx.tenantDb
        .insert(customerMaterials)
        .values({
          id,
          customerId: input.customerId,
          customerName: input.customerName,
          name: input.name,
          subcategoryId: input.subcategoryId,
          unitOfMeasure: input.unitOfMeasure,
          addressId: input.addressId,
          salePrice: input.salePrice?.toString(),
          description: input.description,
          densityFactor: input.densityFactor?.toString(),
          status: input.status,
          compliance: input.compliance,
          notes: input.notes,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId, action: "CREATE", entityType: "customer_material", entityId: id, newData: material,
      });

      return reply.status(201).send({ success: true, data: material });
    },
  );

  /**
   * PUT /api/v1/materials/customer/:id
   */
  app.put(
    "/customer/:id",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });

      const bodyParsed = updateCustomerMaterialSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid material data", code: "VALIDATION_ERROR", details: bodyParsed.error.flatten().fieldErrors });
      }

      const { id } = paramsParsed.data;
      const [existing] = await ctx.tenantDb
        .select().from(customerMaterials)
        .where(and(eq(customerMaterials.id, id), isNull(customerMaterials.deletedAt)))
        .limit(1);

      if (!existing) return reply.status(404).send({ error: "Material not found", code: "NOT_FOUND" });

      const input = bodyParsed.data;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.customerName !== undefined) updateData.customerName = input.customerName;
      if (input.subcategoryId !== undefined) updateData.subcategoryId = input.subcategoryId;
      if (input.unitOfMeasure !== undefined) updateData.unitOfMeasure = input.unitOfMeasure;
      if (input.addressId !== undefined) updateData.addressId = input.addressId;
      if (input.salePrice !== undefined) updateData.salePrice = input.salePrice?.toString();
      if (input.description !== undefined) updateData.description = input.description;
      if (input.densityFactor !== undefined) updateData.densityFactor = input.densityFactor?.toString();
      if (input.status !== undefined) updateData.status = input.status;
      if (input.compliance !== undefined) updateData.compliance = input.compliance;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const [updated] = await ctx.tenantDb
        .update(customerMaterials).set(updateData).where(eq(customerMaterials.id, id)).returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId, action: "UPDATE", entityType: "customer_material", entityId: id, previousData: existing, newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/materials/customer/:id
   */
  app.delete(
    "/customer/:id",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });

      const { id } = parsed.data;
      const [existing] = await ctx.tenantDb
        .select().from(customerMaterials)
        .where(and(eq(customerMaterials.id, id), isNull(customerMaterials.deletedAt)))
        .limit(1);

      if (!existing) return reply.status(404).send({ error: "Material not found", code: "NOT_FOUND" });

      await ctx.tenantDb.update(customerMaterials).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(customerMaterials.id, id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId, action: "DELETE", entityType: "customer_material", entityId: id, previousData: existing,
      });

      return { success: true, data: { id } };
    },
  );

  // ════════════════════════════════════════════════════
  // DISPOSAL MATERIALS — accept/supply at disposal sites
  // ════════════════════════════════════════════════════

  /**
   * GET /api/v1/materials/disposal
   */
  app.get(
    "/disposal",
    { preHandler: requirePermission("view:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = disposalMaterialListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid query", code: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors });
      }

      const query = parsed.data;
      const conditions = [isNull(disposalMaterials.deletedAt)];
      if (query.search) conditions.push(ilike(disposalMaterials.name, `%${query.search}%`));
      if (query.status) conditions.push(eq(disposalMaterials.status, query.status));
      if (query.materialMode) conditions.push(eq(disposalMaterials.materialMode, query.materialMode));
      if (query.subcategoryId) conditions.push(eq(disposalMaterials.subcategoryId, query.subcategoryId));
      if (query.addressId) conditions.push(eq(disposalMaterials.addressId, query.addressId));

      if (query.cursor) {
        conditions.push(gt(disposalMaterials.createdAt, new Date(query.cursor)));
      }

      const rows = await ctx.tenantDb
        .select({
          material: disposalMaterials,
          subcategoryName: materialSubcategories.name,
          categoryName: materialCategories.name,
          addressLabel: sql<string>`concat(${addresses.streetAddress}, ', ', ${addresses.suburb})`,
        })
        .from(disposalMaterials)
        .leftJoin(materialSubcategories, eq(disposalMaterials.subcategoryId, materialSubcategories.id))
        .leftJoin(materialCategories, eq(materialSubcategories.categoryId, materialCategories.id))
        .leftJoin(addresses, eq(disposalMaterials.addressId, addresses.id))
        .where(and(...conditions))
        .orderBy(asc(disposalMaterials.name))
        .limit(query.limit + 1);

      const hasMore = rows.length > query.limit;
      if (hasMore) rows.pop();

      const data = rows.map((r) => ({
        ...r.material,
        subcategoryName: r.subcategoryName,
        categoryName: r.categoryName,
        addressLabel: r.addressLabel,
      }));

      const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.createdAt.toISOString() : null;

      return { success: true, data: { data, nextCursor, hasMore } };
    },
  );

  /**
   * GET /api/v1/materials/disposal/:id
   */
  app.get(
    "/disposal/:id",
    { preHandler: requirePermission("view:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });

      const rows = await ctx.tenantDb
        .select({
          material: disposalMaterials,
          subcategoryName: materialSubcategories.name,
          categoryName: materialCategories.name,
          addressLabel: sql<string>`concat(${addresses.streetAddress}, ', ', ${addresses.suburb})`,
        })
        .from(disposalMaterials)
        .leftJoin(materialSubcategories, eq(disposalMaterials.subcategoryId, materialSubcategories.id))
        .leftJoin(materialCategories, eq(materialSubcategories.categoryId, materialCategories.id))
        .leftJoin(addresses, eq(disposalMaterials.addressId, addresses.id))
        .where(and(eq(disposalMaterials.id, parsed.data.id), isNull(disposalMaterials.deletedAt)))
        .limit(1);

      if (rows.length === 0) return reply.status(404).send({ error: "Material not found", code: "NOT_FOUND" });
      const row = rows[0]!;
      return { success: true, data: { ...row.material, subcategoryName: row.subcategoryName, categoryName: row.categoryName, addressLabel: row.addressLabel } };
    },
  );

  /**
   * POST /api/v1/materials/disposal
   */
  app.post(
    "/disposal",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = createDisposalMaterialSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: "Invalid material data", code: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors });
      }

      // Validate address exists
      const [addr] = await ctx.tenantDb
        .select().from(addresses)
        .where(and(eq(addresses.id, parsed.data.addressId), isNull(addresses.deletedAt)))
        .limit(1);
      if (!addr) return reply.status(400).send({ error: "Address not found", code: "VALIDATION_ERROR" });

      const id = crypto.randomUUID();
      const input = parsed.data;
      const [material] = await ctx.tenantDb
        .insert(disposalMaterials)
        .values({
          id,
          addressId: input.addressId,
          name: input.name,
          subcategoryId: input.subcategoryId,
          unitOfMeasure: input.unitOfMeasure,
          materialMode: input.materialMode,
          tipFee: input.tipFee?.toString(),
          environmentalLevy: input.environmentalLevy?.toString(),
          minimumCharge: input.minimumCharge?.toString(),
          salePrice: input.salePrice?.toString(),
          description: input.description,
          densityFactor: input.densityFactor?.toString(),
          status: input.status,
          compliance: input.compliance,
          notes: input.notes,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId, action: "CREATE", entityType: "disposal_material", entityId: id, newData: material,
      });

      return reply.status(201).send({ success: true, data: material });
    },
  );

  /**
   * PUT /api/v1/materials/disposal/:id
   */
  app.put(
    "/disposal/:id",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });

      const bodyParsed = updateDisposalMaterialSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid material data", code: "VALIDATION_ERROR", details: bodyParsed.error.flatten().fieldErrors });
      }

      const { id } = paramsParsed.data;
      const [existing] = await ctx.tenantDb
        .select().from(disposalMaterials)
        .where(and(eq(disposalMaterials.id, id), isNull(disposalMaterials.deletedAt)))
        .limit(1);

      if (!existing) return reply.status(404).send({ error: "Material not found", code: "NOT_FOUND" });

      const input = bodyParsed.data;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateData.name = input.name;
      if (input.subcategoryId !== undefined) updateData.subcategoryId = input.subcategoryId;
      if (input.unitOfMeasure !== undefined) updateData.unitOfMeasure = input.unitOfMeasure;
      if (input.materialMode !== undefined) updateData.materialMode = input.materialMode;
      if (input.tipFee !== undefined) updateData.tipFee = input.tipFee?.toString();
      if (input.environmentalLevy !== undefined) updateData.environmentalLevy = input.environmentalLevy?.toString();
      if (input.minimumCharge !== undefined) updateData.minimumCharge = input.minimumCharge?.toString();
      if (input.salePrice !== undefined) updateData.salePrice = input.salePrice?.toString();
      if (input.description !== undefined) updateData.description = input.description;
      if (input.densityFactor !== undefined) updateData.densityFactor = input.densityFactor?.toString();
      if (input.status !== undefined) updateData.status = input.status;
      if (input.compliance !== undefined) updateData.compliance = input.compliance;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const [updated] = await ctx.tenantDb
        .update(disposalMaterials).set(updateData).where(eq(disposalMaterials.id, id)).returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId, action: "UPDATE", entityType: "disposal_material", entityId: id, previousData: existing, newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/materials/disposal/:id
   */
  app.delete(
    "/disposal/:id",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid ID", code: "VALIDATION_ERROR" });

      const { id } = parsed.data;
      const [existing] = await ctx.tenantDb
        .select().from(disposalMaterials)
        .where(and(eq(disposalMaterials.id, id), isNull(disposalMaterials.deletedAt)))
        .limit(1);

      if (!existing) return reply.status(404).send({ error: "Material not found", code: "NOT_FOUND" });

      await ctx.tenantDb.update(disposalMaterials).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(disposalMaterials.id, id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId, action: "DELETE", entityType: "disposal_material", entityId: id, previousData: existing,
      });

      return { success: true, data: { id } };
    },
  );

  // ════════════════════════════════════════════════════
  // DISPOSAL SITE SETTINGS
  // ════════════════════════════════════════════════════

  /**
   * GET /api/v1/materials/disposal-site-settings/:addressId
   */
  app.get(
    "/disposal-site-settings/:id",
    { preHandler: requirePermission("view:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) return reply.status(400).send({ error: "Invalid address ID", code: "VALIDATION_ERROR" });

      const [settings] = await ctx.tenantDb
        .select()
        .from(disposalSiteSettings)
        .where(eq(disposalSiteSettings.addressId, parsed.data.id))
        .limit(1);

      if (!settings) {
        return { success: true, data: null };
      }

      return { success: true, data: settings };
    },
  );

  /**
   * PUT /api/v1/materials/disposal-site-settings/:addressId
   * Create or update disposal site settings for an address.
   */
  app.put(
    "/disposal-site-settings/:id",
    { preHandler: requirePermission("manage:materials") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) return reply.status(400).send({ error: "Invalid address ID", code: "VALIDATION_ERROR" });

      const bodyParsed = updateDisposalSiteSettingsSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: "Invalid settings data", code: "VALIDATION_ERROR", details: bodyParsed.error.flatten().fieldErrors });
      }

      const addressId = paramsParsed.data.id;

      // Validate address exists
      const [addr] = await ctx.tenantDb
        .select().from(addresses)
        .where(and(eq(addresses.id, addressId), isNull(addresses.deletedAt)))
        .limit(1);
      if (!addr) return reply.status(404).send({ error: "Address not found", code: "NOT_FOUND" });

      // Check if settings already exist — upsert
      const [existing] = await ctx.tenantDb
        .select().from(disposalSiteSettings)
        .where(eq(disposalSiteSettings.addressId, addressId))
        .limit(1);

      const input = bodyParsed.data;

      if (existing) {
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        if (input.operatingHours !== undefined) updateData.operatingHours = input.operatingHours;
        if (input.acceptedMaterials !== undefined) updateData.acceptedMaterials = input.acceptedMaterials;
        if (input.rejectedMaterials !== undefined) updateData.rejectedMaterials = input.rejectedMaterials;
        if (input.epaLicenceNumber !== undefined) updateData.epaLicenceNumber = input.epaLicenceNumber;
        if (input.epaLicenceExpiry !== undefined) updateData.epaLicenceExpiry = input.epaLicenceExpiry;
        if (input.wasteCodes !== undefined) updateData.wasteCodes = input.wasteCodes;
        if (input.accountTerms !== undefined) updateData.accountTerms = input.accountTerms;
        if (input.creditLimit !== undefined) updateData.creditLimit = input.creditLimit?.toString();
        if (input.preApprovalRequired !== undefined) updateData.preApprovalRequired = input.preApprovalRequired;
        if (input.accountsContactName !== undefined) updateData.accountsContactName = input.accountsContactName;
        if (input.accountsContactPhone !== undefined) updateData.accountsContactPhone = input.accountsContactPhone;
        if (input.accountsContactEmail !== undefined) updateData.accountsContactEmail = input.accountsContactEmail;
        if (input.notes !== undefined) updateData.notes = input.notes;

        const [updated] = await ctx.tenantDb
          .update(disposalSiteSettings).set(updateData).where(eq(disposalSiteSettings.id, existing.id)).returning();

        await ctx.tenantDb.insert(auditLog).values({
          userId: ctx.userId, action: "UPDATE", entityType: "disposal_site_settings", entityId: existing.id, previousData: existing, newData: updated,
        });

        return { success: true, data: updated };
      } else {
        const id = crypto.randomUUID();
        const [created] = await ctx.tenantDb
          .insert(disposalSiteSettings)
          .values({
            id,
            addressId,
            operatingHours: input.operatingHours,
            acceptedMaterials: input.acceptedMaterials,
            rejectedMaterials: input.rejectedMaterials,
            epaLicenceNumber: input.epaLicenceNumber,
            epaLicenceExpiry: input.epaLicenceExpiry,
            wasteCodes: input.wasteCodes,
            accountTerms: input.accountTerms,
            creditLimit: input.creditLimit?.toString(),
            preApprovalRequired: input.preApprovalRequired ?? false,
            accountsContactName: input.accountsContactName,
            accountsContactPhone: input.accountsContactPhone,
            accountsContactEmail: input.accountsContactEmail,
            notes: input.notes,
          })
          .returning();

        await ctx.tenantDb.insert(auditLog).values({
          userId: ctx.userId, action: "CREATE", entityType: "disposal_site_settings", entityId: id, newData: created,
        });

        return reply.status(201).send({ success: true, data: created });
      }
    },
  );
}
