import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, ilike, or, sql, desc } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import { projects, companies, auditLog } from "../db/schema/tenant.js";
import {
  createProjectSchema,
  updateProjectSchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";

const projectListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  status: z.string().optional(),
  customerId: z.uuid().optional(),
});

type ProjectListQuery = z.infer<typeof projectListQuerySchema>;

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/projects
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = projectListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query: ProjectListQuery = parsed.data;
      const limit = query.limit;

      const conditions = [isNull(projects.deletedAt)];

      if (query.status) {
        conditions.push(eq(projects.status, query.status));
      }

      if (query.customerId) {
        conditions.push(eq(projects.customerId, query.customerId));
      }

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(
          or(
            ilike(projects.name, searchPattern),
            ilike(projects.projectNumber, searchPattern),
          ) ?? sql`TRUE`,
        );
      }

      if (query.cursor) {
        conditions.push(sql`${projects.id} < ${query.cursor}`);
      }

      const rows = await ctx.tenantDb
        .select({
          project: projects,
          customerName: companies.name,
        })
        .from(projects)
        .leftJoin(companies, eq(projects.customerId, companies.id))
        .where(and(...conditions))
        .orderBy(desc(projects.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.project.id ?? null : null;

      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(projects)
        .where(and(isNull(projects.deletedAt)));

      const flatData = data.map((row) => ({
        ...row.project,
        customerName: row.customerName,
      }));

      return {
        success: true,
        data: { data: flatData, nextCursor, hasMore, total: countResult?.count ?? 0 },
      };
    },
  );

  /**
   * GET /api/v1/projects/:id
   */
  app.get(
    "/:id",
    { preHandler: requirePermission("view:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid project ID",
          code: "VALIDATION_ERROR",
        });
      }

      const [row] = await ctx.tenantDb
        .select({
          project: projects,
          customerName: companies.name,
        })
        .from(projects)
        .leftJoin(companies, eq(projects.customerId, companies.id))
        .where(and(eq(projects.id, parsed.data.id), isNull(projects.deletedAt)))
        .limit(1);

      if (!row) {
        return reply.status(404).send({
          error: "Project not found",
          code: "NOT_FOUND",
        });
      }

      return {
        success: true,
        data: {
          ...row.project,
          customerName: row.customerName,
        },
      };
    },
  );

  /**
   * POST /api/v1/projects
   */
  app.post(
    "/",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = createProjectSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid project data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const input = parsed.data;

      // Validate customer if provided
      if (input.customerId) {
        const [customer] = await ctx.tenantDb
          .select({ id: companies.id })
          .from(companies)
          .where(
            and(
              eq(companies.id, input.customerId),
              eq(companies.isCustomer, true),
              isNull(companies.deletedAt),
            ),
          )
          .limit(1);

        if (!customer) {
          return reply.status(400).send({
            error: "Customer not found or is not marked as a customer",
            code: "INVALID_REFERENCE",
          });
        }
      }

      // Auto-generate project number: YYYY-PXXX
      const year = new Date().getFullYear();
      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(projects);
      const seq = (countResult?.count ?? 0) + 1;
      const projectNumber = `${year}-P${String(seq).padStart(3, "0")}`;

      const id = crypto.randomUUID();
      const [project] = await ctx.tenantDb
        .insert(projects)
        .values({
          id,
          projectNumber,
          name: input.name,
          customerId: input.customerId,
          startDate: input.startDate,
          endDate: input.endDate,
          salesRepId: input.salesRepId,
          projectLeadId: input.projectLeadId,
          status: input.status,
          notes: input.notes,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "project",
        entityId: id,
        newData: project,
      });

      return reply.status(201).send({ success: true, data: project });
    },
  );

  /**
   * PUT /api/v1/projects/:id
   */
  app.put(
    "/:id",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid project ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = updateProjectSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid project data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { id } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(projects)
        .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Project not found",
          code: "NOT_FOUND",
        });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) updateValues.name = input.name;
      if (input.customerId !== undefined) updateValues.customerId = input.customerId;
      if (input.startDate !== undefined) updateValues.startDate = input.startDate;
      if (input.endDate !== undefined) updateValues.endDate = input.endDate;
      if (input.salesRepId !== undefined) updateValues.salesRepId = input.salesRepId;
      if (input.projectLeadId !== undefined) updateValues.projectLeadId = input.projectLeadId;
      if (input.status !== undefined) updateValues.status = input.status;
      if (input.notes !== undefined) updateValues.notes = input.notes;

      const [updated] = await ctx.tenantDb
        .update(projects)
        .set(updateValues)
        .where(eq(projects.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "project",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/projects/:id
   */
  app.delete(
    "/:id",
    { preHandler: requirePermission("manage:jobs") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid project ID",
          code: "VALIDATION_ERROR",
        });
      }

      const { id } = parsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(projects)
        .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Project not found",
          code: "NOT_FOUND",
        });
      }

      const [deleted] = await ctx.tenantDb
        .update(projects)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "project",
        entityId: id,
        previousData: existing,
        newData: deleted,
      });

      return { success: true, data: { id } };
    },
  );
}
