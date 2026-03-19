import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { db, getTenantDb } from "../db/client.js";
import { tenants, tenantUsers } from "../db/schema/public.js";
import { getSession } from "./auth.js";
import type { Permission, UserRole } from "@nexum/shared";
import { hasPermission } from "@nexum/shared";

export interface TenantContext {
  userId: string;
  userEmail: string;
  tenantId: string;
  schemaName: string;
  role: UserRole;
  isOwner: boolean;
  tenantDb: ReturnType<typeof getTenantDb>;
}

/**
 * Resolve tenant context from the authenticated session.
 *
 * Looks up the user's tenant membership (including role), then creates a
 * tenant-scoped Drizzle client. Returns null if user is not authenticated
 * or has no tenant.
 */
export async function getTenantContext(
  request: FastifyRequest,
): Promise<TenantContext | null> {
  const session = await getSession(request);
  if (!session) return null;

  const [membership] = await db
    .select()
    .from(tenantUsers)
    .where(eq(tenantUsers.userId, session.user.id))
    .limit(1);

  if (!membership) return null;

  const [tenant] = await db
    .select({ schemaName: tenants.schemaName })
    .from(tenants)
    .where(eq(tenants.id, membership.tenantId))
    .limit(1);

  if (!tenant) return null;

  return {
    userId: session.user.id,
    userEmail: session.user.email,
    tenantId: membership.tenantId,
    schemaName: tenant.schemaName,
    role: membership.role as UserRole,
    isOwner: membership.isOwner,
    tenantDb: getTenantDb(tenant.schemaName),
  };
}

/**
 * Fastify preHandler that requires tenant context.
 * Attaches tenant context to request for use in route handlers.
 */
export async function requireTenant(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ctx = await getTenantContext(request);
  if (!ctx) {
    void reply.status(401).send({
      error: "Authentication and tenant membership required",
      code: "UNAUTHENTICATED",
    });
    return;
  }
  (request as FastifyRequest & { tenant: TenantContext }).tenant = ctx;
}

/**
 * Helper to extract tenant context from request.
 * Use inside route handlers after requireTenant preHandler.
 */
export function tenant(request: FastifyRequest): TenantContext {
  return (request as FastifyRequest & { tenant: TenantContext }).tenant;
}

/**
 * Factory function that creates a permission check preHandler.
 * Must be used AFTER requireTenant (which attaches TenantContext).
 *
 * Usage:
 *   app.post("/", { preHandler: [requireTenant, requirePermission("manage:companies")] }, handler)
 */
export function requirePermission(permission: Permission) {
  return async function checkPermission(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const ctx = (request as FastifyRequest & { tenant: TenantContext }).tenant;
    if (!ctx) {
      void reply.status(401).send({
        error: "Authentication required",
        code: "UNAUTHENTICATED",
      });
      return;
    }
    if (!hasPermission(ctx.role, permission)) {
      void reply.status(403).send({
        error: "Insufficient permissions",
        code: "FORBIDDEN",
        requiredPermission: permission,
        yourRole: ctx.role,
      });
      return;
    }
  };
}
