import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireTenant, tenant } from "../middleware/tenant.js";
import { getPermissions } from "@nexum/shared";

export async function authMeRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/auth/me
   * Returns the current user's identity, role, and permissions within the tenant.
   * Used by the frontend to control UI visibility and permission checks.
   */
  app.get("/me", async (request: FastifyRequest) => {
    const ctx = tenant(request);

    return {
      success: true,
      data: {
        userId: ctx.userId,
        email: ctx.userEmail,
        tenantId: ctx.tenantId,
        role: ctx.role,
        isOwner: ctx.isOwner,
        permissions: getPermissions(ctx.role),
      },
    };
  });
}
