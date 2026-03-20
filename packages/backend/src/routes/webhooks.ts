import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { verifyWebhookSignature } from "../lib/opshield-client.js";
import { redis } from "../lib/redis.js";
import { db } from "../db/client.js";
import { tenants, tenantUsers } from "../db/schema/public.js";
import { provisionTenantSchema } from "../db/provision-tenant.js";

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

        case "tenant.created": {
          const tenantName =
            typeof payload.data["name"] === "string"
              ? payload.data["name"]
              : "Unnamed";
          const plan =
            typeof payload.data["plan"] === "string"
              ? payload.data["plan"]
              : "starter";
          const enabledModules = Array.isArray(payload.data["modules"])
            ? (payload.data["modules"] as string[])
            : [];
          const ownerUserId =
            typeof payload.data["ownerUserId"] === "string"
              ? payload.data["ownerUserId"]
              : null;
          const ownerEmail =
            typeof payload.data["ownerEmail"] === "string"
              ? payload.data["ownerEmail"]
              : null;
          const ownerName =
            typeof payload.data["ownerName"] === "string"
              ? payload.data["ownerName"]
              : null;

          // Create local tenant record
          const tenantId = crypto.randomUUID();
          const schemaName = `tenant_${tenantId}`;

          await db.insert(tenants).values({
            id: tenantId,
            opshieldTenantId: payload.tenantId,
            name: tenantName,
            schemaName,
            status: "active",
            plan,
            enabledModules,
          });

          // Provision the tenant schema (creates tables)
          await provisionTenantSchema(schemaName);

          // Create owner user mapping if provided
          if (ownerUserId) {
            await db.insert(tenantUsers).values({
              userId: ownerUserId,
              tenantId,
              role: "owner",
              isOwner: true,
              displayName: ownerName,
              email: ownerEmail,
            });
          }

          request.log.info(
            { tenantId, opshieldTenantId: payload.tenantId, schemaName },
            "Tenant created and schema provisioned",
          );
          break;
        }

        case "tenant.user_added": {
          const userId =
            typeof payload.data["userId"] === "string"
              ? payload.data["userId"]
              : null;
          const userEmail =
            typeof payload.data["email"] === "string"
              ? payload.data["email"]
              : null;
          const userName =
            typeof payload.data["name"] === "string"
              ? payload.data["name"]
              : null;
          const userRole =
            typeof payload.data["role"] === "string"
              ? payload.data["role"]
              : "read_only";

          if (!userId) {
            request.log.warn(
              { tenantId: payload.tenantId },
              "tenant.user_added missing userId",
            );
            break;
          }

          const localTenant = await findTenantByOpshieldId(payload.tenantId);
          if (!localTenant) {
            request.log.warn(
              { opshieldTenantId: payload.tenantId },
              "tenant.user_added for unknown tenant",
            );
            break;
          }

          await db.insert(tenantUsers).values({
            userId,
            tenantId: localTenant.id,
            role: userRole,
            isOwner: false,
            displayName: userName,
            email: userEmail,
          });

          request.log.info(
            { userId, tenantId: localTenant.id },
            "User added to tenant",
          );
          break;
        }

        case "tenant.user_removed": {
          const removedUserId =
            typeof payload.data["userId"] === "string"
              ? payload.data["userId"]
              : null;

          if (!removedUserId) {
            request.log.warn(
              { tenantId: payload.tenantId },
              "tenant.user_removed missing userId",
            );
            break;
          }

          const removeTenant = await findTenantByOpshieldId(payload.tenantId);
          if (!removeTenant) {
            request.log.warn(
              { opshieldTenantId: payload.tenantId },
              "tenant.user_removed for unknown tenant",
            );
            break;
          }

          await db
            .delete(tenantUsers)
            .where(eq(tenantUsers.userId, removedUserId));

          // Also revoke their session
          await redis.set(
            sessionRevokedKey(removedUserId),
            "1",
            "EX",
            86400,
          );

          request.log.info(
            { userId: removedUserId, tenantId: removeTenant.id },
            "User removed from tenant",
          );
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
