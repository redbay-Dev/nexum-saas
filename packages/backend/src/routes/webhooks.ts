import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { verifyWebhookSignature } from "../lib/opshield-client.js";
import { redis } from "../lib/redis.js";
import { db } from "../db/client.js";
import { tenants } from "../db/schema/public.js";

/**
 * Webhook event shape from OpShield.
 * Matches @redbay/platform-types webhookPayloadSchema.
 */
interface WebhookPayload {
  id: string;
  event: string;
  tenantId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/** Redis key for entitlements cache (without prefix — ioredis adds `nexum:` automatically). */
function entitlementsCacheKey(opshieldTenantId: string): string {
  return `opshield:entitlements:${opshieldTenantId}`;
}

/** Redis key for webhook idempotency (24h TTL). */
function webhookProcessedKey(eventId: string): string {
  return `webhook:processed:${eventId}`;
}

/** Redis key for revoked session tracking (matches JWT expiry window). */
function sessionRevokedKey(userId: string): string {
  return `session:revoked:${userId}`;
}

/**
 * Look up the local Nexum tenant by OpShield tenant ID.
 * Returns the tenant row or undefined if not found.
 */
async function findTenantByOpshieldId(
  opshieldTenantId: string,
): Promise<typeof tenants.$inferSelect | undefined> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.opshieldTenantId, opshieldTenantId))
    .limit(1);
  return tenant;
}

/**
 * OpShield webhook routes.
 *
 * Handles lifecycle events for modules and tenants:
 * - module.activated / module.suspended / module.cancelled / module.plan_changed
 * - tenant.suspended / tenant.reactivated / tenant.deleted
 * - session.revoked
 * - user_count.updated
 *
 * Webhooks are HMAC-SHA256 signed. See docs/24-OPSHIELD-PLATFORM.md.
 */
export async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // Disable automatic JSON parsing — we need the raw body for signature verification
  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (_req, body, done) => {
      done(null, body);
    },
  );

  app.post(
    "/opshield",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const rawBody = request.body as string;
      const signature = request.headers["x-opshield-signature"] as
        | string
        | undefined;
      const timestamp = request.headers["x-opshield-timestamp"] as
        | string
        | undefined;

      if (!signature || !timestamp) {
        return reply.status(401).send({
          error: "Missing webhook signature headers",
          code: "WEBHOOK_UNAUTHORIZED",
        });
      }

      const valid = await verifyWebhookSignature(
        rawBody,
        signature,
        timestamp,
      );
      if (!valid) {
        request.log.warn("Invalid OpShield webhook signature");
        return reply.status(401).send({
          error: "Invalid webhook signature",
          code: "WEBHOOK_UNAUTHORIZED",
        });
      }

      let payload: WebhookPayload;
      try {
        payload = JSON.parse(rawBody) as WebhookPayload;
      } catch {
        return reply.status(400).send({
          error: "Invalid JSON body",
          code: "INVALID_PAYLOAD",
        });
      }

      // Idempotency check — reject duplicate events within 24 hours
      const alreadyProcessed = await redis.get(
        webhookProcessedKey(payload.id),
      );
      if (alreadyProcessed) {
        return reply.status(200).send({ status: "already_processed" });
      }

      request.log.info(
        { event: payload.event, tenantId: payload.tenantId },
        "OpShield webhook received",
      );

      switch (payload.event) {
        case "module.activated": {
          await invalidateEntitlementsCache(payload.tenantId);
          request.log.info(
            { tenantId: payload.tenantId, module: payload.data["moduleId"] },
            "Module activated — entitlements cache invalidated",
          );
          break;
        }

        case "module.suspended":
        case "module.cancelled": {
          await invalidateEntitlementsCache(payload.tenantId);
          request.log.info(
            {
              tenantId: payload.tenantId,
              module: payload.data["moduleId"],
              event: payload.event,
            },
            "Module disabled — entitlements cache invalidated",
          );
          break;
        }

        case "module.plan_changed": {
          await invalidateEntitlementsCache(payload.tenantId);
          request.log.info(
            { tenantId: payload.tenantId },
            "Module plan changed — entitlements cache invalidated",
          );
          break;
        }

        case "tenant.suspended": {
          await updateTenantStatus(payload.tenantId, "suspended", request);
          await invalidateEntitlementsCache(payload.tenantId);
          break;
        }

        case "tenant.reactivated": {
          await updateTenantStatus(payload.tenantId, "active", request);
          await invalidateEntitlementsCache(payload.tenantId);
          break;
        }

        case "tenant.deleted": {
          await updateTenantStatus(payload.tenantId, "cancelled", request);
          await invalidateEntitlementsCache(payload.tenantId);
          request.log.warn(
            { tenantId: payload.tenantId },
            "Tenant cancelled — data retention period started",
          );
          break;
        }

        case "session.revoked": {
          const userId = payload.data["userId"];
          if (typeof userId === "string") {
            // Mark this user's sessions as revoked for 24 hours (longer than any JWT lifetime).
            // Auth middleware checks this key before accepting a token.
            await redis.set(sessionRevokedKey(userId), "1", "EX", 86400);
            request.log.info(
              { userId, tenantId: payload.tenantId },
              "Session revoked — user must re-authenticate",
            );
          } else {
            request.log.warn(
              { tenantId: payload.tenantId },
              "session.revoked event missing userId in data",
            );
          }
          break;
        }

        case "user_count.updated": {
          // Informational — user count enforcement is handled by OpShield.
          // Log for audit trail.
          request.log.info(
            {
              tenantId: payload.tenantId,
              count: payload.data["userCount"],
            },
            "User count updated",
          );
          break;
        }

        default:
          request.log.warn(
            { event: payload.event },
            "Unknown OpShield webhook event",
          );
      }

      // Mark event as processed (24h TTL for idempotency window)
      await redis.set(webhookProcessedKey(payload.id), "1", "EX", 86400);

      return reply.status(200).send({ status: "ok" });
    },
  );
}

/**
 * Invalidate the cached entitlements for a tenant so the next
 * `requireModule()` call fetches fresh data from OpShield.
 */
async function invalidateEntitlementsCache(
  opshieldTenantId: string,
): Promise<void> {
  await redis.del(entitlementsCacheKey(opshieldTenantId));
}

/**
 * Update a tenant's status in the local Nexum database.
 * Finds the tenant by their OpShield tenant ID.
 */
async function updateTenantStatus(
  opshieldTenantId: string,
  status: string,
  request: FastifyRequest,
): Promise<void> {
  const tenant = await findTenantByOpshieldId(opshieldTenantId);
  if (!tenant) {
    request.log.warn(
      { opshieldTenantId },
      "Webhook references unknown OpShield tenant — ignoring",
    );
    return;
  }

  await db
    .update(tenants)
    .set({ status, updatedAt: new Date() })
    .where(eq(tenants.id, tenant.id));

  request.log.info(
    { tenantId: tenant.id, opshieldTenantId, status },
    `Tenant status updated to ${status}`,
  );
}
