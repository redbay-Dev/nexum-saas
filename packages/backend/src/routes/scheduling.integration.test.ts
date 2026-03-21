import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../app.js";
import { getTenantDb } from "../db/client.js";
import { injectAs, cleanupJobs, TEST_IDS } from "../test-utils/helpers.js";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

const TENANT_SCHEMA = TEST_IDS.schemaName;

let app: FastifyInstance;
let tenantDb: ReturnType<typeof getTenantDb>;

beforeAll(async () => {
  app = buildApp();
  await app.ready();
  tenantDb = getTenantDb(TENANT_SCHEMA);
});

afterAll(async () => {
  await app.close();
});

/** Helper: create a job and transition to confirmed status */
async function createConfirmedJob(): Promise<string> {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const createRes = await injectAs(app, "dispatcher", "POST", "/api/v1/jobs", {
    name: "Scheduling Test Job",
    jobTypeId: TEST_IDS.jobType.cartage,
    customerId: TEST_IDS.company.customerA,
    scheduledStart: tomorrow.toISOString(),
    scheduledEnd: new Date(tomorrow.getTime() + 8 * 3600000).toISOString(),
  });
  const jobId = (createRes.json().data as Record<string, unknown>).id as string;

  // draft → confirmed
  await injectAs(app, "dispatcher", "POST", `/api/v1/jobs/${jobId}/status`, {
    status: "confirmed",
  });

  return jobId;
}

// ── Job Status Auto-Transition on Allocation ──

describe("job status auto-transition", () => {
  beforeEach(async () => {
    await cleanupJobs(tenantDb);
  });

  it("should transition confirmed → scheduled on first allocation", async () => {
    const jobId = await createConfirmedJob();

    // Allocate an asset
    const res = await injectAs(app, "dispatcher", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "asset",
      assetId: TEST_IDS.asset.truckAvailable,
    });
    expect(res.statusCode).toBe(201);

    // Verify job status changed
    const jobRes = await injectAs(app, "dispatcher", "GET", `/api/v1/jobs/${jobId}`);
    const jobData = (jobRes.json().data as Record<string, unknown>);
    expect(jobData.status).toBe("scheduled");
  });

  it("should record status transition in history", async () => {
    const jobId = await createConfirmedJob();

    await injectAs(app, "dispatcher", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "asset",
      assetId: TEST_IDS.asset.truckAvailable,
    });

    // Check status history
    const history = await tenantDb.execute(
      sql`SELECT * FROM job_status_history WHERE job_id = ${jobId}::uuid ORDER BY created_at DESC`,
    ) as unknown as Array<Record<string, unknown>>;
    const autoTransition = history.find(
      (h) => h.from_status === "confirmed" && h.to_status === "scheduled",
    );
    expect(autoTransition).toBeDefined();
  });
});

// ── Deallocation ──

describe("deallocation", () => {
  beforeEach(async () => {
    await cleanupJobs(tenantDb);
  });

  it("should deallocate an assignment with reason", async () => {
    const jobId = await createConfirmedJob();

    // Create assignment
    const assignRes = await injectAs(app, "dispatcher", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "asset",
      assetId: TEST_IDS.asset.truckAvailable,
    });
    const assignmentId = (assignRes.json().data as Record<string, unknown>).id as string;

    // Deallocate
    const res = await injectAs(app, "dispatcher", "PUT", `/api/v1/scheduling/deallocate/${assignmentId}`, {
      reason: "breakdown",
      notes: "Engine overheating",
      completedLoads: 3,
    });
    expect(res.statusCode).toBe(200);

    const data = (res.json().data as Record<string, unknown>);
    expect(data.status).toBe("cancelled");
    expect(data.deallocationReason).toBe("breakdown");
    expect(data.completedLoads).toBe(3);
  });

  it("should reject deallocation without reason", async () => {
    const jobId = await createConfirmedJob();

    const assignRes = await injectAs(app, "dispatcher", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "driver",
      employeeId: TEST_IDS.employee.driverActive,
    });
    const assignmentId = (assignRes.json().data as Record<string, unknown>).id as string;

    const res = await injectAs(app, "dispatcher", "PUT", `/api/v1/scheduling/deallocate/${assignmentId}`, {});
    expect(res.statusCode).toBe(400);
  });

  it("should reject deallocation of already cancelled assignment", async () => {
    const jobId = await createConfirmedJob();

    const assignRes = await injectAs(app, "dispatcher", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "asset",
      assetId: TEST_IDS.asset.truckAvailable,
    });
    const assignmentId = (assignRes.json().data as Record<string, unknown>).id as string;

    // First deallocation
    await injectAs(app, "dispatcher", "PUT", `/api/v1/scheduling/deallocate/${assignmentId}`, {
      reason: "reassignment",
    });

    // Second deallocation should fail
    const res = await injectAs(app, "dispatcher", "PUT", `/api/v1/scheduling/deallocate/${assignmentId}`, {
      reason: "other",
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as Record<string, unknown>).code).toBe("ALREADY_CANCELLED");
  });
});

// ── Bulk Allocation ──

describe("bulk allocation", () => {
  beforeEach(async () => {
    await cleanupJobs(tenantDb);
  });

  it("should create multiple assignments in one request", async () => {
    const jobId = await createConfirmedJob();

    const res = await injectAs(app, "dispatcher", "POST", "/api/v1/scheduling/bulk-allocate", {
      jobId,
      allocations: [
        { assignmentType: "asset", assetId: TEST_IDS.asset.truckAvailable },
        { assignmentType: "driver", employeeId: TEST_IDS.employee.driverActive },
      ],
    });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    const data = body.data as Record<string, unknown>;
    const summary = data.summary as Record<string, number>;
    expect(summary.succeeded).toBe(2);
    expect(summary.failed).toBe(0);
  });

  it("should handle partial failures gracefully", async () => {
    const jobId = await createConfirmedJob();

    const res = await injectAs(app, "dispatcher", "POST", "/api/v1/scheduling/bulk-allocate", {
      jobId,
      allocations: [
        { assignmentType: "asset", assetId: TEST_IDS.asset.truckAvailable },
        { assignmentType: "asset", assetId: TEST_IDS.asset.truckMaintenance }, // Should fail - maintenance
      ],
    });
    expect(res.statusCode).toBe(201); // Partial success

    const data = res.json().data as Record<string, unknown>;
    const summary = data.summary as Record<string, number>;
    expect(summary.succeeded).toBe(1);
    expect(summary.failed).toBe(1);
  });

  it("should auto-transition job status on bulk allocation", async () => {
    const jobId = await createConfirmedJob();

    await injectAs(app, "dispatcher", "POST", "/api/v1/scheduling/bulk-allocate", {
      jobId,
      allocations: [
        { assignmentType: "asset", assetId: TEST_IDS.asset.truckAvailable },
        { assignmentType: "asset", assetId: TEST_IDS.asset.truckInUse },
      ],
    });

    const jobRes = await injectAs(app, "dispatcher", "GET", `/api/v1/jobs/${jobId}`);
    const jobData = jobRes.json().data as Record<string, unknown>;
    expect(jobData.status).toBe("scheduled");
  });

  it("should reject bulk allocation on cancelled job", async () => {
    const jobId = await createConfirmedJob();

    // Cancel the job
    await injectAs(app, "dispatcher", "POST", `/api/v1/jobs/${jobId}/status`, {
      status: "cancelled",
      reason: "Test cancellation",
    });

    const res = await injectAs(app, "dispatcher", "POST", "/api/v1/scheduling/bulk-allocate", {
      jobId,
      allocations: [
        { assignmentType: "asset", assetId: TEST_IDS.asset.truckAvailable },
      ],
    });
    expect(res.statusCode).toBe(400);
  });

  it("should reject from finance role (no manage:scheduling)", async () => {
    const jobId = await createConfirmedJob();

    const res = await injectAs(app, "finance", "POST", "/api/v1/scheduling/bulk-allocate", {
      jobId,
      allocations: [
        { assignmentType: "asset", assetId: TEST_IDS.asset.truckAvailable },
      ],
    });
    expect(res.statusCode).toBe(403);
  });
});
