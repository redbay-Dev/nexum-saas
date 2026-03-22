#!/usr/bin/env tsx
/**
 * Migrate all active tenant schemas to the latest version.
 * Does NOT touch the public schema.
 * Usage: pnpm db:migrate:tenants
 */
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(import.meta.dirname, "../../../..", ".env.development") });

import { migrateAllTenants } from "./provision-tenant.js";
import { reportMigrationState } from "./migration-reporter.js";

async function run(): Promise<void> {
  console.log("=== Nexum Tenant Migration ===\n");
  console.log("Applying pending migrations to all active tenants...\n");

  const result = await migrateAllTenants();

  console.log(`Results:`);
  console.log(`  Migrated:   ${result.migrated}`);
  console.log(`  Up-to-date: ${result.skipped}`);
  console.log(`  Failed:     ${result.failed}`);

  if (result.errors.length > 0) {
    console.warn("\nFailures:");
    for (const err of result.errors) {
      console.warn(`  ${err.schemaName}: ${err.error}`);
    }
  }

  // Report to OpShield
  try {
    await reportMigrationState();
    console.log("\nMigration state reported to OpShield.");
  } catch {
    console.warn("\nCould not report to OpShield (non-fatal).");
  }

  console.log("\n=== Done ===");

  if (result.failed > 0) {
    process.exit(1);
  }
}

void run();
