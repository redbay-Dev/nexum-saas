import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireTenant, tenant } from "../middleware/tenant.js";
import { getPermissions } from "@nexum/shared";

export async function authMeRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/auth/me
   * Returns the current user's identity, role, and permissions within the tenant.
   * Used by the frontend to control UI visibility and permission checks.
   *
   * Session is validated against OpShield's JWKS — see middleware/auth.ts.
   */
  app.get(
    "/me",
    { preHandler: [requireTenant] },
    async (request: FastifyRequest) => {
      const ctx = tenant(request);

      return {
        success: true,
        data: {
          userId: ctx.userId,
          email: ctx.userEmail,
          name: ctx.userName,
          tenantId: ctx.tenantId,
          role: ctx.role,
          isOwner: ctx.isOwner,
          permissions: getPermissions(ctx.role),
        },
      };
    },
  );
}
