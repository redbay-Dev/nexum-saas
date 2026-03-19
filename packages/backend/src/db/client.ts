import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config.js";
import * as publicSchema from "./schema/public.js";
import * as authSchema from "./schema/auth.js";
import * as tenantSchema from "./schema/tenant.js";

/**
 * Shared Postgres connection for the public schema.
 * Used for tenant registry lookups, billing, auth, and system-level queries.
 */
const pgClient = postgres(config.database.url, { max: 10 });

export const db = drizzle(pgClient, {
  schema: { ...publicSchema, ...authSchema },
});

/**
 * Cache of tenant DB connections keyed by schema name.
 * Prevents creating a new connection pool per request.
 */
const tenantDbCache = new Map<
  string,
  ReturnType<typeof createTenantDrizzle>
>();

function createTenantDrizzle(schemaName: string): ReturnType<typeof drizzle> {
  const tenantClient = postgres(config.database.url, {
    max: 5,
    connection: {
      search_path: schemaName,
    },
  });

  return drizzle(tenantClient, { schema: tenantSchema });
}

/**
 * Create or retrieve a cached Drizzle client scoped to a specific tenant schema.
 * Sets the PostgreSQL search_path so all queries run against that tenant's tables.
 */
export function getTenantDb(
  schemaName: string,
): ReturnType<typeof drizzle> {
  const cached = tenantDbCache.get(schemaName);
  if (cached) return cached;

  const tenantDb = createTenantDrizzle(schemaName);
  tenantDbCache.set(schemaName, tenantDb);
  return tenantDb;
}

/**
 * Close all database connections (for graceful shutdown).
 */
export async function closeAllConnections(): Promise<void> {
  await pgClient.end();
  tenantDbCache.clear();
}
