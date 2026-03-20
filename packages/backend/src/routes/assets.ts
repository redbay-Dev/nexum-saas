import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, ilike, or, sql, desc } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  assets,
  assetCategories,
  assetSubcategories,
  companies,
  defaultPairings,
  auditLog,
} from "../db/schema/tenant.js";
import {
  createAssetSchema,
  updateAssetSchema,
  idParamSchema,
  paginationQuerySchema,
} from "@nexum/shared";
import { z } from "zod";

// ── Query schemas ──

const assetListQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  categoryId: z.uuid().optional(),
  status: z.string().optional(),
  ownership: z.enum(["tenant", "contractor"]).optional(),
  contractorCompanyId: z.uuid().optional(),
});

type AssetListQuery = z.infer<typeof assetListQuerySchema>;

const pairingParamSchema = z.object({
  id: z.uuid(),
  pairingId: z.uuid(),
});

export async function assetRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/assets
   * List assets with pagination, search, and filtering.
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = assetListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid query parameters",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const query: AssetListQuery = parsed.data;
      const limit = query.limit;

      const conditions = [isNull(assets.deletedAt)];

      if (query.categoryId) {
        conditions.push(eq(assets.categoryId, query.categoryId));
      }

      if (query.status) {
        conditions.push(eq(assets.status, query.status));
      }

      if (query.ownership) {
        conditions.push(eq(assets.ownership, query.ownership));
      }

      if (query.contractorCompanyId) {
        conditions.push(eq(assets.contractorCompanyId, query.contractorCompanyId));
      }

      if (query.search) {
        const searchPattern = `%${query.search}%`;
        conditions.push(
          or(
            ilike(assets.assetNumber, searchPattern),
            ilike(assets.registrationNumber, searchPattern),
            ilike(assets.make, searchPattern),
            ilike(assets.model, searchPattern),
            ilike(assets.vin, searchPattern),
          ) ?? sql`TRUE`,
        );
      }

      if (query.cursor) {
        conditions.push(sql`${assets.id} < ${query.cursor}`);
      }

      const rows = await ctx.tenantDb
        .select({
          asset: assets,
          categoryName: assetCategories.name,
          categoryType: assetCategories.type,
          subcategoryName: assetSubcategories.name,
          contractorName: companies.name,
        })
        .from(assets)
        .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
        .leftJoin(assetSubcategories, eq(assets.subcategoryId, assetSubcategories.id))
        .leftJoin(companies, eq(assets.contractorCompanyId, companies.id))
        .where(and(...conditions))
        .orderBy(desc(assets.createdAt))
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.asset.id ?? null : null;

      // Get total count (without cursor/limit)
      const countConditions = conditions.filter(
        (_, i) => i !== conditions.length - (query.cursor ? 1 : 0),
      );
      const [countResult] = await ctx.tenantDb
        .select({ count: sql<number>`count(*)::int` })
        .from(assets)
        .where(and(...countConditions));

      const flatData = data.map((row) => ({
        ...row.asset,
        categoryName: row.categoryName,
        categoryType: row.categoryType,
        subcategoryName: row.subcategoryName,
        contractorName: row.contractorName,
      }));

      return {
        success: true,
        data: {
          data: flatData,
          nextCursor,
          hasMore,
          total: countResult?.count ?? 0,
        },
      };
    },
  );

  /**
   * GET /api/v1/assets/:id
   * Get a single asset with category, subcategory, contractor, and default pairings.
   */
  app.get(
    "/:id",
    { preHandler: requirePermission("view:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid asset ID",
          code: "VALIDATION_ERROR",
        });
      }

      const [row] = await ctx.tenantDb
        .select({
          asset: assets,
          categoryName: assetCategories.name,
          categoryType: assetCategories.type,
          subcategoryName: assetSubcategories.name,
          contractorName: companies.name,
          // Category feature toggles
          enableSpecifications: assetCategories.enableSpecifications,
          enableWeightSpecs: assetCategories.enableWeightSpecs,
          enableMassScheme: assetCategories.enableMassScheme,
          enableEngineHours: assetCategories.enableEngineHours,
          enableCapacityFields: assetCategories.enableCapacityFields,
          enableRegistration: assetCategories.enableRegistration,
        })
        .from(assets)
        .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
        .leftJoin(assetSubcategories, eq(assets.subcategoryId, assetSubcategories.id))
        .leftJoin(companies, eq(assets.contractorCompanyId, companies.id))
        .where(and(eq(assets.id, parsed.data.id), isNull(assets.deletedAt)))
        .limit(1);

      if (!row) {
        return reply.status(404).send({
          error: "Asset not found",
          code: "NOT_FOUND",
        });
      }

      // Fetch default pairings where this asset is truck or trailer
      const pairingsAsTruck = await ctx.tenantDb
        .select({
          pairing: defaultPairings,
          trailerAssetNumber: assets.assetNumber,
          trailerRegistration: assets.registrationNumber,
          trailerMake: assets.make,
          trailerModel: assets.model,
        })
        .from(defaultPairings)
        .innerJoin(assets, eq(defaultPairings.trailerId, assets.id))
        .where(eq(defaultPairings.truckId, parsed.data.id));

      const pairingsAsTrailer = await ctx.tenantDb
        .select({
          pairing: defaultPairings,
          truckAssetNumber: assets.assetNumber,
          truckRegistration: assets.registrationNumber,
          truckMake: assets.make,
          truckModel: assets.model,
        })
        .from(defaultPairings)
        .innerJoin(assets, eq(defaultPairings.truckId, assets.id))
        .where(eq(defaultPairings.trailerId, parsed.data.id));

      return {
        success: true,
        data: {
          ...row.asset,
          categoryName: row.categoryName,
          categoryType: row.categoryType,
          subcategoryName: row.subcategoryName,
          contractorName: row.contractorName,
          categoryToggles: {
            enableSpecifications: row.enableSpecifications,
            enableWeightSpecs: row.enableWeightSpecs,
            enableMassScheme: row.enableMassScheme,
            enableEngineHours: row.enableEngineHours,
            enableCapacityFields: row.enableCapacityFields,
            enableRegistration: row.enableRegistration,
          },
          defaultPairings: {
            asTruck: pairingsAsTruck.map((p) => ({
              id: p.pairing.id,
              trailerId: p.pairing.trailerId,
              trailerAssetNumber: p.trailerAssetNumber,
              trailerRegistration: p.trailerRegistration,
              trailerMake: p.trailerMake,
              trailerModel: p.trailerModel,
              notes: p.pairing.notes,
            })),
            asTrailer: pairingsAsTrailer.map((p) => ({
              id: p.pairing.id,
              truckId: p.pairing.truckId,
              truckAssetNumber: p.truckAssetNumber,
              truckRegistration: p.truckRegistration,
              truckMake: p.truckMake,
              truckModel: p.truckModel,
              notes: p.pairing.notes,
            })),
          },
        },
      };
    },
  );

  /**
   * POST /api/v1/assets
   * Create a new asset.
   */
  app.post(
    "/",
    { preHandler: requirePermission("manage:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = createAssetSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid asset data",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const input = parsed.data;

      // Validate category exists
      const [category] = await ctx.tenantDb
        .select()
        .from(assetCategories)
        .where(
          and(
            eq(assetCategories.id, input.categoryId),
            isNull(assetCategories.deletedAt),
          ),
        )
        .limit(1);

      if (!category) {
        return reply.status(400).send({
          error: "Asset category not found",
          code: "INVALID_REFERENCE",
        });
      }

      // Validate subcategory if provided
      if (input.subcategoryId) {
        const [subcategory] = await ctx.tenantDb
          .select()
          .from(assetSubcategories)
          .where(
            and(
              eq(assetSubcategories.id, input.subcategoryId),
              eq(assetSubcategories.categoryId, input.categoryId),
              isNull(assetSubcategories.deletedAt),
            ),
          )
          .limit(1);

        if (!subcategory) {
          return reply.status(400).send({
            error: "Subcategory not found or does not belong to the selected category",
            code: "INVALID_REFERENCE",
          });
        }
      }

      // Validate contractor company if contractor-owned
      if (input.ownership === "contractor") {
        if (!input.contractorCompanyId) {
          return reply.status(400).send({
            error: "Contractor company is required for contractor-owned assets",
            code: "VALIDATION_ERROR",
          });
        }

        const [company] = await ctx.tenantDb
          .select()
          .from(companies)
          .where(
            and(
              eq(companies.id, input.contractorCompanyId),
              eq(companies.isContractor, true),
              isNull(companies.deletedAt),
            ),
          )
          .limit(1);

        if (!company) {
          return reply.status(400).send({
            error: "Contractor company not found or is not marked as a contractor",
            code: "INVALID_REFERENCE",
          });
        }
      }

      const id = crypto.randomUUID();

      // Auto-generate asset number if not provided: YYYY-XXXX format
      let assetNumber = input.assetNumber;
      if (!assetNumber) {
        const year = new Date().getFullYear();
        const [countResult] = await ctx.tenantDb
          .select({ count: sql<number>`count(*)::int` })
          .from(assets);
        const seq = (countResult?.count ?? 0) + 1;
        assetNumber = `${year}-${String(seq).padStart(4, "0")}`;
      }

      const [asset] = await ctx.tenantDb
        .insert(assets)
        .values({
          id,
          assetNumber,
          categoryId: input.categoryId,
          subcategoryId: input.subcategoryId,
          ownership: input.ownership,
          contractorCompanyId:
            input.ownership === "contractor"
              ? input.contractorCompanyId
              : null,
          status: input.status,
          registrationNumber: input.registrationNumber,
          registrationState: input.registrationState,
          registrationExpiry: input.registrationExpiry,
          make: input.make,
          model: input.model,
          year: input.year,
          vin: input.vin,
          tareWeight: input.tareWeight?.toString(),
          gvm: input.gvm?.toString(),
          gcm: input.gcm?.toString(),
          vehicleConfiguration: input.vehicleConfiguration,
          massScheme: input.massScheme,
          bodyMaterial: input.bodyMaterial,
          sideHeight: input.sideHeight?.toString(),
          bodyType: input.bodyType,
          equipmentFitted: input.equipmentFitted,
          capacity: input.capacity?.toString(),
          capacityUnit: input.capacityUnit,
          engineHours: input.engineHours?.toString(),
          engineHoursDate: input.engineHoursDate,
          odometer: input.odometer?.toString(),
          odometerDate: input.odometerDate,
          notes: input.notes,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "asset",
        entityId: id,
        newData: asset,
      });

      return reply.status(201).send({ success: true, data: asset });
    },
  );

  /**
   * PUT /api/v1/assets/:id
   * Update an asset.
   */
  app.put(
    "/:id",
    { preHandler: requirePermission("manage:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid asset ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodyParsed = updateAssetSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid asset data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { id } = paramsParsed.data;
      const input = bodyParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(assets)
        .where(and(eq(assets.id, id), isNull(assets.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Asset not found",
          code: "NOT_FOUND",
        });
      }

      // Validate category if being changed
      if (input.categoryId) {
        const [category] = await ctx.tenantDb
          .select()
          .from(assetCategories)
          .where(
            and(
              eq(assetCategories.id, input.categoryId),
              isNull(assetCategories.deletedAt),
            ),
          )
          .limit(1);

        if (!category) {
          return reply.status(400).send({
            error: "Asset category not found",
            code: "INVALID_REFERENCE",
          });
        }
      }

      // Validate contractor company if being set to contractor
      const newOwnership = input.ownership ?? existing.ownership;
      if (newOwnership === "contractor") {
        const contractorId = input.contractorCompanyId ?? existing.contractorCompanyId;
        if (!contractorId) {
          return reply.status(400).send({
            error: "Contractor company is required for contractor-owned assets",
            code: "VALIDATION_ERROR",
          });
        }
      }

      // Build explicit update values, converting numbers to strings for numeric columns
      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.assetNumber !== undefined) updateValues.assetNumber = input.assetNumber;
      if (input.categoryId !== undefined) updateValues.categoryId = input.categoryId;
      if (input.subcategoryId !== undefined) updateValues.subcategoryId = input.subcategoryId;
      if (input.ownership !== undefined) updateValues.ownership = input.ownership;
      updateValues.contractorCompanyId =
        newOwnership === "contractor"
          ? (input.contractorCompanyId ?? existing.contractorCompanyId)
          : null;
      if (input.status !== undefined) updateValues.status = input.status;
      if (input.registrationNumber !== undefined) updateValues.registrationNumber = input.registrationNumber;
      if (input.registrationState !== undefined) updateValues.registrationState = input.registrationState;
      if (input.registrationExpiry !== undefined) updateValues.registrationExpiry = input.registrationExpiry;
      if (input.make !== undefined) updateValues.make = input.make;
      if (input.model !== undefined) updateValues.model = input.model;
      if (input.year !== undefined) updateValues.year = input.year;
      if (input.vin !== undefined) updateValues.vin = input.vin;
      if (input.tareWeight !== undefined) updateValues.tareWeight = input.tareWeight?.toString();
      if (input.gvm !== undefined) updateValues.gvm = input.gvm?.toString();
      if (input.gcm !== undefined) updateValues.gcm = input.gcm?.toString();
      if (input.vehicleConfiguration !== undefined) updateValues.vehicleConfiguration = input.vehicleConfiguration;
      if (input.massScheme !== undefined) updateValues.massScheme = input.massScheme;
      if (input.bodyMaterial !== undefined) updateValues.bodyMaterial = input.bodyMaterial;
      if (input.sideHeight !== undefined) updateValues.sideHeight = input.sideHeight?.toString();
      if (input.bodyType !== undefined) updateValues.bodyType = input.bodyType;
      if (input.equipmentFitted !== undefined) updateValues.equipmentFitted = input.equipmentFitted;
      if (input.capacity !== undefined) updateValues.capacity = input.capacity?.toString();
      if (input.capacityUnit !== undefined) updateValues.capacityUnit = input.capacityUnit;
      if (input.engineHours !== undefined) updateValues.engineHours = input.engineHours?.toString();
      if (input.engineHoursDate !== undefined) updateValues.engineHoursDate = input.engineHoursDate;
      if (input.odometer !== undefined) updateValues.odometer = input.odometer?.toString();
      if (input.odometerDate !== undefined) updateValues.odometerDate = input.odometerDate;
      if (input.notes !== undefined) updateValues.notes = input.notes;

      const [updated] = await ctx.tenantDb
        .update(assets)
        .set(updateValues)
        .where(eq(assets.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "asset",
        entityId: id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );

  /**
   * PUT /api/v1/assets/:id/status
   * Update asset operational status.
   */
  app.put(
    "/:id/status",
    { preHandler: requirePermission("manage:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid asset ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodySchema = z.object({
        status: z.enum([
          "available",
          "in_use",
          "maintenance",
          "inspection",
          "repairs",
          "grounded",
          "retired",
        ]),
        reason: z.string().optional(),
      });

      const bodyParsed = bodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid status data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { id } = paramsParsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(assets)
        .where(and(eq(assets.id, id), isNull(assets.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Asset not found",
          code: "NOT_FOUND",
        });
      }

      const [updated] = await ctx.tenantDb
        .update(assets)
        .set({ status: bodyParsed.data.status, updatedAt: new Date() })
        .where(eq(assets.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "STATUS_CHANGE",
        entityType: "asset",
        entityId: id,
        previousData: { status: existing.status },
        newData: {
          status: bodyParsed.data.status,
          reason: bodyParsed.data.reason,
        },
      });

      return { success: true, data: updated };
    },
  );

  /**
   * DELETE /api/v1/assets/:id
   * Soft-delete an asset.
   */
  app.delete(
    "/:id",
    { preHandler: requirePermission("manage:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const parsed = idParamSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid asset ID",
          code: "VALIDATION_ERROR",
        });
      }

      const { id } = parsed.data;

      const [existing] = await ctx.tenantDb
        .select()
        .from(assets)
        .where(and(eq(assets.id, id), isNull(assets.deletedAt)))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Asset not found",
          code: "NOT_FOUND",
        });
      }

      const [deleted] = await ctx.tenantDb
        .update(assets)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(assets.id, id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "asset",
        entityId: id,
        previousData: existing,
        newData: deleted,
      });

      return { success: true, data: { id } };
    },
  );

  // ── Default Pairings ──

  /**
   * POST /api/v1/assets/:id/pairings
   * Create a default pairing where this asset is the truck.
   */
  app.post(
    "/:id/pairings",
    { preHandler: requirePermission("manage:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = idParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid asset ID",
          code: "VALIDATION_ERROR",
        });
      }

      const bodySchema = z.object({
        trailerId: z.uuid(),
        notes: z.string().optional(),
      });

      const bodyParsed = bodySchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid pairing data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const truckId = paramsParsed.data.id;
      const { trailerId } = bodyParsed.data;

      // Verify truck exists and is a truck category
      const [truck] = await ctx.tenantDb
        .select({ id: assets.id, categoryType: assetCategories.type })
        .from(assets)
        .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
        .where(and(eq(assets.id, truckId), isNull(assets.deletedAt)))
        .limit(1);

      if (!truck) {
        return reply.status(404).send({
          error: "Truck asset not found",
          code: "NOT_FOUND",
        });
      }

      if (truck.categoryType !== "truck") {
        return reply.status(400).send({
          error: "The selected asset is not a truck",
          code: "VALIDATION_ERROR",
        });
      }

      // Verify trailer exists and is a trailer category
      const [trailer] = await ctx.tenantDb
        .select({ id: assets.id, categoryType: assetCategories.type })
        .from(assets)
        .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
        .where(and(eq(assets.id, trailerId), isNull(assets.deletedAt)))
        .limit(1);

      if (!trailer) {
        return reply.status(400).send({
          error: "Trailer asset not found",
          code: "INVALID_REFERENCE",
        });
      }

      if (trailer.categoryType !== "trailer") {
        return reply.status(400).send({
          error: "The selected asset is not a trailer",
          code: "VALIDATION_ERROR",
        });
      }

      // Check for duplicate pairing
      const [existingPairing] = await ctx.tenantDb
        .select()
        .from(defaultPairings)
        .where(
          and(
            eq(defaultPairings.truckId, truckId),
            eq(defaultPairings.trailerId, trailerId),
          ),
        )
        .limit(1);

      if (existingPairing) {
        return reply.status(409).send({
          error: "This truck-trailer pairing already exists",
          code: "DUPLICATE",
        });
      }

      const id = crypto.randomUUID();
      const [pairing] = await ctx.tenantDb
        .insert(defaultPairings)
        .values({
          id,
          truckId,
          trailerId,
          notes: bodyParsed.data.notes,
        })
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "CREATE",
        entityType: "default_pairing",
        entityId: id,
        newData: pairing,
      });

      return reply.status(201).send({ success: true, data: pairing });
    },
  );

  /**
   * DELETE /api/v1/assets/:id/pairings/:pairingId
   * Remove a default pairing.
   */
  app.delete(
    "/:id/pairings/:pairingId",
    { preHandler: requirePermission("manage:assets") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const paramsParsed = pairingParamSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: "Invalid parameters",
          code: "VALIDATION_ERROR",
        });
      }

      const [existing] = await ctx.tenantDb
        .select()
        .from(defaultPairings)
        .where(eq(defaultPairings.id, paramsParsed.data.pairingId))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          error: "Pairing not found",
          code: "NOT_FOUND",
        });
      }

      await ctx.tenantDb
        .delete(defaultPairings)
        .where(eq(defaultPairings.id, paramsParsed.data.pairingId));

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "DELETE",
        entityType: "default_pairing",
        entityId: paramsParsed.data.pairingId,
        previousData: existing,
      });

      return { success: true, data: { id: paramsParsed.data.pairingId } };
    },
  );
}
