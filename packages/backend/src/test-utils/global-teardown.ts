import postgres from "postgres";
import { config } from "../config.js";

const TEST_DB = config.database.name;

const adminUrl = config.database.url.replace(
  `/${config.database.name}`,
  "/postgres",
);

/**
 * Vitest global teardown — runs once after ALL test files finish.
 * Drops the entire test database. Clean slate every run.
 */
export async function teardown(): Promise<void> {
  const admin = postgres(adminUrl, { max: 1 });

  try {
    await admin.unsafe(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${TEST_DB}' AND pid <> pg_backend_pid()
    `);
    await admin.unsafe(`DROP DATABASE IF EXISTS "${TEST_DB}"`);
  } finally {
    await admin.end();
  }

  console.log(`[teardown] Dropped ${TEST_DB} database`);
}
