import type { FastifyInstance, FastifyRequest } from "fastify";
import { eq } from "drizzle-orm";
import { requireTenant, tenant } from "../middleware/tenant.js";
import { getEntitlements } from "../middleware/modules.js";
import { db } from "../db/client.js";
import { tenants } from "../db/schema/public.js";
import { getPermissions } from "@nexum/shared";

export async function authMeRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/auth/me
   * Returns the current user's identity, role, permissions, and enabled modules.
   * Used by the frontend to control UI visibility and permission checks.
   *
   * Session is validated against OpShield's JWKS — see middleware/auth.ts.
   */
  app.get(
    "/me",
    { preHandler: [requireTenant] },
    async (request: FastifyRequest) => {
      const ctx = tenant(request);

      // Fetch enabled modules for navigation filtering
      const [tenantRecord] = await db
        .select({ opshieldTenantId: tenants.opshieldTenantId })
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);

      const entitlements = await getEntitlements(
        ctx.tenantId,
        tenantRecord?.opshieldTenantId ?? null,
      );

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
          enabledModules: entitlements.modules,
        },
      };
    },
  );
}
