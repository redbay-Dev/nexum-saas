import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
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
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
): Promise<boolean> {
  // Replay protection: reject if timestamp is older than 5 minutes
  const eventTime = Number(timestamp);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - eventTime) > 300) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(config.opshield.webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const computed = `sha256=${Buffer.from(sig).toString("hex")}`;

  // Constant-time comparison
  if (computed.length !== signature.length) return false;
  const a = encoder.encode(computed);
  const b = encoder.encode(signature);
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return result === 0;
}
