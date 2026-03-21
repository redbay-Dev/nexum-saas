import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import { tenantUsers } from "../db/schema/public.js";
import { auditLog } from "../db/schema/tenant.js";
import { updateUserRoleSchema, updateUserStatusSchema, idParamSchema } from "@nexum/shared";
import { db } from "../db/client.js";

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/users
   * List all users for the current tenant.
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:users") },
    async (request: FastifyRequest) => {
      const ctx = tenant(request);
      const publicDb = db;

      const users = await publicDb
        .select({
          id: tenantUsers.id,
          userId: tenantUsers.userId,
          displayName: tenantUsers.displayName,
          email: tenantUsers.email,
          role: tenantUsers.role,
          isOwner: tenantUsers.isOwner,
          status: tenantUsers.status,
          createdAt: tenantUsers.createdAt,
          updatedAt: tenantUsers.updatedAt,
        })
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, ctx.tenantId))
        .orderBy(tenantUsers.displayName);

      return { success: true, data: users };
    },
  );

  /**
   * PUT /api/v1/users/:id/role
   * Change a user's role. Cannot change own role or demote the last owner.
   */
  app.put(
    "/:id/role",
    { preHandler: requirePermission("manage:users") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const publicDb = db;

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid user ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateUserRoleSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid role data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const targetId = paramsParsed.data.id;
      const { role } = bodyParsed.data;

      // Find the target user
      const [targetUser] = await publicDb
        .select()
        .from(tenantUsers)
        .where(and(eq(tenantUsers.id, targetId), eq(tenantUsers.tenantId, ctx.tenantId)))
        .limit(1);

      if (!targetUser) {
        return reply.status(404).send({ error: "User not found", code: "NOT_FOUND" });
      }

      // Cannot change own role
      if (targetUser.userId === ctx.userId) {
        return reply.status(400).send({
          error: "Cannot change your own role",
          code: "SELF_MODIFICATION",
        });
      }

      // Cannot demote the last owner
      if (targetUser.isOwner && role !== "owner") {
        const owners = await publicDb
          .select({ id: tenantUsers.id })
          .from(tenantUsers)
          .where(
            and(
              eq(tenantUsers.tenantId, ctx.tenantId),
              eq(tenantUsers.isOwner, true),
              eq(tenantUsers.status, "active"),
            ),
          );

        if (owners.length <= 1) {
          return reply.status(400).send({
            error: "Cannot demote the last owner",
            code: "LAST_OWNER",
          });
        }
      }

      const [updated] = await publicDb
        .update(tenantUsers)
        .set({
          role,
          isOwner: role === "owner",
          updatedAt: new Date(),
        })
        .where(eq(tenantUsers.id, targetId))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "user_role",
        entityId: targetId,
        previousData: { role: targetUser.role, isOwner: targetUser.isOwner },
        newData: { role, isOwner: role === "owner" },
      });

      return { success: true, data: updated };
    },
  );

  /**
   * PUT /api/v1/users/:id/status
   * Activate or deactivate a user. Cannot deactivate self.
   */
  app.put(
    "/:id/status",
    { preHandler: requirePermission("manage:users") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const publicDb = db;

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: "Invalid user ID", code: "VALIDATION_ERROR" });
      }

      const bodyParsed = updateUserStatusSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid status data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const targetId = paramsParsed.data.id;
      const { status } = bodyParsed.data;

      const [targetUser] = await publicDb
        .select()
        .from(tenantUsers)
        .where(and(eq(tenantUsers.id, targetId), eq(tenantUsers.tenantId, ctx.tenantId)))
        .limit(1);

      if (!targetUser) {
        return reply.status(404).send({ error: "User not found", code: "NOT_FOUND" });
      }

      // Cannot deactivate self
      if (targetUser.userId === ctx.userId && status === "deactivated") {
        return reply.status(400).send({
          error: "Cannot deactivate your own account",
          code: "SELF_MODIFICATION",
        });
      }

      const [updated] = await publicDb
        .update(tenantUsers)
        .set({ status, updatedAt: new Date() })
        .where(eq(tenantUsers.id, targetId))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "user_status",
        entityId: targetId,
        previousData: { status: targetUser.status },
        newData: { status },
      });

      return { success: true, data: updated };
    },
  );
}
