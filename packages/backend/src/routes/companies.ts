import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, ilike, or, sql, desc } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import { companies } from "../db/schema/tenant.js";
import { auditLog } from "../db/schema/tenant.js";
import {
  createCompanySchema,
  updateCompanySchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";

// ── Query parameter schemas ──

const companyListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  role: z.enum(["customer", "contractor", "supplier"]).optional(),
  status: z.enum(["active", "on_hold", "archived"]).optional(),
});

type CompanyListQuery = z.infer<typeof companyListQuerySchema>;

export async function companyRoutes(app: FastifyInstance): Promise<void> {
  // All routes require tenant authentication
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/companies
   * List companies with pagination, search, and role filtering.
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:companies") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = companyListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query: CompanyListQuery = parsed.data;
      const limit = query.limit;

      // Build conditions
      const conditions = [isNull(companies.deletedAt)];

      if (query.status) {
        conditions.push(eq(companies.status, query.status));
      }

      if (query.role === "customer") {
        conditions.push(eq(companies.isCustomer, true));
      } else if (query.role === "contractor") {
        conditions.push(eq(companies.isContractor, true));
      } else if (query.role === "supplier") {
        conditions.push(eq(companies.isSupplier, true));
      }

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(
          or(
            ilike(companies.name, searchPattern),
            ilike(companies.tradingName, searchPattern),
            ilike(companies.abn, searchPattern),
          ) ?? sql`TRUE`,
        );
      }

      // Cursor-based pagination
      if (query.cursor) {
        conditions.push(sql`${companies.id} < ${query.cursor}`);
      }

      const rows = await ctx.tenantDb
        .select()
        .from(companies)
        .where(and(...conditions))
        .orderBy(desc(companies.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

      // Get total count
      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(companies)
        .where(and(...conditions.filter((_, i) => i !== conditions.length - (query.cursor ? 1 : 0))));

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
   * GET /api/v1/companies/:id
   * Get a single company by ID.
   */
  app.get(
    "/:id",
    { preHandler: requirePermission("view:companies") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid company ID",
          code: "VALIDATION_ERROR",
        });
      }

      const [company] = await ctx.tenantDb
        .select()
        .from(companies)
        .where(and(eq(companies.id, parsed.data.id), isNull(companies.deletedAt)))
        .limit(1);

      if (!company) {
        return reply.status(404).send({
          error: "Company not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: company };
    },
  );

  /**
   * POST /api/v1/companies
   * Create a new company.
   */
  app.post(
    "/",
    { preHandler: requirePermission("manage:companies") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = createCompanySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid company data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const input = parsed.data;
      const id = crypto.randomUUID();

      const [company] = await ctx.tenantDb
        .insert(companies)
        .values({
          id,
          name: input.name,
          tradingName: input.tradingName,
          abn: input.abn,
          phone: input.phone,
          email: input.email,
          website: input.website,
          isCustomer: input.roles.includes("customer"),
          isContractor: input.roles.includes("contractor"),
          isSupplier: input.roles.includes("supplier"),
          status: input.status,
          notes: input.notes,
        })
        .returning();

      // Audit log
      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "company",
        entityId: id,
        newData: company,
      });

      return reply.status(201).send({ success: true, data: company });
    },
  );

  /**
   * PUT /api/v1/companies/:id
   * Update a company.
   */
  app.put(
    "/:id",
    { preHandler: requirePermission("manage:companies") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid company ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = updateCompanySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid company data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { id } = paramsParsed.data;
      const input = bodyParsed.data;

      // Check company exists
      const [existing] = await ctx.tenantDb
        .select()
        .from(companies)
        .where(and(eq(companies.id, id), isNull(companies.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Company not found",
          code: "NOT_FOUND",
        });
      }

      // Build update values
      const updateValues: Record<string, unknown> = { updatedAt: new Date() };

      if (input.name !== undefined) updateValues.name = input.name;
      if (input.tradingName !== undefined) updateValues.tradingName = input.tradingName;
      if (input.abn !== undefined) updateValues.abn = input.abn;
      if (input.phone !== undefined) updateValues.phone = input.phone;
      if (input.email !== undefined) updateValues.email = input.email;
      if (input.website !== undefined) updateValues.website = input.website;
      if (input.notes !== undefined) updateValues.notes = input.notes;
      if (input.status !== undefined) updateValues.status = input.status;

      if (input.roles !== undefined) {
        updateValues.isCustomer = input.roles.includes("customer");
        updateValues.isContractor = input.roles.includes("contractor");
        updateValues.isSupplier = input.roles.includes("supplier");
      }

      const [updated] = await ctx.tenantDb
        .update(companies)
        .set(updateValues)
        .where(eq(companies.id, id))
        .returning();

      // Audit log
      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "company",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/companies/:id
   * Soft-delete a company.
   */
  app.delete(
    "/:id",
    { preHandler: requirePermission("manage:companies") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid company ID",
          code: "VALIDATION_ERROR",
        });
      }

      const { id } = parsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(companies)
        .where(and(eq(companies.id, id), isNull(companies.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Company not found",
          code: "NOT_FOUND",
        });
      }

      const [deleted] = await ctx.tenantDb
        .update(companies)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(companies.id, id))
        .returning();

      // Audit log
      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "company",
        entityId: id,
        previousData: existing,
        newData: deleted,
      });

      return { success: true, data: { id } };
    },
  );
}
