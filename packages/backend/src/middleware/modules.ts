import type { FastifyRequest, FastifyReply } from "fastify";
import type { Module } from "@nexum/shared";
import { redis } from "../lib/redis.js";
import { db } from "../db/client.js";
import { tenants } from "../db/schema/public.js";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import type { TenantContext } from "./tenant.js";

/** Cached entitlements shape from OpShield or local DB. */
interface TenantEntitlements {
  modules: string[];
  plan: string;
  maxUsers: number;
  fetchedAt: number;
}

const CACHE_TTL_SECONDS = 900; // 15 minutes

function entitlementsCacheKey(tenantId: string): string {
  return `opshield:entitlements:${tenantId}`;
}

/**
 * Fetch entitlements for a tenant. Tries Redis cache first, then
 * OpShield API, falls back to the local tenants table.
 */
async function getEntitlements(
  tenantId: string,
  opshieldTenantId: string | null,
): Promise<TenantEntitlements> {
  // Check Redis cache
  const cached = await redis.get(entitlementsCacheKey(tenantId));
  if (cached) {
    try {
      return JSON.parse(cached) as TenantEntitlements;
    } catch {
      // Corrupted cache, fetch fresh
    }
  }

  // Try OpShield API if we have an opshield tenant ID
  if (opshieldTenantId) {
    try {
      const response = await fetch(
        `${config.opshield.apiUrl}/api/tenants/${opshieldTenantId}/entitlements`,
        {
          headers: {
            Authorization: `Bearer ${config.opshield.apiKey}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(5000),
        },
      );

      if (response.ok) {
        const body = (await response.json()) as {
          data: {
            modules: string[];
            plan: string;
            maxUsers: number;
          };
        };

        const entitlements: TenantEntitlements = {
          modules: body.data.modules,
          plan: body.data.plan,
          maxUsers: body.data.maxUsers,
          fetchedAt: Date.now(),
        };

        await redis.set(
          entitlementsCacheKey(tenantId),
          JSON.stringify(entitlements),
          "EX",
          CACHE_TTL_SECONDS,
        );

        return entitlements;
      }
    } catch {
      // OpShield unavailable — fall back to local DB
    }
  }

  // Fallback: read from local tenants table
  const [tenant] = await db
    .select({
      enabledModules: tenants.enabledModules,
      plan: tenants.plan,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const entitlements: TenantEntitlements = {
    modules: (tenant?.enabledModules as string[] | null) ?? [],
    plan: tenant?.plan ?? "starter",
    maxUsers: 0,
    fetchedAt: Date.now(),
  };

  // Cache the local fallback too (shorter TTL)
  await redis.set(
    entitlementsCacheKey(tenantId),
    JSON.stringify(entitlements),
    "EX",
    300, // 5 min for fallback
  );

  return entitlements;
}

/**
 * Factory function that creates a preHandler to check if a module is enabled
 * for the current tenant. Must be used AFTER requireTenant.
 *
 * Usage:
 *   app.post("/", { preHandler: [requireTenant, requireModule("invoicing")] }, handler)
 */
export function requireModule(moduleId: Module) {
  return async function checkModule(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const ctx = (request as FastifyRequest & { tenant: TenantContext }).tenant;
    if (!ctx) {
      void reply.status(401).send({
        error: "Authentication required",
        code: "UNAUTHENTICATED",
      });
      return;
    }

    // Look up opshield tenant ID from tenants table
    const [tenantRecord] = await db
      .select({ opshieldTenantId: tenants.opshieldTenantId })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    const entitlements = await getEntitlements(
      ctx.tenantId,
      tenantRecord?.opshieldTenantId ?? null,
    );

    if (!entitlements.modules.includes(moduleId)) {
      const friendlyNames: Record<string, string> = {
        invoicing: "Invoicing",
        rcti: "RCTI",
        xero: "Xero Integration",
        compliance: "Compliance",
        sms: "SMS Notifications",
        docket_processing: "Docket Processing",
        materials: "Materials",
        map_planning: "Map Planning",
        ai_automation: "AI & Automation",
        reporting: "Reporting",
        portal: "Contractor/Customer Portal",
      };
      const name = friendlyNames[moduleId] ?? moduleId;

      void reply.status(403).send({
        error: `${name} is not included in your current plan. Please contact your administrator to enable this feature.`,
        code: "MODULE_NOT_ENABLED",
        module: moduleId,
      });
      return;
    }
  };
}
