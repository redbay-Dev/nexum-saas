#!/usr/bin/env tsx
/**
 * Run ALL migrations: public schema (via drizzle-kit) + all active tenant schemas.
 * Usage: pnpm db:migrate
 *
 * After migrating, reports migration state to OpShield if configured.
 */
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(import.meta.dirname, "../../../..", ".env.development") });

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { migrateAllTenants } from "./provision-tenant.js";
import { reportMigrationState } from "./migration-reporter.js";

const DATABASE_URL = process.env["DATABASE_URL"];
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

async function run(): Promise<void> {
  console.log("=== Nexum Database Migration ===\n");

  // Step 1: Public schema migrations (via Drizzle migrator)
  console.log("1. Running public schema migrations...");
  const sql = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(sql);

  try {
    await migrate(db, {
      migrationsFolder: resolve(import.meta.dirname, "migrations/public"),
    });
    console.log("   Public schema: up to date\n");
  } catch (err) {
    console.error("   Public schema migration failed:", err);
    await sql.end();
    process.exit(1);
  }

  await sql.end();

  // Step 2: All tenant schema migrations
  console.log("2. Running tenant schema migrations...");
  try {
    const result = await migrateAllTenants();
    console.log(`   Tenant schemas: ${result.migrated} migrated, ${result.skipped} up-to-date, ${result.failed} failed\n`);

    if (result.errors.length > 0) {
      console.warn("   Failures:");
      for (const err of result.errors) {
        console.warn(`   - ${err.schemaName}: ${err.error}`);
      }
      console.warn("");
    }

    // Step 3: Report state to OpShield
    console.log("3. Reporting migration state to OpShield...");
    try {
      await reportMigrationState();
      console.log("   State reported successfully\n");
    } catch {
      console.warn("   Could not report to OpShield (non-fatal)\n");
    }

    console.log("=== Migration complete ===");

    if (result.failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("   Tenant migration failed:", err);
    process.exit(1);
  }
}

void run();
