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
  userName: string;
  tenantId: string;
  schemaName: string;
  role: UserRole;
  isOwner: boolean;
  tenantDb: ReturnType<typeof getTenantDb>;
}

/**
 * Resolve tenant context from the OpShield session.
 *
 * 1. Validates the OpShield JWT (via getSession)
 * 2. Looks up the user's tenant membership in Nexum's tenant_users table
 * 3. If not found, auto-provisions from JWT tenant_memberships (OpShield is source of truth)
 * 4. Creates a tenant-scoped Drizzle client
 *
 * Returns null if unauthenticated or not a member of any tenant.
 */
export async function getTenantContext(
  request: FastifyRequest,
): Promise<TenantContext | null> {
  const session = await getSession(request);
  if (!session) return null;

  // Look up user's tenant membership using their OpShield user ID
  let [membership] = await db
    .select()
    .from(tenantUsers)
    .where(eq(tenantUsers.userId, session.userId))
    .limit(1);

  // If no local membership exists but the JWT has tenant_memberships,
  // auto-create the user mapping. The JWT is signed by OpShield (source
  // of truth for tenant membership), so this is safe and handles cases
  // where provisioning didn't create the user entry.
  if (!membership && session.tenantMemberships.length > 0) {
    for (const jwtMembership of session.tenantMemberships) {
      const [matchingTenant] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.opshieldTenantId, jwtMembership.tenantId))
        .limit(1);

      if (matchingTenant) {
        await db.insert(tenantUsers).values({
          userId: session.userId,
          tenantId: matchingTenant.id,
          role: jwtMembership.role === "owner" ? "owner" : jwtMembership.role,
          isOwner: jwtMembership.role === "owner",
          email: session.email,
          displayName: session.name,
        }).onConflictDoNothing();

        // Re-fetch the membership we just created
        [membership] = await db
          .select()
          .from(tenantUsers)
          .where(eq(tenantUsers.userId, session.userId))
          .limit(1);

        break;
      }
    }
  }

  if (!membership) return null;

  const [tenantRecord] = await db
    .select({ schemaName: tenants.schemaName })
    .from(tenants)
    .where(eq(tenants.id, membership.tenantId))
    .limit(1);

  if (!tenantRecord) return null;

  return {
    userId: session.userId,
    userEmail: session.email,
    userName: session.name,
    tenantId: membership.tenantId,
    schemaName: tenantRecord.schemaName,
    role: membership.role as UserRole,
    isOwner: membership.isOwner,
    tenantDb: getTenantDb(tenantRecord.schemaName),
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
