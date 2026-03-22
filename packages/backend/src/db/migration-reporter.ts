/**
 * Reports migration state to OpShield platform after migrations run.
 * OpShield stores this for the migration dashboard visibility.
 *
 * This is fire-and-forget — failure to report does not block migrations.
 */
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";
import postgres from "postgres";
import { config } from "../config.js";

const TENANT_MIGRATIONS_DIR = resolve(
  import.meta.dirname,
  "migrations/tenant",
);

interface TenantMigrationState {
  tenantId: string;
  schemaName: string;
  currentVersion: string | null;
  appliedCount: number;
  status: "current" | "behind" | "failed";
  error?: string;
}

interface MigrationStateReport {
  app: string;
  latestVersion: string;
  totalMigrations: number;
  tenants: TenantMigrationState[];
  reportedAt: string;
}

/**
 * Gather migration state for all tenants and report to OpShield.
 */
export async function reportMigrationState(): Promise<void> {
  const opshieldUrl = config.opshield.apiUrl;
  const apiKey = config.opshield.apiKey;

  if (!opshieldUrl || opshieldUrl === "http://localhost:3000") {
    // Skip reporting in local dev if OpShield isn't running
    return;
  }

  const report = await gatherMigrationState();

  const body = JSON.stringify(report);
  const signature = createHmac("sha256", config.opshield.webhookSecret)
    .update(body)
    .digest("hex");

  const response = await fetch(`${opshieldUrl}/api/v1/migration-state`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Key": apiKey,
      "X-Migration-Signature": signature,
    },
    body,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpShield migration report failed (${response.status}): ${text}`);
  }
}

/**
 * Gather the current migration state of all tenant schemas.
 */
export async function gatherMigrationState(): Promise<MigrationStateReport> {
  const sql = postgres(config.database.url, { max: 1 });

  try {
    // Get latest available migration
    const migrationFiles = await readdir(TENANT_MIGRATIONS_DIR);
    const sqlFiles = migrationFiles.filter((f) => f.endsWith(".sql")).sort();
    const totalMigrations = sqlFiles.length;
    const latestVersion = sqlFiles[sqlFiles.length - 1] ?? "none";

    // Get all active tenants with their OpShield IDs
    const tenants = await sql.unsafe<Array<{
      id: string;
      opshield_tenant_id: string;
      schema_name: string;
    }>>(
      `SELECT id, opshield_tenant_id, schema_name FROM public.tenants WHERE status = 'active'`,
    );

    const tenantStates: TenantMigrationState[] = [];

    for (const tenant of tenants) {
      try {
        await sql.unsafe(`SET search_path TO "${tenant.schema_name}"`);

        const rows = await sql.unsafe<Array<{ migration_name: string; count: string }>>(
          `SELECT
            (SELECT migration_name FROM "_drizzle_migrations" ORDER BY id DESC LIMIT 1) as migration_name,
            (SELECT count(*) FROM "_drizzle_migrations")::text as count`,
        );

        const currentVersion = rows[0]?.migration_name ?? null;
        const appliedCount = Number(rows[0]?.count ?? 0);
        const isCurrent = appliedCount >= totalMigrations;

        tenantStates.push({
          tenantId: tenant.opshield_tenant_id ?? tenant.id,
          schemaName: tenant.schema_name,
          currentVersion,
          appliedCount,
          status: isCurrent ? "current" : "behind",
        });
      } catch (err) {
        tenantStates.push({
          tenantId: tenant.opshield_tenant_id ?? tenant.id,
          schemaName: tenant.schema_name,
          currentVersion: null,
          appliedCount: 0,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Reset search_path
    await sql.unsafe(`SET search_path TO public`);

    return {
      app: "nexum",
      latestVersion,
      totalMigrations,
      tenants: tenantStates,
      reportedAt: new Date().toISOString(),
    };
  } finally {
    await sql.end();
  }
}
