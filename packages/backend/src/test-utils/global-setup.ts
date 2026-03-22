/**
 * Vitest global setup — runs once before all test files.
 *
 * Creates the nexum_test database, runs all migrations (public + tenant),
 * and seeds test data. Uses the real provisioning system — no mocks.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";
import { TEST_IDS, getTenantSeedSQL } from "./seed.js";

import { config } from "../config.js";

const TEST_DB_NAME = config.database.name;

function connectTo(dbName: string): ReturnType<typeof postgres> {
  const testUrl = config.database.url.replace(
    `/${config.database.name}`,
    `/${dbName}`,
  );
  return postgres(testUrl, { max: 1 });
}

async function createTestDatabase(): Promise<void> {
  const sql = connectTo("postgres");
  try {
    const [row] = await sql`
      SELECT 1 FROM pg_database WHERE datname = ${TEST_DB_NAME}
    `;
    if (!row) {
      await sql.unsafe(`CREATE DATABASE "${TEST_DB_NAME}"`);
    }
  } finally {
    await sql.end();
  }
}

async function runPublicMigrations(): Promise<void> {
  const sql = connectTo(TEST_DB_NAME);
  try {
    // Check if tenants table already exists (idempotent)
    const [exists] = await sql`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tenants'
    `;

    // Always apply incremental column additions
    await sql.unsafe(`
      ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255)
    `).catch(() => {/* column may already exist */});
    await sql.unsafe(`
      ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS email VARCHAR(255)
    `).catch(() => {/* column may already exist */});
    await sql.unsafe(`
      ALTER TABLE tenant_users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'
    `).catch(() => {/* column may already exist */});

    if (exists) return;

    const migrationPath = resolve(
      import.meta.dirname,
      "../db/migrations/public/0000_mushy_onslaught.sql",
    );
    const migrationSQL = await readFile(migrationPath, "utf-8");

    const statements = migrationSQL
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await sql.unsafe(statement);
    }

    // Add columns that exist in schema but not in initial migration
    await sql.unsafe(`
      ALTER TABLE tenants ADD COLUMN IF NOT EXISTS opshield_tenant_id UUID UNIQUE
    `);
  } finally {
    await sql.end();
  }
}

async function insertTestTenantAndUsers(): Promise<void> {
  const sql = connectTo(TEST_DB_NAME);
  try {
    // Test tenant
    await sql`
      INSERT INTO tenants (id, name, schema_name, status, plan, enabled_modules)
      VALUES (
        ${TEST_IDS.tenant},
        'Test Transport Co',
        ${TEST_IDS.schemaName},
        'active',
        'professional',
        ${JSON.stringify([
          "invoicing", "rcti", "xero", "compliance", "sms",
          "docket_processing", "materials", "map_planning",
          "ai_automation", "reporting", "portal",
        ])}::jsonb
      )
      ON CONFLICT (id) DO NOTHING
    `;

    // Test users with different roles
    const users = [
      { userId: TEST_IDS.users.owner, role: "owner", isOwner: true, name: "Test Owner", email: "owner@test.com.au" },
      { userId: TEST_IDS.users.dispatcher, role: "dispatcher", isOwner: false, name: "Test Dispatcher", email: "dispatcher@test.com.au" },
      { userId: TEST_IDS.users.finance, role: "finance", isOwner: false, name: "Test Finance", email: "finance@test.com.au" },
      { userId: TEST_IDS.users.readOnly, role: "read_only", isOwner: false, name: "Test ReadOnly", email: "readonly@test.com.au" },
    ];

    for (const user of users) {
      await sql`
        INSERT INTO tenant_users (id, user_id, tenant_id, role, is_owner, display_name, email)
        VALUES (
          gen_random_uuid(),
          ${user.userId},
          ${TEST_IDS.tenant},
          ${user.role},
          ${user.isOwner},
          ${user.name},
          ${user.email}
        )
        ON CONFLICT DO NOTHING
      `;
    }
  } finally {
    await sql.end();
  }
}

async function provisionTestTenantSchema(): Promise<void> {
  const sql = connectTo(TEST_DB_NAME);
  try {
    // Check if schema already exists
    const [exists] = await sql`
      SELECT 1 FROM information_schema.schemata
      WHERE schema_name = ${TEST_IDS.schemaName}
    `;
    if (exists) {
      // Apply any new migrations not yet applied
      await sql.unsafe(`SET search_path TO "${TEST_IDS.schemaName}"`);
      const migrationsDir = resolve(import.meta.dirname, "../db/migrations/tenant");
      const { readdir } = await import("node:fs/promises");
      const files = (await readdir(migrationsDir))
        .filter((f) => f.endsWith(".sql"))
        .sort();

      for (const file of files) {
        const [alreadyApplied] = await sql`
          SELECT 1 FROM "_drizzle_migrations" WHERE migration_name = ${file}
        `;
        if (alreadyApplied) continue;

        const content = await readFile(resolve(migrationsDir, file), "utf-8");
        const statements = content
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        for (const statement of statements) {
          const fixed = statement.replace(/REFERENCES "public"\./g, "REFERENCES ");
          await sql.unsafe(fixed);
        }

        await sql`
          INSERT INTO "_drizzle_migrations" (migration_name)
          VALUES (${file})
        `;
      }

      return;
    }

    // Create schema
    await sql.unsafe(`CREATE SCHEMA "${TEST_IDS.schemaName}"`);
    await sql.unsafe(`SET search_path TO "${TEST_IDS.schemaName}"`);

    // Create migration tracking table
    await sql.unsafe(`
      CREATE TABLE "_drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Read and apply all tenant migrations
    const migrationsDir = resolve(import.meta.dirname, "../db/migrations/tenant");
    const { readdir } = await import("node:fs/promises");
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const content = await readFile(resolve(migrationsDir, file), "utf-8");
      const statements = content
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        // Fix FK references: "public"."table" → "table" (use search_path)
        const fixed = statement.replace(/REFERENCES "public"\./g, "REFERENCES ");
        await sql.unsafe(fixed);
      }

      await sql`
        INSERT INTO "_drizzle_migrations" (migration_name)
        VALUES (${file})
      `;
    }
  } finally {
    await sql.end();
  }
}

async function seedTenantData(): Promise<void> {
  const sql = connectTo(TEST_DB_NAME);
  try {
    await sql.unsafe(`SET search_path TO "${TEST_IDS.schemaName}"`);

    const seedStatements = getTenantSeedSQL();
    for (const statement of seedStatements) {
      await sql.unsafe(statement);
    }
  } finally {
    await sql.end();
  }
}

export async function setup(): Promise<void> {
  await createTestDatabase();
  await runPublicMigrations();
  await insertTestTenantAndUsers();
  await provisionTestTenantSchema();
  await seedTenantData();
}

// Teardown moved to global-teardown.ts
