/**
 * Better Auth schema tables.
 * These are managed by the Better Auth library and should not be modified manually.
 * The actual table creation is handled by Better Auth's migration system.
 *
 * Tables created by Better Auth in the public schema:
 * - user (id, name, email, emailVerified, image, createdAt, updatedAt)
 * - session (id, expiresAt, token, ipAddress, userAgent, userId)
 * - account (id, accountId, providerId, userId, accessToken, refreshToken, ...)
 * - verification (id, identifier, value, expiresAt, createdAt, updatedAt)
 */

// Better Auth manages its own tables. We import them via the Better Auth
// adapter at runtime. This file exists as documentation and for reference.
export {};
