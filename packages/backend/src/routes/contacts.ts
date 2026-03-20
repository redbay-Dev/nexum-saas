import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, ilike, or, sql, desc } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import { contacts, companies, addresses, auditLog } from "../db/schema/tenant.js";
import {
  createContactSchema,
  updateContactSchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";

const contactListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  companyId: z.uuid().optional(),
  addressId: z.uuid().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

type ContactListQuery = z.infer<typeof contactListQuerySchema>;

export async function contactRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/contacts
   * List contacts with pagination, search, and filtering by company or address.
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:contacts") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = contactListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query: ContactListQuery = parsed.data;
      const limit = query.limit;

      const conditions = [isNull(contacts.deletedAt)];

      if (query.status) {
        conditions.push(eq(contacts.status, query.status));
      }

      if (query.companyId) {
        conditions.push(eq(contacts.companyId, query.companyId));
      }

      if (query.addressId) {
        conditions.push(eq(contacts.addressId, query.addressId));
      }

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(
          or(
            ilike(contacts.firstName, searchPattern),
            ilike(contacts.lastName, searchPattern),
            ilike(contacts.email, searchPattern),
            ilike(contacts.phone, searchPattern),
          ) ?? sql`TRUE`,
        );
      }

      if (query.cursor) {
        conditions.push(sql`${contacts.id} < ${query.cursor}`);
      }

      const rows = await ctx.tenantDb
        .select()
        .from(contacts)
        .where(and(...conditions))
        .orderBy(desc(contacts.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(contacts)
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
   * GET /api/v1/contacts/:id
   */
  app.get(
    "/:id",
    { preHandler: requirePermission("view:contacts") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid contact ID",
          code: "VALIDATION_ERROR",
        });
      }

      const [contact] = await ctx.tenantDb
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, parsed.data.id), isNull(contacts.deletedAt)))
        .limit(1);

      if (!contact) {
        return reply.status(404).send({
          error: "Contact not found",
          code: "NOT_FOUND",
        });
      }

      return { success: true, data: contact };
    },
  );

  /**
   * POST /api/v1/contacts
   */
  app.post(
    "/",
    { preHandler: requirePermission("manage:contacts") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = createContactSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid contact data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const input = parsed.data;

      // Contacts must have at least one parent (company or address)
      if (!input.companyId && !input.addressId) {
        return reply.status(400).send({
          error: "Contact must be linked to a company or address (or both)",
          code: "VALIDATION_ERROR",
        });
      }

      // Verify parent company exists if provided
      if (input.companyId) {
        const [company] = await ctx.tenantDb
          .select({ id: companies.id })
          .from(companies)
          .where(and(eq(companies.id, input.companyId), isNull(companies.deletedAt)))
          .limit(1);
        if (!company) {
          return reply.status(400).send({
            error: "Company not found",
            code: "INVALID_REFERENCE",
          });
        }
      }

      // Verify parent address exists if provided
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

      const id = crypto.randomUUID();

      const [contact] = await ctx.tenantDb
        .insert(contacts)
        .values({
          id,
          firstName: input.firstName,
          lastName: input.lastName,
          title: input.title,
          phone: input.phone,
          email: input.email,
          companyId: input.companyId,
          addressId: input.addressId,
          preferredContactMethod: input.preferredContactMethod,
          smsOptIn: input.smsOptIn,
          status: input.status,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "contact",
        entityId: id,
        newData: contact,
      });

      return reply.status(201).send({ success: true, data: contact });
    },
  );

  /**
   * PUT /api/v1/contacts/:id
   */
  app.put(
    "/:id",
    { preHandler: requirePermission("manage:contacts") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid contact ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = updateContactSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid contact data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { id } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Contact not found",
          code: "NOT_FOUND",
        });
      }

      // Verify parent references if being changed
      if (input.companyId) {
        const [company] = await ctx.tenantDb
          .select({ id: companies.id })
          .from(companies)
          .where(and(eq(companies.id, input.companyId), isNull(companies.deletedAt)))
          .limit(1);
        if (!company) {
          return reply.status(400).send({
            error: "Company not found",
            code: "INVALID_REFERENCE",
          });
        }
      }

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

      if (input.firstName !== undefined) updateValues.firstName = input.firstName;
      if (input.lastName !== undefined) updateValues.lastName = input.lastName;
      if (input.title !== undefined) updateValues.title = input.title;
      if (input.phone !== undefined) updateValues.phone = input.phone;
      if (input.email !== undefined) updateValues.email = input.email;
      if (input.companyId !== undefined) updateValues.companyId = input.companyId;
      if (input.addressId !== undefined) updateValues.addressId = input.addressId;
      if (input.preferredContactMethod !== undefined)
        updateValues.preferredContactMethod = input.preferredContactMethod;
      if (input.smsOptIn !== undefined) updateValues.smsOptIn = input.smsOptIn;
      if (input.status !== undefined) updateValues.status = input.status;

      const [updated] = await ctx.tenantDb
        .update(contacts)
        .set(updateValues)
        .where(eq(contacts.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "contact",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/contacts/:id
   * Soft-delete a contact.
   */
  app.delete(
    "/:id",
    { preHandler: requirePermission("manage:contacts") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid contact ID",
          code: "VALIDATION_ERROR",
        });
      }

      const { id } = parsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, id), isNull(contacts.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Contact not found",
          code: "NOT_FOUND",
        });
      }

      const [deleted] = await ctx.tenantDb
        .update(contacts)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(contacts.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "contact",
        entityId: id,
        previousData: existing,
        newData: deleted,
      });

      return { success: true, data: { id } };
    },
  );
}
