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

// ── Job CRUD ──

describe("job CRUD", () => {
  beforeEach(async () => {
    await cleanupJobs(tenantDb);
  });

  it("should create a job as dispatcher", async () => {
    const res = await injectAs(app, "dispatcher", "POST", "/api/v1/jobs", {
      name: "Deliver sand to Toowoomba",
      jobTypeId: TEST_IDS.jobType.cartage,
      customerId: TEST_IDS.company.customerA,
      priority: "high",
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);

    const data = body.data as Record<string, unknown>;
    expect(data.name).toBe("Deliver sand to Toowoomba");
    expect(data.status).toBe("draft");
    expect(data.priority).toBe("high");
    expect(data.jobNumber).toMatch(/^\d{4}-\d{4}$/);
  });

  it("should reject job with invalid job type", async () => {
    const res = await injectAs(app, "dispatcher", "POST", "/api/v1/jobs", {
      name: "Bad job",
      jobTypeId: "00000000-0000-0000-0000-000000000000",
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("INVALID_REFERENCE");
  });

  it("should reject job with non-customer company", async () => {
    const res = await injectAs(app, "dispatcher", "POST", "/api/v1/jobs", {
      name: "Bad customer",
      jobTypeId: TEST_IDS.jobType.cartage,
      customerId: TEST_IDS.company.contractorA, // contractor, not customer
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INVALID_REFERENCE");
  });

  it("should get job detail with sub-resources", async () => {
    const createRes = await injectAs(app, "dispatcher", "POST", "/api/v1/jobs", {
      name: "Detail test",
      jobTypeId: TEST_IDS.jobType.cartage,
    });
    const jobId = (createRes.json().data as Record<string, unknown>).id;

    const res = await injectAs(app, "dispatcher", "GET", `/api/v1/jobs/${jobId}`);

    expect(res.statusCode).toBe(200);
    const data = res.json().data as Record<string, unknown>;
    expect(data.id).toBe(jobId);
    expect(Array.isArray(data.locations)).toBe(true);
    expect(Array.isArray(data.materials)).toBe(true);
    expect(Array.isArray(data.assetRequirements)).toBe(true);
    expect(Array.isArray(data.pricingLines)).toBe(true);
    expect(Array.isArray(data.assignments)).toBe(true);
    expect(Array.isArray(data.statusHistory)).toBe(true);
  });

  it("should update a job", async () => {
    const createRes = await injectAs(app, "owner", "POST", "/api/v1/jobs", {
      name: "Original name",
      jobTypeId: TEST_IDS.jobType.cartage,
    });
    const jobId = (createRes.json().data as Record<string, unknown>).id;

    const res = await injectAs(app, "owner", "PUT", `/api/v1/jobs/${jobId}`, {
      name: "Updated name",
      priority: "low",
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data as Record<string, unknown>;
    expect(data.name).toBe("Updated name");
    expect(data.priority).toBe("low");
  });

  it("should soft delete a job", async () => {
    const createRes = await injectAs(app, "owner", "POST", "/api/v1/jobs", {
      name: "To be deleted",
      jobTypeId: TEST_IDS.jobType.cartage,
    });
    const jobId = (createRes.json().data as Record<string, unknown>).id;

    const deleteRes = await injectAs(app, "owner", "DELETE", `/api/v1/jobs/${jobId as string}`);
    expect(deleteRes.statusCode).toBe(200);

    // GET should return 404
    const getRes = await injectAs(app, "owner", "GET", `/api/v1/jobs/${jobId}`);
    expect(getRes.statusCode).toBe(404);

    // But the row still exists in DB with deleted_at set
    const rows = await tenantDb.execute(
      sql`SELECT id, deleted_at FROM jobs WHERE id = ${jobId as string}`,
    );
    const row = (rows as unknown as Array<Record<string, unknown>>)[0];
    expect(row).toBeDefined();
    expect(row?.deleted_at).not.toBeNull();
  });

  it("should list jobs with filtering", async () => {
    await injectAs(app, "dispatcher", "POST", "/api/v1/jobs", {
      name: "Job A",
      jobTypeId: TEST_IDS.jobType.cartage,
      priority: "high",
    });
    await injectAs(app, "dispatcher", "POST", "/api/v1/jobs", {
      name: "Job B",
      jobTypeId: TEST_IDS.jobType.hire,
      priority: "low",
    });

    const allRes = await injectAs(app, "dispatcher", "GET", "/api/v1/jobs");
    expect(allRes.statusCode).toBe(200);
    const allBody = allRes.json().data as Record<string, unknown>;
    const allData = allBody.data as unknown[];
    expect(allData.length).toBe(2);

    const filteredRes = await injectAs(
      app,
      "dispatcher",
      "GET",
      `/api/v1/jobs?jobTypeId=${TEST_IDS.jobType.cartage}`,
    );
    expect(filteredRes.statusCode).toBe(200);
    const filteredBody = filteredRes.json().data as Record<string, unknown>;
    const filteredData = filteredBody.data as unknown[];
    expect(filteredData.length).toBe(1);
  });
});

// ── Status Lifecycle ──

describe("job status lifecycle", () => {
  let jobId: string;

  beforeEach(async () => {
    await cleanupJobs(tenantDb);
    const res = await injectAs(app, "owner", "POST", "/api/v1/jobs", {
      name: "Lifecycle test job",
      jobTypeId: TEST_IDS.jobType.cartage,
      customerId: TEST_IDS.company.customerA,
    });
    jobId = (res.json().data as Record<string, unknown>).id as string;
  });

  it("should transition draft → scheduled", async () => {
    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, {
      status: "scheduled",
    });
    expect(res.statusCode).toBe(200);
    expect((res.json().data as Record<string, unknown>).status).toBe("scheduled");
  });

  it("should transition draft → confirmed → in_progress with auto-timestamp", async () => {
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, {
      status: "confirmed",
    });

    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, {
      status: "in_progress",
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data as Record<string, unknown>;
    expect(data.status).toBe("in_progress");
    expect(data.actualStart).not.toBeNull();
  });

  it("should auto-set actualEnd on completion", async () => {
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "confirmed" });
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "in_progress" });

    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, {
      status: "completed",
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data as Record<string, unknown>;
    expect(data.status).toBe("completed");
    expect(data.actualEnd).not.toBeNull();
  });

  it("should reject invalid transition: draft → completed", async () => {
    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, {
      status: "completed",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INVALID_TRANSITION");
  });

  it("should reject any transition from invoiced (terminal state)", async () => {
    // Walk to invoiced
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "confirmed" });
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "in_progress" });
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "completed" });
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "invoiced" });

    for (const status of ["draft", "scheduled", "confirmed", "in_progress", "completed", "cancelled"]) {
      const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status });
      expect(res.statusCode).toBe(400);
      expect(res.json().code).toBe("INVALID_TRANSITION");
    }
  });

  it("should reject self-transition", async () => {
    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, {
      status: "draft",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INVALID_TRANSITION");
  });

  it("should allow rework: completed → in_progress with reason", async () => {
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "confirmed" });
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "in_progress" });
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "completed" });

    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, {
      status: "in_progress",
      reason: "Customer reported issue, reopening",
    });
    expect(res.statusCode).toBe(200);
    expect((res.json().data as Record<string, unknown>).status).toBe("in_progress");
  });

  it("should allow recovery: cancelled → draft with reason", async () => {
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "cancelled" });

    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, {
      status: "draft",
      reason: "Customer changed their mind",
    });
    expect(res.statusCode).toBe(200);
    expect((res.json().data as Record<string, unknown>).status).toBe("draft");
  });
});

// ── Reason Requirements ──

describe("reason-required transitions", () => {
  let jobId: string;

  beforeEach(async () => {
    await cleanupJobs(tenantDb);
    const res = await injectAs(app, "owner", "POST", "/api/v1/jobs", {
      name: "Reason test",
      jobTypeId: TEST_IDS.jobType.cartage,
    });
    jobId = (res.json().data as Record<string, unknown>).id as string;
  });

  it("should reject confirmed → cancelled without reason", async () => {
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "confirmed" });

    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, {
      status: "cancelled",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("REASON_REQUIRED");
  });

  it("should accept confirmed → cancelled with reason", async () => {
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "confirmed" });

    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, {
      status: "cancelled",
      reason: "Weather delay",
    });
    expect(res.statusCode).toBe(200);
    expect((res.json().data as Record<string, unknown>).cancellationReason).toBe("Weather delay");
  });

  it("should reject rework (completed → in_progress) without reason", async () => {
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "confirmed" });
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "in_progress" });
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "completed" });

    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, {
      status: "in_progress",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("REASON_REQUIRED");
  });
});

// ── Cancellation Cascades ──

describe("cancellation cascades", () => {
  beforeEach(async () => {
    await cleanupJobs(tenantDb);
  });

  it("should auto-cancel all active assignments when job is cancelled", async () => {
    // Create job
    const jobRes = await injectAs(app, "owner", "POST", "/api/v1/jobs", {
      name: "Cancel cascade test",
      jobTypeId: TEST_IDS.jobType.cartage,
    });
    const jobId = (jobRes.json().data as Record<string, unknown>).id as string;

    // Confirm the job so it can have assignments and be cancelled with reason
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "confirmed" });

    // Add assignments
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "asset",
      assetId: TEST_IDS.asset.truckAvailable,
      plannedStart: "2026-03-25T06:00:00Z",
    });
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "driver",
      employeeId: TEST_IDS.employee.driverActive,
      plannedStart: "2026-03-25T06:00:00Z",
    });

    // Verify assignments are "assigned"
    const beforeRes = await injectAs(app, "owner", "GET", `/api/v1/jobs/${jobId}`);
    const beforeAssignments = (beforeRes.json().data as Record<string, unknown>).assignments as Array<Record<string, unknown>>;
    expect(beforeAssignments).toHaveLength(2);
    expect(beforeAssignments.every((a) => a.status === "assigned")).toBe(true);

    // Cancel the job
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, {
      status: "cancelled",
      reason: "Project postponed",
    });

    // Verify all assignments are now cancelled
    const allAssignments = await tenantDb.execute(
      sql`SELECT status FROM job_assignments WHERE job_id = ${jobId}`,
    ) as unknown as Array<Record<string, unknown>>;
    expect(allAssignments.length).toBe(2);
    for (const row of allAssignments) {
      expect(row.status).toBe("cancelled");
    }
  });
});

// ── Invoice Lock ──

describe("invoice locking", () => {
  let jobId: string;

  beforeEach(async () => {
    await cleanupJobs(tenantDb);

    // Create a job and walk it to invoiced
    const jobRes = await injectAs(app, "owner", "POST", "/api/v1/jobs", {
      name: "Invoice lock test",
      jobTypeId: TEST_IDS.jobType.cartage,
    });
    jobId = (jobRes.json().data as Record<string, unknown>).id as string;

    // Add a pricing line
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/pricing-lines`, {
      lineType: "revenue",
      category: "cartage",
      rateType: "per_hour",
      quantity: 8,
      unitRate: 150,
      total: 1200,
    });

    // Walk to invoiced
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "confirmed" });
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "in_progress" });
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "completed" });
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "invoiced" });
  });

  it("should lock pricing lines when job is invoiced", async () => {
    const rows = await tenantDb.execute(
      sql`SELECT is_locked FROM job_pricing_lines WHERE job_id = ${jobId}`,
    ) as unknown as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.is_locked).toBe(true);
    }
  });

  it("should reject editing an invoiced job", async () => {
    const res = await injectAs(app, "owner", "PUT", `/api/v1/jobs/${jobId}`, {
      name: "Try to change name",
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("JOB_LOCKED");
  });

  it("should reject deleting an invoiced job", async () => {
    const res = await injectAs(app, "owner", "DELETE", `/api/v1/jobs/${jobId}`);
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("JOB_LOCKED");
  });

  it("should reject adding pricing lines to an invoiced job", async () => {
    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/pricing-lines`, {
      lineType: "revenue",
      category: "cartage",
      rateType: "flat",
      quantity: 1,
      unitRate: 500,
      total: 500,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("JOB_LOCKED");
  });
});

// ── Assignment Validation ──

describe("assignment validation", () => {
  let jobId: string;

  beforeEach(async () => {
    await cleanupJobs(tenantDb);
    const res = await injectAs(app, "owner", "POST", "/api/v1/jobs", {
      name: "Assignment validation test",
      jobTypeId: TEST_IDS.jobType.cartage,
    });
    jobId = (res.json().data as Record<string, unknown>).id as string;
  });

  it("should reject assigning an asset in maintenance", async () => {
    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "asset",
      assetId: TEST_IDS.asset.truckMaintenance,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("RESOURCE_UNAVAILABLE");
  });

  it("should accept assigning an available asset", async () => {
    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "asset",
      assetId: TEST_IDS.asset.truckAvailable,
    });
    expect(res.statusCode).toBe(201);
  });

  it("should accept assigning an in_use asset (double-booking allowed with warning)", async () => {
    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "asset",
      assetId: TEST_IDS.asset.truckInUse,
    });
    expect(res.statusCode).toBe(201);
  });

  it("should reject assigning a terminated driver", async () => {
    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "driver",
      employeeId: TEST_IDS.employee.driverTerminated,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("RESOURCE_UNAVAILABLE");
  });

  it("should reject assigning a non-driver employee", async () => {
    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "driver",
      employeeId: TEST_IDS.employee.nonDriver,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INVALID_REFERENCE");
  });

  it("should accept assigning an active driver", async () => {
    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "driver",
      employeeId: TEST_IDS.employee.driverActive,
    });
    expect(res.statusCode).toBe(201);
  });

  it("should reject assigning a non-contractor company", async () => {
    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "contractor",
      contractorCompanyId: TEST_IDS.company.customerA, // customer, not contractor
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("INVALID_REFERENCE");
  });

  it("should accept assigning a contractor company", async () => {
    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "contractor",
      contractorCompanyId: TEST_IDS.company.contractorA,
    });
    expect(res.statusCode).toBe(201);
  });

  it("should reject assignments on cancelled jobs", async () => {
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, { status: "cancelled" });

    const res = await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/assignments`, {
      assignmentType: "asset",
      assetId: TEST_IDS.asset.truckAvailable,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("JOB_LOCKED");
  });
});

// ── Permission Enforcement ──

describe("permission enforcement", () => {
  beforeEach(async () => {
    await cleanupJobs(tenantDb);
  });

  it("finance role cannot create jobs (no create:jobs permission)", async () => {
    const res = await injectAs(app, "finance", "POST", "/api/v1/jobs", {
      name: "Should fail",
      jobTypeId: TEST_IDS.jobType.cartage,
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().code).toBe("FORBIDDEN");
  });

  it("read_only role cannot create jobs", async () => {
    const res = await injectAs(app, "read_only", "POST", "/api/v1/jobs", {
      name: "Should fail",
      jobTypeId: TEST_IDS.jobType.cartage,
    });
    expect(res.statusCode).toBe(403);
  });

  it("read_only role can view jobs", async () => {
    const res = await injectAs(app, "read_only", "GET", "/api/v1/jobs");
    expect(res.statusCode).toBe(200);
  });

  it("dispatcher can create and manage jobs", async () => {
    const createRes = await injectAs(app, "dispatcher", "POST", "/api/v1/jobs", {
      name: "Dispatcher job",
      jobTypeId: TEST_IDS.jobType.cartage,
    });
    expect(createRes.statusCode).toBe(201);

    const jobId = (createRes.json().data as Record<string, unknown>).id;
    const updateRes = await injectAs(app, "dispatcher", "PUT", `/api/v1/jobs/${jobId}`, {
      name: "Dispatcher updated",
    });
    expect(updateRes.statusCode).toBe(200);
  });

  it("unauthenticated request returns 401", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/jobs",
    });
    expect(response.statusCode).toBe(401);
  });
});

// ── Audit Logging ──

describe("audit logging", () => {
  beforeEach(async () => {
    await cleanupJobs(tenantDb);
  });

  it("should create audit entries for job lifecycle operations", async () => {
    // Create
    const createRes = await injectAs(app, "owner", "POST", "/api/v1/jobs", {
      name: "Audit test",
      jobTypeId: TEST_IDS.jobType.cartage,
    });
    const jobId = (createRes.json().data as Record<string, unknown>).id as string;

    // Update
    await injectAs(app, "owner", "PUT", `/api/v1/jobs/${jobId}`, {
      name: "Audit test updated",
    });

    // Status change
    await injectAs(app, "owner", "POST", `/api/v1/jobs/${jobId}/status`, {
      status: "confirmed",
    });

    // Delete
    await injectAs(app, "owner", "DELETE", `/api/v1/jobs/${jobId}`);

    // Check audit log
    const auditRows = await tenantDb.execute(
      sql`SELECT action, entity_type, entity_id FROM audit_log
          WHERE entity_type = 'job' AND entity_id = ${jobId}::uuid
          ORDER BY created_at`,
    ) as unknown as Array<Record<string, unknown>>;

    const actions = auditRows.map((r) => r.action);
    expect(actions).toContain("CREATE");
    expect(actions).toContain("UPDATE");
    expect(actions).toContain("STATUS_CHANGE");
    expect(actions).toContain("DELETE");
  });
});

// ── Pricing Depth ──

describe("pricing line tax and variations", () => {
  beforeEach(async () => {
    await cleanupJobs(tenantDb);
  });

  it("should create pricing line with new fields", async () => {
    const jobRes = await injectAs(app, "dispatcher", "POST", "/api/v1/jobs", {
      name: "Pricing test",
      jobTypeId: TEST_IDS.jobType.cartage,
      customerId: TEST_IDS.company.customerA,
    });
    const jobId = (jobRes.json().data as Record<string, unknown>).id as string;

    const res = await injectAs(app, "finance", "POST", `/api/v1/jobs/${jobId}/pricing-lines`, {
      lineType: "revenue",
      category: "cartage",
      rateType: "per_tonne",
      quantity: 100,
      unitRate: 15,
      total: 1500,
    });

    expect(res.statusCode).toBe(201);
    const line = res.json().data as Record<string, unknown>;
    expect(line.source).toBe("manual");
    expect(line.isVariation).toBe(false);
  });

  it("should accept equipment and labour categories", async () => {
    const jobRes = await injectAs(app, "dispatcher", "POST", "/api/v1/jobs", {
      name: "Category test",
      jobTypeId: TEST_IDS.jobType.cartage,
      customerId: TEST_IDS.company.customerA,
    });
    const jobId = (jobRes.json().data as Record<string, unknown>).id as string;

    for (const cat of ["equipment", "labour"]) {
      const res = await injectAs(app, "finance", "POST", `/api/v1/jobs/${jobId}/pricing-lines`, {
        lineType: "cost",
        category: cat,
        rateType: "flat",
        total: 500,
      });
      expect(res.statusCode).toBe(201);
    }
  });

  it("should create variation line with reason", async () => {
    const jobRes = await injectAs(app, "dispatcher", "POST", "/api/v1/jobs", {
      name: "Variation test",
      jobTypeId: TEST_IDS.jobType.cartage,
      customerId: TEST_IDS.company.customerA,
    });
    const jobId = (jobRes.json().data as Record<string, unknown>).id as string;

    const res = await injectAs(app, "finance", "POST", `/api/v1/jobs/${jobId}/pricing-lines`, {
      lineType: "revenue",
      category: "cartage",
      rateType: "per_tonne",
      quantity: 20,
      unitRate: 18,
      total: 360,
      isVariation: true,
      variationReason: "Extra loads requested by customer",
    });

    expect(res.statusCode).toBe(201);
    const line = res.json().data as Record<string, unknown>;
    expect(line.isVariation).toBe(true);
    expect(line.variationReason).toBe("Extra loads requested by customer");
  });

  it("should create audit log for pricing line operations", async () => {
    const jobRes = await injectAs(app, "dispatcher", "POST", "/api/v1/jobs", {
      name: "Pricing audit test",
      jobTypeId: TEST_IDS.jobType.cartage,
      customerId: TEST_IDS.company.customerA,
    });
    const jobId = (jobRes.json().data as Record<string, unknown>).id as string;

    // Create
    const createRes = await injectAs(app, "finance", "POST", `/api/v1/jobs/${jobId}/pricing-lines`, {
      lineType: "revenue",
      category: "hire",
      rateType: "per_hour",
      quantity: 8,
      unitRate: 120,
      total: 960,
    });
    const lineId = (createRes.json().data as Record<string, unknown>).id as string;

    // Update
    await injectAs(app, "finance", "PUT", `/api/v1/jobs/${jobId}/pricing-lines/${lineId}`, {
      total: 1000,
    });

    // Delete
    await injectAs(app, "finance", "DELETE", `/api/v1/jobs/${jobId}/pricing-lines/${lineId}`);

    // Verify audit entries
    const auditRows = await tenantDb.execute(
      sql`SELECT action FROM audit_log WHERE entity_type = 'job_pricing_line' AND entity_id = ${lineId}::uuid ORDER BY created_at`,
    ) as unknown as Array<Record<string, unknown>>;
    const actions = auditRows.map((r) => r.action);
    expect(actions).toContain("CREATE");
    expect(actions).toContain("UPDATE");
    expect(actions).toContain("DELETE");
  });
});

// ── Financial Summary ──

describe("financial summary", () => {
  beforeEach(async () => {
    await cleanupJobs(tenantDb);
  });

  it("should compute revenue, cost, profit, and margin", async () => {
    const jobRes = await injectAs(app, "dispatcher", "POST", "/api/v1/jobs", {
      name: "Financial summary test",
      jobTypeId: TEST_IDS.jobType.cartage,
      customerId: TEST_IDS.company.customerA,
    });
    const jobId = (jobRes.json().data as Record<string, unknown>).id as string;

    // Add revenue line: $1000
    await injectAs(app, "finance", "POST", `/api/v1/jobs/${jobId}/pricing-lines`, {
      lineType: "revenue",
      category: "cartage",
      rateType: "per_tonne",
      quantity: 100,
      unitRate: 10,
      total: 1000,
    });

    // Add cost line: $600
    await injectAs(app, "finance", "POST", `/api/v1/jobs/${jobId}/pricing-lines`, {
      lineType: "cost",
      category: "subcontractor",
      rateType: "per_tonne",
      quantity: 100,
      unitRate: 6,
      total: 600,
    });

    const res = await injectAs(app, "finance", "GET", `/api/v1/jobs/${jobId}/financial-summary`);
    expect(res.statusCode).toBe(200);

    const data = res.json().data as Record<string, unknown>;
    expect(data.totalRevenue).toBe(1000);
    expect(data.totalCost).toBe(600);
    expect(data.grossProfit).toBe(400);
    expect(data.marginPercent).toBe(40);

    const breakdown = data.categoryBreakdown as Array<Record<string, unknown>>;
    expect(breakdown.length).toBe(2);
  });

  it("should return null margin when no revenue", async () => {
    const jobRes = await injectAs(app, "dispatcher", "POST", "/api/v1/jobs", {
      name: "No revenue test",
      jobTypeId: TEST_IDS.jobType.cartage,
      customerId: TEST_IDS.company.customerA,
    });
    const jobId = (jobRes.json().data as Record<string, unknown>).id as string;

    const res = await injectAs(app, "finance", "GET", `/api/v1/jobs/${jobId}/financial-summary`);
    expect(res.statusCode).toBe(200);

    const data = res.json().data as Record<string, unknown>;
    expect(data.totalRevenue).toBe(0);
    expect(data.marginPercent).toBeNull();
  });
});
