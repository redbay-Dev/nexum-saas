/**
 * Integration test helpers.
 *
 * Provides `injectAs()` for sending authenticated requests and
 * `cleanupJobs()` for resetting mutable data between test groups.
 */

import type { FastifyInstance } from "fastify";
import type { UserRole } from "@nexum/shared";
import type { OpShieldSession } from "../middleware/auth.js";
import type { getTenantDb } from "../db/client.js";
import { sql } from "drizzle-orm";
import { TEST_IDS } from "./seed.js";

export { TEST_IDS } from "./seed.js";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface InjectResult {
  statusCode: number;
  json: () => Record<string, unknown>;
  body: string;
}

const ROLE_SESSIONS: Record<string, OpShieldSession> = {
  owner: {
    userId: TEST_IDS.users.owner,
    email: "owner@test.com.au",
    name: "Test Owner",
    tenantMemberships: [{
      tenantId: TEST_IDS.tenant,
      role: "owner",
      products: ["nexum"],
    }],
  },
  admin: {
    userId: TEST_IDS.users.owner,
    email: "admin@test.com.au",
    name: "Test Admin",
    tenantMemberships: [{
      tenantId: TEST_IDS.tenant,
      role: "admin",
      products: ["nexum"],
    }],
  },
  dispatcher: {
    userId: TEST_IDS.users.dispatcher,
    email: "dispatcher@test.com.au",
    name: "Test Dispatcher",
    tenantMemberships: [{
      tenantId: TEST_IDS.tenant,
      role: "dispatcher",
      products: ["nexum"],
    }],
  },
  finance: {
    userId: TEST_IDS.users.finance,
    email: "finance@test.com.au",
    name: "Test Finance",
    tenantMemberships: [{
      tenantId: TEST_IDS.tenant,
      role: "finance",
      products: ["nexum"],
    }],
  },
  compliance: {
    userId: TEST_IDS.users.readOnly,
    email: "compliance@test.com.au",
    name: "Test Compliance",
    tenantMemberships: [{
      tenantId: TEST_IDS.tenant,
      role: "compliance",
      products: ["nexum"],
    }],
  },
  read_only: {
    userId: TEST_IDS.users.readOnly,
    email: "readonly@test.com.au",
    name: "Test ReadOnly",
    tenantMemberships: [{
      tenantId: TEST_IDS.tenant,
      role: "read_only",
      products: ["nexum"],
    }],
  },
};

/**
 * Send an authenticated request as a specific role.
 * Uses the X-Test-Auth header which is processed by the real auth middleware
 * when NODE_ENV=test. All downstream processing (tenant DB lookup, permission
 * checks, audit logging) is real.
 */
export async function injectAs(
  app: FastifyInstance,
  role: UserRole,
  method: HttpMethod,
  url: string,
  payload?: unknown,
): Promise<InjectResult> {
  const session = ROLE_SESSIONS[role];
  if (!session) throw new Error(`No test session configured for role: ${role}`);

  const headers: Record<string, string> = {
    "x-test-auth": JSON.stringify(session),
  };

  if (payload !== undefined) {
    headers["content-type"] = "application/json";
  }

  const response = await app.inject({
    method,
    url,
    headers,
    ...(payload !== undefined ? { payload: JSON.stringify(payload) } : {}),
  });

  return {
    statusCode: response.statusCode,
    json: () => JSON.parse(response.body) as Record<string, unknown>,
    body: response.body,
  };
}

/**
 * Truncate job-related tables in the test tenant schema.
 * Preserves seed data (companies, employees, assets, job types).
 * Call between test groups that create jobs.
 */
export async function cleanupJobs(
  tenantDb: ReturnType<typeof getTenantDb>,
): Promise<void> {
  await tenantDb.execute(sql.raw(`
    TRUNCATE TABLE
      job_assignments,
      job_status_history,
      job_pricing_lines,
      job_asset_requirements,
      job_materials,
      job_locations,
      jobs
    CASCADE
  `));
  await tenantDb.execute(sql.raw(`TRUNCATE TABLE audit_log`));
}
