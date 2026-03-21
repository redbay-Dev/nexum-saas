import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, isNull, lte } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import {
  supplierMaterials,
  customerMaterials,
  disposalMaterials,
  organisation,
  auditLog,
} from "../db/schema/tenant.js";
import {
  bulkPriceUpdateSchema,
  supplierBulkPriceUpdateSchema,
} from "@nexum/shared";
import { getPriceHistory, recordPriceChange } from "../services/price-history.js";

export async function priceManagementRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  // ── GET /api/v1/price-management/history/:entityType/:entityId ──

  app.get(
    "/history/:entityType/:entityId",
    { preHandler: requirePermission("view:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const params = (request.params as Record<string, string>);
      const entityType = params.entityType;
      const entityId = params.entityId;

      if (!entityType || !entityId) {
        return reply.status(400).send({ error: "entityType and entityId required", code: "VALIDATION_ERROR" });
      }

      const history = await getPriceHistory(ctx.tenantDb, entityType, entityId);

      return { success: true, data: history };
    },
  );

  // ── POST /api/v1/price-management/bulk-update/percentage ──

  app.post(
    "/bulk-update/percentage",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const bodyParsed = bulkPriceUpdateSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid bulk update data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { materialIds, percentage, effectiveDate } = bodyParsed.data;
      const bulkUpdateId = crypto.randomUUID();
      const multiplier = 1 + percentage / 100;
      let updatedCount = 0;

      // Update supplier materials
      for (const materialId of materialIds) {
        const [supplierMat] = await ctx.tenantDb
          .select({ id: supplierMaterials.id, purchasePrice: supplierMaterials.purchasePrice })
          .from(supplierMaterials)
          .where(and(eq(supplierMaterials.id, materialId), isNull(supplierMaterials.deletedAt)))
          .limit(1);

        if (supplierMat?.purchasePrice) {
          const oldPrice = parseFloat(supplierMat.purchasePrice);
          const newPrice = Math.round(oldPrice * multiplier * 100) / 100;

          await ctx.tenantDb
            .update(supplierMaterials)
            .set({ purchasePrice: newPrice.toString(), updatedAt: new Date() })
            .where(eq(supplierMaterials.id, materialId));

          await recordPriceChange(
            ctx.tenantDb, "supplier_material", materialId,
            oldPrice, newPrice, effectiveDate, "bulk", ctx.userId, bulkUpdateId,
          );
          updatedCount++;
          continue;
        }

        // Try customer materials
        const [customerMat] = await ctx.tenantDb
          .select({ id: customerMaterials.id, salePrice: customerMaterials.salePrice })
          .from(customerMaterials)
          .where(and(eq(customerMaterials.id, materialId), isNull(customerMaterials.deletedAt)))
          .limit(1);

        if (customerMat?.salePrice) {
          const oldPrice = parseFloat(customerMat.salePrice);
          const newPrice = Math.round(oldPrice * multiplier * 100) / 100;

          await ctx.tenantDb
            .update(customerMaterials)
            .set({ salePrice: newPrice.toString(), updatedAt: new Date() })
            .where(eq(customerMaterials.id, materialId));

          await recordPriceChange(
            ctx.tenantDb, "customer_material", materialId,
            oldPrice, newPrice, effectiveDate, "bulk", ctx.userId, bulkUpdateId,
          );
          updatedCount++;
          continue;
        }

        // Try disposal materials (tip fee)
        const [disposalMat] = await ctx.tenantDb
          .select({ id: disposalMaterials.id, tipFee: disposalMaterials.tipFee })
          .from(disposalMaterials)
          .where(and(eq(disposalMaterials.id, materialId), isNull(disposalMaterials.deletedAt)))
          .limit(1);

        if (disposalMat?.tipFee) {
          const oldPrice = parseFloat(disposalMat.tipFee);
          const newPrice = Math.round(oldPrice * multiplier * 100) / 100;

          await ctx.tenantDb
            .update(disposalMaterials)
            .set({ tipFee: newPrice.toString(), updatedAt: new Date() })
            .where(eq(disposalMaterials.id, materialId));

          await recordPriceChange(
            ctx.tenantDb, "disposal_material", materialId,
            oldPrice, newPrice, effectiveDate, "bulk", ctx.userId, bulkUpdateId,
          );
          updatedCount++;
        }
      }

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "bulk_price_update",
        entityId: bulkUpdateId,
        newData: { percentage, effectiveDate, materialCount: updatedCount, bulkUpdateId },
      });

      return {
        success: true,
        data: { bulkUpdateId, updatedCount, percentage, effectiveDate },
      };
    },
  );

  // ── POST /api/v1/price-management/bulk-update/supplier ──

  app.post(
    "/bulk-update/supplier",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const bodyParsed = supplierBulkPriceUpdateSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid supplier bulk update data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const { supplierId, percentage, effectiveDate } = bodyParsed.data;
      const bulkUpdateId = crypto.randomUUID();
      const multiplier = 1 + percentage / 100;

      const materials = await ctx.tenantDb
        .select({ id: supplierMaterials.id, purchasePrice: supplierMaterials.purchasePrice })
        .from(supplierMaterials)
        .where(and(eq(supplierMaterials.supplierId, supplierId), isNull(supplierMaterials.deletedAt)));

      let updatedCount = 0;

      for (const mat of materials) {
        if (!mat.purchasePrice) continue;

        const oldPrice = parseFloat(mat.purchasePrice);
        const newPrice = Math.round(oldPrice * multiplier * 100) / 100;

        await ctx.tenantDb
          .update(supplierMaterials)
          .set({ purchasePrice: newPrice.toString(), updatedAt: new Date() })
          .where(eq(supplierMaterials.id, mat.id));

        await recordPriceChange(
          ctx.tenantDb, "supplier_material", mat.id,
          oldPrice, newPrice, effectiveDate, "bulk", ctx.userId, bulkUpdateId,
        );
        updatedCount++;
      }

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "bulk_price_update",
        entityId: bulkUpdateId,
        newData: { supplierId, percentage, effectiveDate, materialCount: updatedCount },
      });

      return {
        success: true,
        data: { bulkUpdateId, updatedCount, supplierId, percentage, effectiveDate },
      };
    },
  );

  // ── GET /api/v1/price-management/rate-review/stale ──

  app.get(
    "/rate-review/stale",
    { preHandler: requirePermission("view:pricing") },
    async (request: FastifyRequest) => {
      const ctx = tenant(request);

      // Get stale threshold from org settings
      const [org] = await ctx.tenantDb
        .select({ staleRateThresholdDays: organisation.staleRateThresholdDays })
        .from(organisation)
        .limit(1);

      const thresholdDays = org?.staleRateThresholdDays ?? 180;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - thresholdDays);

      // Find supplier materials not updated since cutoff
      const staleSupplierMaterials = await ctx.tenantDb
        .select({
          id: supplierMaterials.id,
          name: supplierMaterials.name,
          supplierName: supplierMaterials.supplierName,
          purchasePrice: supplierMaterials.purchasePrice,
          updatedAt: supplierMaterials.updatedAt,
        })
        .from(supplierMaterials)
        .where(
          and(
            isNull(supplierMaterials.deletedAt),
            lte(supplierMaterials.updatedAt, cutoffDate),
          ),
        );

      // Find customer materials not updated since cutoff
      const staleCustomerMaterials = await ctx.tenantDb
        .select({
          id: customerMaterials.id,
          name: customerMaterials.name,
          customerName: customerMaterials.customerName,
          salePrice: customerMaterials.salePrice,
          updatedAt: customerMaterials.updatedAt,
        })
        .from(customerMaterials)
        .where(
          and(
            isNull(customerMaterials.deletedAt),
            lte(customerMaterials.updatedAt, cutoffDate),
          ),
        );

      return {
        success: true,
        data: {
          thresholdDays,
          cutoffDate: cutoffDate.toISOString().split("T")[0],
          supplierMaterials: staleSupplierMaterials,
          customerMaterials: staleCustomerMaterials,
          totalStale: staleSupplierMaterials.length + staleCustomerMaterials.length,
        },
      };
    },
  );

  // ── POST /api/v1/price-management/rate-review/:entityType/:entityId/mark-reviewed ──

  app.post(
    "/rate-review/:entityType/:entityId/mark-reviewed",
    { preHandler: requirePermission("manage:pricing") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);
      const params = request.params as Record<string, string>;
      const entityType = params.entityType;
      const entityId = params.entityId;

      if (!entityType || !entityId) {
        return reply.status(400).send({ error: "entityType and entityId required", code: "VALIDATION_ERROR" });
      }

      // Touch updatedAt on the material to mark it as reviewed
      if (entityType === "supplier_material") {
        await ctx.tenantDb
          .update(supplierMaterials)
          .set({ updatedAt: new Date() })
          .where(eq(supplierMaterials.id, entityId));
      } else if (entityType === "customer_material") {
        await ctx.tenantDb
          .update(customerMaterials)
          .set({ updatedAt: new Date() })
          .where(eq(customerMaterials.id, entityId));
      } else {
        return reply.status(400).send({ error: "Invalid entity type", code: "VALIDATION_ERROR" });
      }

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "rate_review",
        entityId,
        newData: { action: "mark_reviewed", entityType },
      });

      return { success: true };
    },
  );
}
