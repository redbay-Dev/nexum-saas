import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, ilike, or, sql, desc } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  addresses,
  companyAddresses,
  companies,
  regions,
  contacts,
  entryPoints,
  auditLog,
} from "../db/schema/tenant.js";
import {
  createAddressSchema,
  updateAddressSchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";

const addressListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  companyId: z.uuid().optional(),
  regionId: z.uuid().optional(),
  state: z.string().max(3).optional(),
  type: z.string().optional(),
});

type AddressListQuery = z.infer<typeof addressListQuerySchema>;

const linkCompanyBodySchema = z.object({
  companyId: z.uuid(),
});

export async function addressRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/addresses
   * List addresses with pagination, search, and filtering.
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:addresses") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = addressListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query: AddressListQuery = parsed.data;
      const limit = query.limit;

      const conditions = [isNull(addresses.deletedAt)];

      if (query.state) {
        conditions.push(eq(addresses.state, query.state));
      }

      if (query.regionId) {
        conditions.push(eq(addresses.regionId, query.regionId));
      }

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(
          or(
            ilike(addresses.streetAddress, searchPattern),
            ilike(addresses.suburb, searchPattern),
            ilike(addresses.postcode, searchPattern),
          ) ?? sql`TRUE`,
        );
      }

      if (query.cursor) {
        conditions.push(sql`${addresses.id} < ${query.cursor}`);
      }

      // If filtering by company, join through company_addresses
      if (query.companyId) {
        const linkedAddressIds = await ctx.tenantDb
          .select({ addressId: companyAddresses.addressId })
          .from(companyAddresses)
          .where(eq(companyAddresses.companyId, query.companyId));

        const ids = linkedAddressIds.map((r) => r.addressId);
        if (ids.length === 0) {
          return {
            success: true,
            data: { data: [], nextCursor: null, hasMore: false, total: 0 },
          };
        }
        conditions.push(sql`${addresses.id} = ANY(${ids})`);
      }

      // If filtering by type, check the JSONB array
      if (query.type) {
        conditions.push(sql`${addresses.types} @> ${JSON.stringify([query.type])}::jsonb`);
      }

      const rows = await ctx.tenantDb
        .select()
        .from(addresses)
        .where(and(...conditions))
        .orderBy(desc(addresses.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(addresses)
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
   * GET /api/v1/addresses/:id
   * Get a single address with its linked companies, contacts, and entry points.
   */
  app.get(
    "/:id",
    { preHandler: requirePermission("view:addresses") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid address ID",
          code: "VALIDATION_ERROR",
        });
      }

      const [address] = await ctx.tenantDb
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, parsed.data.id), isNull(addresses.deletedAt)))
        .limit(1);

      if (!address) {
        return reply.status(404).send({
          error: "Address not found",
          code: "NOT_FOUND",
        });
      }

      // Fetch linked companies
      const linkedCompanies = await ctx.tenantDb
        .select({
          id: companies.id,
          name: companies.name,
          tradingName: companies.tradingName,
          isCustomer: companies.isCustomer,
          isContractor: companies.isContractor,
          isSupplier: companies.isSupplier,
        })
        .from(companyAddresses)
        .innerJoin(companies, eq(companyAddresses.companyId, companies.id))
        .where(
          and(
            eq(companyAddresses.addressId, address.id),
            isNull(companies.deletedAt),
          ),
        );

      // Fetch contacts at this address
      const siteContacts = await ctx.tenantDb
        .select()
        .from(contacts)
        .where(
          and(eq(contacts.addressId, address.id), isNull(contacts.deletedAt)),
        );

      // Fetch entry points
      const addressEntryPoints = await ctx.tenantDb
        .select()
        .from(entryPoints)
        .where(
          and(
            eq(entryPoints.addressId, address.id),
            isNull(entryPoints.deletedAt),
          ),
        );

      return {
        success: true,
        data: {
          ...address,
          companies: linkedCompanies,
          contacts: siteContacts,
          entryPoints: addressEntryPoints,
        },
      };
    },
  );

  /**
   * POST /api/v1/addresses
   * Create a new address. Optionally link to a company via companyId in the body.
   */
  app.post(
    "/",
    { preHandler: requirePermission("manage:addresses") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const bodySchema = createAddressSchema.extend({
        companyId: z.uuid().optional(),
      });

      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid address data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { companyId, ...input } = parsed.data;

      // Verify region exists if provided
      if (input.regionId) {
        const [region] = await ctx.tenantDb
          .select({ id: regions.id })
          .from(regions)
          .where(eq(regions.id, input.regionId))
          .limit(1);
        if (!region) {
          return reply.status(400).send({
            error: "Region not found",
            code: "INVALID_REFERENCE",
          });
        }
      }

      // Verify company exists if linking
      if (companyId) {
        const [company] = await ctx.tenantDb
          .select({ id: companies.id })
          .from(companies)
          .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
          .limit(1);
        if (!company) {
          return reply.status(400).send({
            error: "Company not found",
            code: "INVALID_REFERENCE",
          });
        }
      }

      const id = crypto.randomUUID();

      const [address] = await ctx.tenantDb
        .insert(addresses)
        .values({
          id,
          streetAddress: input.streetAddress,
          suburb: input.suburb,
          state: input.state,
          postcode: input.postcode,
          latitude: input.latitude?.toString(),
          longitude: input.longitude?.toString(),
          regionId: input.regionId,
          types: input.types,
          operatingHours: input.operatingHours,
          accessConditions: input.accessConditions,
          siteNotes: input.siteNotes,
        })
        .returning();

      // Link to company if provided
      if (companyId) {
        await ctx.tenantDb.insert(companyAddresses).values({
          companyId,
          addressId: id,
        });
      }

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "address",
        entityId: id,
        newData: address,
      });

      return reply.status(201).send({ success: true, data: address });
    },
  );

  /**
   * PUT /api/v1/addresses/:id
   */
  app.put(
    "/:id",
    { preHandler: requirePermission("manage:addresses") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid address ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = updateAddressSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid address data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { id } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, id), isNull(addresses.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Address not found",
          code: "NOT_FOUND",
        });
      }

      // Verify region if being changed
      if (input.regionId) {
        const [region] = await ctx.tenantDb
          .select({ id: regions.id })
          .from(regions)
          .where(eq(regions.id, input.regionId))
          .limit(1);
        if (!region) {
          return reply.status(400).send({
            error: "Region not found",
            code: "INVALID_REFERENCE",
          });
        }
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };

      if (input.streetAddress !== undefined) updateValues.streetAddress = input.streetAddress;
      if (input.suburb !== undefined) updateValues.suburb = input.suburb;
      if (input.state !== undefined) updateValues.state = input.state;
      if (input.postcode !== undefined) updateValues.postcode = input.postcode;
      if (input.latitude !== undefined) updateValues.latitude = input.latitude?.toString();
      if (input.longitude !== undefined) updateValues.longitude = input.longitude?.toString();
      if (input.regionId !== undefined) updateValues.regionId = input.regionId;
      if (input.types !== undefined) updateValues.types = input.types;
      if (input.operatingHours !== undefined) updateValues.operatingHours = input.operatingHours;
      if (input.accessConditions !== undefined) updateValues.accessConditions = input.accessConditions;
      if (input.siteNotes !== undefined) updateValues.siteNotes = input.siteNotes;

      const [updated] = await ctx.tenantDb
        .update(addresses)
        .set(updateValues)
        .where(eq(addresses.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "address",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/addresses/:id
   * Soft-delete an address.
   */
  app.delete(
    "/:id",
    { preHandler: requirePermission("manage:addresses") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid address ID",
          code: "VALIDATION_ERROR",
        });
      }

      const { id } = parsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(addresses)
        .where(and(eq(addresses.id, id), isNull(addresses.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Address not found",
          code: "NOT_FOUND",
        });
      }

      const [deleted] = await ctx.tenantDb
        .update(addresses)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(addresses.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "address",
        entityId: id,
        previousData: existing,
        newData: deleted,
      });

      return { success: true, data: { id } };
    },
  );

  /**
   * POST /api/v1/addresses/:id/companies
   * Link a company to this address.
   */
  app.post(
    "/:id/companies",
    { preHandler: requirePermission("manage:addresses") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid address ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = linkCompanyBodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid request body",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { id: addressId } = paramsParsed.data;
      const { companyId } = bodyParsed.data;

      // Verify address exists
      const [address] = await ctx.tenantDb
        .select({ id: addresses.id })
        .from(addresses)
        .where(and(eq(addresses.id, addressId), isNull(addresses.deletedAt)))
        .limit(1);

      if (!address) {
        return reply.status(404).send({
          error: "Address not found",
          code: "NOT_FOUND",
        });
      }

      // Verify company exists
      const [company] = await ctx.tenantDb
        .select({ id: companies.id })
        .from(companies)
        .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
        .limit(1);

      if (!company) {
        return reply.status(400).send({
          error: "Company not found",
          code: "INVALID_REFERENCE",
        });
      }

      // Check if link already exists
      const [existingLink] = await ctx.tenantDb
        .select()
        .from(companyAddresses)
        .where(
          and(
            eq(companyAddresses.addressId, addressId),
            eq(companyAddresses.companyId, companyId),
          ),
        )
        .limit(1);

      if (existingLink) {
        return reply.status(409).send({
          error: "Company is already linked to this address",
          code: "ALREADY_EXISTS",
        });
      }

      const [link] = await ctx.tenantDb
        .insert(companyAddresses)
        .values({ companyId, addressId })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "company_address",
        entityId: link?.id,
        newData: { companyId, addressId },
      });

      return reply.status(201).send({ success: true, data: link });
    },
  );

  /**
   * DELETE /api/v1/addresses/:id/companies/:companyId
   * Unlink a company from this address.
   */
  app.delete(
    "/:id/companies/:companyId",
    { preHandler: requirePermission("manage:addresses") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsSchema = z.object({
        id: z.uuid(),
        companyId: z.uuid(),
      });

      const parsed = paramsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid parameters",
          code: "VALIDATION_ERROR",
        });
      }

      const { id: addressId, companyId } = parsed.data;

      const [existingLink] = await ctx.tenantDb
        .select()
        .from(companyAddresses)
        .where(
          and(
            eq(companyAddresses.addressId, addressId),
            eq(companyAddresses.companyId, companyId),
          ),
        )
        .limit(1);

      if (!existingLink) {
        return reply.status(404).send({
          error: "Company-address link not found",
          code: "NOT_FOUND",
        });
      }

      await ctx.tenantDb
        .delete(companyAddresses)
        .where(eq(companyAddresses.id, existingLink.id));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "company_address",
        entityId: existingLink.id,
        previousData: { companyId, addressId },
      });

      return { success: true, data: { addressId, companyId } };
    },
  );
}
