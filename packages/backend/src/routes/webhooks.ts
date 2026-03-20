import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { verifyWebhookSignature } from "../lib/opshield-client.js";

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

/**
 * OpShield webhook routes.
 *
 * Handles lifecycle events for modules and tenants:
 * - module.activated / module.suspended / module.cancelled
 * - tenant.suspended / tenant.reactivated / tenant.cancelled
 * - user_count.updated
 * - session.revoked
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

      // TODO: Idempotency check — use Redis to track processed event IDs
      // const processed = await redis.get(`webhook:${payload.id}`);
      // if (processed) return reply.status(200).send({ status: "already_processed" });

      request.log.info(
        { event: payload.event, tenantId: payload.tenantId },
        "OpShield webhook received",
      );

      switch (payload.event) {
        case "module.activated":
          // TODO: Invalidate entitlements cache for this tenant
          // await redis.del(`opshield:entitlements:${payload.tenantId}`);
          break;

        case "module.suspended":
        case "module.cancelled":
          // TODO: Invalidate entitlements cache
          // await redis.del(`opshield:entitlements:${payload.tenantId}`);
          break;

        case "tenant.suspended":
          // TODO: Mark tenant as suspended in local DB, enable read-only mode
          break;

        case "tenant.reactivated":
          // TODO: Restore tenant access
          break;

        case "tenant.cancelled":
          // TODO: Begin data retention countdown
          break;

        case "session.revoked":
          // TODO: Invalidate any cached sessions for this user
          break;

        case "user_count.updated":
          // Informational — no action needed unless enforcing limits locally
          break;

        default:
          request.log.warn(
            { event: payload.event },
            "Unknown OpShield webhook event",
          );
      }

      // TODO: Mark event as processed in Redis
      // await redis.set(`webhook:${payload.id}`, "1", "EX", 86400);

      return reply.status(200).send({ status: "ok" });
    },
  );
}
