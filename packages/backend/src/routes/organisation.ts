import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { requireTenant, requirePermission, tenant } from "../middleware/tenant.js";
import { organisation, auditLog } from "../db/schema/tenant.js";
import { updateOrganisationSchema } from "@nexum/shared";

export async function organisationRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireTenant);

  /**
   * GET /api/v1/organisation
   * Returns the tenant's organisation record (company profile).
   */
  app.get(
    "/",
    { preHandler: requirePermission("view:organisation") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const [org] = await ctx.tenantDb
        .select()
        .from(organisation)
        .limit(1);

      if (!org) {
        return reply.status(404).send({ error: "Organisation not found", code: "NOT_FOUND" });
      }

      return { success: true, data: org };
    },
  );

  /**
   * PUT /api/v1/organisation
   * Update the tenant's organisation record.
   */
  app.put(
    "/",
    { preHandler: requirePermission("manage:organisation") },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const ctx = tenant(request);

      const bodyParsed = updateOrganisationSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({
          error: "Invalid organisation data",
          code: "VALIDATION_ERROR",
          details: bodyParsed.error.flatten().fieldErrors,
        });
      }

      const input = bodyParsed.data;

      // Get current org for audit trail
      const [existing] = await ctx.tenantDb
        .select()
        .from(organisation)
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Organisation not found", code: "NOT_FOUND" });
      }

      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.companyName !== undefined) updateValues.companyName = input.companyName;
      if (input.tradingName !== undefined) updateValues.tradingName = input.tradingName;
      if (input.abn !== undefined) updateValues.abn = input.abn;
      if (input.phone !== undefined) updateValues.phone = input.phone;
      if (input.email !== undefined) updateValues.email = input.email;
      if (input.website !== undefined) updateValues.website = input.website;
      if (input.logoUrl !== undefined) updateValues.logoUrl = input.logoUrl;
      if (input.registeredAddress !== undefined) updateValues.registeredAddress = input.registeredAddress;
      if (input.bankBsb !== undefined) updateValues.bankBsb = input.bankBsb;
      if (input.bankAccountNumber !== undefined) updateValues.bankAccountNumber = input.bankAccountNumber;
      if (input.bankAccountName !== undefined) updateValues.bankAccountName = input.bankAccountName;
      if (input.defaultPaymentTerms !== undefined) updateValues.defaultPaymentTerms = input.defaultPaymentTerms;
      if (input.timezone !== undefined) updateValues.timezone = input.timezone;

      const [updated] = await ctx.tenantDb
        .update(organisation)
        .set(updateValues)
        .where(eq(organisation.id, existing.id))
        .returning();

      await ctx.tenantDb.insert(auditLog).values({
        userId: ctx.userId,
        action: "UPDATE",
        entityType: "organisation",
        entityId: existing.id,
        previousData: existing,
        newData: updated,
      });

      return { success: true, data: updated };
    },
  );
}
