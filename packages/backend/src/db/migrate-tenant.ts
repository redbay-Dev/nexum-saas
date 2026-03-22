#!/usr/bin/env tsx
/**
 * Migrate a SINGLE tenant schema by name.
 * Usage: pnpm db:migrate:tenant -- tenant_abc123
 */
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: resolve(import.meta.dirname, "../../../..", ".env.development") });

import { migrateTenantSchema } from "./provision-tenant.js";

const schemaNameArg = process.argv[2];

if (!schemaNameArg) {
  console.error("Usage: pnpm db:migrate:tenant -- <schema_name>");
  console.error("Example: pnpm db:migrate:tenant -- tenant_abc123def456");
  process.exit(1);
}

const schemaName: string = schemaNameArg;

async function run(): Promise<void> {
  console.log(`Migrating tenant schema: ${schemaName}\n`);

  try {
    await migrateTenantSchema(schemaName);
    console.log("Migration complete — schema is up to date.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

void run();
