import type { FastifyRequest } from "fastify";
import {
  validateToken,
  extractBearerToken,
  type OpShieldTokenPayload,
} from "../lib/opshield-client.js";
import { redis } from "../lib/redis.js";

/**
 * Session info extracted from an OpShield JWT.
 * Contains the user identity and their tenant memberships.
 */
export interface OpShieldSession {
  userId: string;
  email: string;
  name: string;
  tenantMemberships: Array<{
    tenantId: string;
    role: string;
  }>;
}

/**
 * Extract and validate the OpShield session from a Fastify request.
 *
 * Checks for a Bearer token in the Authorization header, or falls back
 * to an `opshield_token` cookie. Validates the JWT against OpShield's
 * JWKS endpoint (cached, stateless).
 *
 * Returns the session if valid, null otherwise.
 */
export async function getSession(
  request: FastifyRequest,
): Promise<OpShieldSession | null> {
  // Test auth: when NODE_ENV=test, allow X-Test-Auth header to provide
  // session data directly. Bypasses JWT validation only — all downstream
  // processing (tenant DB lookup, permission checks, audit logging) is real.
  if (process.env.NODE_ENV === "test") {
    const testAuth = request.headers["x-test-auth"];
    if (typeof testAuth === "string") {
      return JSON.parse(testAuth) as OpShieldSession;
    }
  }

  // Try Authorization header first, then cookie
  const token =
    extractBearerToken(request.headers.authorization) ??
    extractTokenFromCookie(request.headers.cookie);

  if (!token) return null;

  try {
    const payload: OpShieldTokenPayload = await validateToken(token);

    // Check if this user's sessions have been revoked via OpShield webhook
    const revoked = await redis.get(`session:revoked:${payload.sub}`);
    if (revoked) return null;

    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      tenantMemberships: payload.tenant_memberships.map((m) => ({
        tenantId: m.tenantId,
        role: m.role,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Extract the opshield_token from a cookie header string.
 */
function extractTokenFromCookie(
  cookieHeader: string | undefined,
): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    const [name, ...rest] = cookie.split("=");
    if (name === "opshield_token") {
      return rest.join("=") || null;
    }
  }
  return null;
}
