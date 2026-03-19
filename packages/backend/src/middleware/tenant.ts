import type { FastifyRequest, FastifyReply } from "fastify";
import type { Permission, UserRole } from "@nexum/shared";
import { hasPermission } from "@nexum/shared";
import type { getTenantDb } from "../db/client.js";

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
 * Extract tenant context from the authenticated request.
 * In Phase 3, this will read from Better Auth session.
 * For now, returns null (placeholder).
 */
async function getTenantContext(
  _request: FastifyRequest,
): Promise<TenantContext | null> {
  // TODO: Phase 3 — Extract from Better Auth session
  // 1. Get session from cookie/token
  // 2. Look up tenant_users to get tenant membership
  // 3. Look up tenant to get schema name
  // 4. Build and return TenantContext
  return null;
}

/**
 * Fastify preHandler hook that requires tenant authentication.
 * Attaches tenant context to request.tenant.
 */
export async function requireTenant(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const ctx = await getTenantContext(request);
  if (!ctx) {
    reply.status(401).send({
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
export function tenant(
  request: FastifyRequest,
): TenantContext {
  return (request as FastifyRequest & { tenant: TenantContext }).tenant;
}

/**
 * Factory function that creates a permission check preHandler.
 * Usage: { preHandler: requirePermission("manage:companies") }
 */
export function requirePermission(permission: Permission) {
  return async function checkPermission(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const ctx = (request as FastifyRequest & { tenant: TenantContext }).tenant;
    if (!ctx) {
      reply.status(401).send({
        error: "Authentication required",
        code: "UNAUTHENTICATED",
      });
      return;
    }
    if (!hasPermission(ctx.role, permission)) {
      reply.status(403).send({
        error: `Insufficient permissions. Required: ${permission}`,
        code: "FORBIDDEN",
      });
      return;
    }
  };
}
