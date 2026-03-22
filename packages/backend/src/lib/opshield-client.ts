import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

/**
 * JWT claims issued by OpShield.
 * See /home/redbay/OpShield/docs/07-AUTH-ARCHITECTURE.md for the token structure.
 */
export interface OpShieldTokenPayload extends JWTPayload {
  sub: string;
  email: string;
  name: string;
  tenant_memberships: TenantMembership[];
  aud: string;
  iss: string;
}

export interface TenantMembership {
  tenant_id: string;
  role: string;
  products: string[];
}

/**
 * Cached JWKS — jose handles key rotation and refetch automatically
 * when it encounters an unknown `kid`.
 */
const JWKS = createRemoteJWKSet(new URL(config.opshield.jwksUrl));

/**
 * Validate an OpShield JWT and return its payload.
 * Checks issuer ("opshield") and audience ("nexum").
 *
 * Always validates against OpShield's JWKS — no bypass tokens.
 * OpShield must be running for Nexum to authenticate users.
 */
export async function validateToken(
  token: string,
): Promise<OpShieldTokenPayload> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: "opshield",
    audience: config.opshield.productAudience,
  });

  return payload as OpShieldTokenPayload;
}

/**
 * Extract the bearer token from an Authorization header value.
 */
export function extractBearerToken(
  authHeader: string | undefined,
): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;
  return parts[1] ?? null;
}

/**
 * Verify an OpShield webhook signature (HMAC-SHA256).
 * See /home/redbay/OpShield/docs/03-INTEGRATION-ARCHITECTURE.md for webhook security.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
): boolean {
  // Replay protection: reject if timestamp is older than 5 minutes
  const eventTime = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - eventTime) > 300) {
    return false;
  }

  // OpShield sends signature as "t=<timestamp>,v1=<hmac>"
  // where HMAC-SHA256 is over "<timestamp>.<body>"
  const v1Match = signature.match(/v1=([a-f0-9]+)/);
  const receivedHmac = v1Match?.[1];
  if (!receivedHmac) return false;

  const signedContent = `${timestamp}.${rawBody}`;
  const computed = createHmac("sha256", config.opshield.webhookSecret)
    .update(signedContent)
    .digest("hex");

  // Constant-time comparison
  try {
    return timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(receivedHmac),
    );
  } catch {
    return false;
  }
}
