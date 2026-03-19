import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { resolve } from "node:path";

loadEnv({ path: resolve(process.cwd(), "../..", ".env.development") });

/**
 * Tenant schema config — generates migration SQL for tenant tables.
 * These migrations target the `public` schema in the generated SQL
 * (since tenant.ts uses pgTable, not pgSchema). At provisioning time,
 * the SQL is replayed inside each tenant_{uuid} schema by setting
 * search_path before execution.
 */
export default defineConfig({
  schema: "./src/db/schema/tenant.ts",
  out: "./src/db/migrations/tenant",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ["public"],
});
