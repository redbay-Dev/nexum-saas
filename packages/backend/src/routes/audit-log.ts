import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, gte, lte, ilike, or, desc, sql } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import { auditLog } from "../db/schema/tenant.js";
import { auditLogQuerySchema } from "@nexum/shared";

export async function auditLogRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/audit-log
   * Paginated, filterable audit log viewer.
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:audit_log") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = auditLogQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query = parsed.data;
      const limit = query.limit;

      // Build filter conditions
      const conditions: ReturnType<typeof eq>[] = [];

      if (query.userId) {
        conditions.push(eq(auditLog.userId, query.userId));
      }

      if (query.action) {
        conditions.push(eq(auditLog.action, query.action));
      }

      if (query.entityType) {
        conditions.push(eq(auditLog.entityType, query.entityType));
      }

      if (query.entityId) {
        conditions.push(eq(auditLog.entityId, query.entityId));
      }

      if (query.dateFrom) {
        conditions.push(gte(auditLog.createdAt, new Date(query.dateFrom)));
      }

      if (query.dateTo) {
        conditions.push(lte(auditLog.createdAt, new Date(query.dateTo)));
      }

      if (query.search) {
        conditions.push(
          or(
            ilike(auditLog.entityType, `%${query.search}%`),
            ilike(auditLog.action, `%${query.search}%`),
          )!,
        );
      }

      // Cursor-based pagination (cursor = ISO timestamp of last item)
      if (query.cursor) {
        conditions.push(lte(auditLog.createdAt, new Date(query.cursor)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Fetch one extra to determine hasMore
      const entries = await ctx.tenantDb
        .select()
        .from(auditLog)
        .where(whereClause)
        .orderBy(desc(auditLog.createdAt))
        .limit(limit + 1);

      const hasMore = entries.length > limit;
      const data = hasMore ? entries.slice(0, limit) : entries;
      const nextCursor = hasMore && data.length > 0
        ? data[data.length - 1]!.createdAt.toISOString()
        : null;

      // Get total count for the filters (without cursor/limit)
      const countConditions = conditions.filter(
        (_, i) => !(query.cursor && i === conditions.length - 1),
      );
      const countWhereClause = countConditions.length > 0 ? and(...countConditions) : undefined;
      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(auditLog)
        .where(countWhereClause);

      return {
        success: true,
        data: data,
        nextCursor,
        hasMore,
        total: countResult?.count ?? 0,
      };
    },
  );
}
