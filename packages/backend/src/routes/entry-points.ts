import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import { entryPoints, addresses, auditLog } from "../db/schema/tenant.js";
import {
  createEntryPointSchema,
  updateEntryPointSchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";

const entryPointListQuerySchema = paginationQuerySchema.extend({
  addressId: z.uuid().optional(),
  status: z.enum(["active", "temporarily_closed", "seasonal"]).optional(),
});

type EntryPointListQuery = z.infer<typeof entryPointListQuerySchema>;

export async function entryPointRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/entry-points
   * List entry points, optionally filtered by address.
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:addresses") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = entryPointListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query: EntryPointListQuery = parsed.data;
      const limit = query.limit;

      const conditions = [isNull(entryPoints.deletedAt)];

      if (query.addressId) {
        conditions.push(eq(entryPoints.addressId, query.addressId));
      }

      if (query.status) {
        conditions.push(eq(entryPoints.status, query.status));
      }

      if (query.cursor) {
        conditions.push(sql`${entryPoints.id} < ${query.cursor}`);
      }

      const rows = await ctx.tenantDb
        .select()
        .from(entryPoints)
        .where(and(...conditions))
        .orderBy(desc(entryPoints.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(entryPoints)
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
   * GET /api/v1/entry-points/:id
   */
  app.get(
    "/:id",
    { preHandler: requirePermission("view:addresses") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid entry point ID",
          code: "VALIDATION_ERROR",
        });
      }

      const [entryPoint] = await ctx.tenantDb
        .select()
        .from(entryPoints)
        .where(and(eq(entryPoints.id, parsed.data.id), isNull(entryPoints.deletedAt)))
        .limit(1);

      if (!entryPoint) {
        return reply.status(404).send({
          error: "Entry point not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: entryPoint };
    },
  );

  /**
   * POST /api/v1/entry-points
   */
  app.post(
    "/",
    { preHandler: requirePermission("manage:addresses") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = createEntryPointSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid entry point data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const input = parsed.data;

      // Verify parent address exists
      const [address] = await ctx.tenantDb
        .select({ id: addresses.id })
        .from(addresses)
        .where(and(eq(addresses.id, input.addressId), isNull(addresses.deletedAt)))
        .limit(1);

      if (!address) {
        return reply.status(400).send({
          error: "Address not found",
          code: "INVALID_REFERENCE",
        });
      }

      const id = crypto.randomUUID();

      const [entryPoint] = await ctx.tenantDb
        .insert(entryPoints)
        .values({
          id,
          addressId: input.addressId,
          name: input.name,
          description: input.description,
          latitude: input.latitude?.toString(),
          longitude: input.longitude?.toString(),
          vehicleRestrictions: input.vehicleRestrictions,
          weightLimit: input.weightLimit?.toString(),
          operatingHours: input.operatingHours,
          driverInstructions: input.driverInstructions,
          media: input.media ?? null,
          status: input.status,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "entry_point",
        entityId: id,
        newData: entryPoint,
      });

      return reply.status(201).send({ success: true, data: entryPoint });
    },
  );

  /**
   * PUT /api/v1/entry-points/:id
   */
  app.put(
    "/:id",
    { preHandler: requirePermission("manage:addresses") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid entry point ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = updateEntryPointSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid entry point data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { id } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(entryPoints)
        .where(and(eq(entryPoints.id, id), isNull(entryPoints.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Entry point not found",
          code: "NOT_FOUND",
        });
      }

      // Verify new address if being moved
      if (input.addressId) {
        const [address] = await ctx.tenantDb
          .select({ id: addresses.id })
          .from(addresses)
          .where(and(eq(addresses.id, input.addressId), isNull(addresses.deletedAt)))
          .limit(1);
        if (!address) {
          return reply.status(400).send({
            error: "Address not found",
            code: "INVALID_REFERENCE",
          });
        }
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };

      if (input.addressId !== undefined) updateValues.addressId = input.addressId;
      if (input.name !== undefined) updateValues.name = input.name;
      if (input.description !== undefined) updateValues.description = input.description;
      if (input.latitude !== undefined) updateValues.latitude = input.latitude?.toString();
      if (input.longitude !== undefined) updateValues.longitude = input.longitude?.toString();
      if (input.vehicleRestrictions !== undefined) updateValues.vehicleRestrictions = input.vehicleRestrictions;
      if (input.weightLimit !== undefined) updateValues.weightLimit = input.weightLimit?.toString();
      if (input.operatingHours !== undefined) updateValues.operatingHours = input.operatingHours;
      if (input.driverInstructions !== undefined) updateValues.driverInstructions = input.driverInstructions;
      if (input.media !== undefined) updateValues.media = input.media;
      if (input.status !== undefined) updateValues.status = input.status;

      const [updated] = await ctx.tenantDb
        .update(entryPoints)
        .set(updateValues)
        .where(eq(entryPoints.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "entry_point",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/entry-points/:id
   * Soft-delete an entry point.
   */
  app.delete(
    "/:id",
    { preHandler: requirePermission("manage:addresses") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid entry point ID",
          code: "VALIDATION_ERROR",
        });
      }

      const { id } = parsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(entryPoints)
        .where(and(eq(entryPoints.id, id), isNull(entryPoints.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Entry point not found",
          code: "NOT_FOUND",
        });
      }

      const [deleted] = await ctx.tenantDb
        .update(entryPoints)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(entryPoints.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "entry_point",
        entityId: id,
        previousData: existing,
        newData: deleted,
      });

      return { success: true, data: { id } };
    },
  );
}
