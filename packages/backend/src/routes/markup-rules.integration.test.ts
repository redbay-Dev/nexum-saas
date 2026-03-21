import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../app.js";
import { getTenantDb } from "../db/client.js";
import { injectAs, TEST_IDS } from "../test-utils/helpers.js";
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

async function cleanupPricingEngine(): Promise<void> {
  await tenantDb.execute(sql.raw(`TRUNCATE TABLE markup_rules CASCADE`));
  await tenantDb.execute(sql.raw(`TRUNCATE TABLE margin_thresholds CASCADE`));
  await tenantDb.execute(sql.raw(`TRUNCATE TABLE audit_log`));
}

describe("Markup Rules CRUD", () => {
  beforeEach(async () => {
    await cleanupPricingEngine();
  });

  it("should create a percentage markup rule", async () => {
    const res = await injectAs(app, "finance", "POST", "/api/v1/markup-rules", {
      name: "Standard 20% Markup",
      type: "percentage",
      markupPercentage: 20,
      priority: 10,
    });

    expect(res.statusCode).toBe(201);
    const data = res.json().data as Record<string, unknown>;
    expect(data.name).toBe("Standard 20% Markup");
    expect(data.type).toBe("percentage");
    expect(parseFloat(data.markupPercentage as string)).toBeCloseTo(20);
    expect(data.priority).toBe(10);
  });

  it("should create a fixed amount markup rule", async () => {
    const res = await injectAs(app, "finance", "POST", "/api/v1/markup-rules", {
      name: "$5/t Fixed",
      type: "fixed",
      markupFixedAmount: 5,
      priority: 20,
    });

    expect(res.statusCode).toBe(201);
    const data = res.json().data as Record<string, unknown>;
    expect(data.type).toBe("fixed");
    expect(parseFloat(data.markupFixedAmount as string)).toBeCloseTo(5);
  });

  it("should list rules ordered by priority", async () => {
    await injectAs(app, "finance", "POST", "/api/v1/markup-rules", {
      name: "Low Priority", type: "percentage", markupPercentage: 10, priority: 100,
    });
    await injectAs(app, "finance", "POST", "/api/v1/markup-rules", {
      name: "High Priority", type: "percentage", markupPercentage: 25, priority: 5,
    });

    const res = await injectAs(app, "finance", "GET", "/api/v1/markup-rules");
    expect(res.statusCode).toBe(200);
    const data = res.json().data as Array<Record<string, unknown>>;
    expect(data.length).toBe(2);
    expect(data[0]?.name).toBe("High Priority");
    expect(data[1]?.name).toBe("Low Priority");
  });

  it("should update a markup rule", async () => {
    const createRes = await injectAs(app, "finance", "POST", "/api/v1/markup-rules", {
      name: "Original", type: "percentage", markupPercentage: 15,
    });
    const id = (createRes.json().data as Record<string, unknown>).id as string;

    const res = await injectAs(app, "finance", "PUT", `/api/v1/markup-rules/${id}`, {
      name: "Updated", markupPercentage: 25,
    });
    expect(res.statusCode).toBe(200);
    expect((res.json().data as Record<string, unknown>).name).toBe("Updated");
  });

  it("should soft delete a markup rule", async () => {
    const createRes = await injectAs(app, "finance", "POST", "/api/v1/markup-rules", {
      name: "To Delete", type: "fixed", markupFixedAmount: 3,
    });
    const id = (createRes.json().data as Record<string, unknown>).id as string;

    await injectAs(app, "finance", "DELETE", `/api/v1/markup-rules/${id}`);

    const listRes = await injectAs(app, "finance", "GET", "/api/v1/markup-rules");
    expect((listRes.json().data as unknown[]).length).toBe(0);
  });

  it("should reject creation for read_only users", async () => {
    const res = await injectAs(app, "read_only", "POST", "/api/v1/markup-rules", {
      name: "Denied", type: "percentage", markupPercentage: 10,
    });
    expect(res.statusCode).toBe(403);
  });
});

describe("Markup Rule Test/Preview", () => {
  beforeEach(async () => {
    await cleanupPricingEngine();
  });

  it("should match a rule and compute revenue", async () => {
    await injectAs(app, "finance", "POST", "/api/v1/markup-rules", {
      name: "20% Standard", type: "percentage", markupPercentage: 20, priority: 10,
    });

    const res = await injectAs(app, "finance", "POST", "/api/v1/markup-rules/test", {
      unitRate: 30,
      quantity: 100,
    });

    expect(res.statusCode).toBe(200);
    const data = res.json().data as Record<string, unknown>;
    expect(data.matched).toBe(true);
    const result = data.result as Record<string, number>;
    expect(result.costUnitRate).toBe(30);
    expect(result.revenueUnitRate).toBeCloseTo(36);
    expect(result.revenueTotal).toBeCloseTo(3600);
    expect(result.marginPercent).toBeCloseTo(16.67, 0);
  });

  it("should match fixed amount rule", async () => {
    await injectAs(app, "finance", "POST", "/api/v1/markup-rules", {
      name: "$5/t", type: "fixed", markupFixedAmount: 5, priority: 10,
    });

    const res = await injectAs(app, "finance", "POST", "/api/v1/markup-rules/test", {
      unitRate: 25,
      quantity: 50,
    });

    const result = (res.json().data as Record<string, unknown>).result as Record<string, number>;
    expect(result.revenueUnitRate).toBeCloseTo(30);
    expect(result.revenueTotal).toBeCloseTo(1500);
  });

  it("should return no match when no rules exist", async () => {
    const res = await injectAs(app, "finance", "POST", "/api/v1/markup-rules/test", {
      unitRate: 30, quantity: 1,
    });

    const data = res.json().data as Record<string, unknown>;
    expect(data.matched).toBe(false);
  });
});

describe("Margin Thresholds CRUD", () => {
  beforeEach(async () => {
    await cleanupPricingEngine();
  });

  it("should create a global threshold", async () => {
    const res = await injectAs(app, "finance", "POST", "/api/v1/margin-thresholds", {
      level: "global",
      minimumMarginPercent: 10,
      warningMarginPercent: 15,
    });

    expect(res.statusCode).toBe(201);
    const data = res.json().data as Record<string, unknown>;
    expect(data.level).toBe("global");
    expect(parseFloat(data.minimumMarginPercent as string)).toBeCloseTo(10);
    expect(parseFloat(data.warningMarginPercent as string)).toBeCloseTo(15);
    expect(data.requiresApproval).toBe(false);
  });

  it("should create a customer-level threshold with approval required", async () => {
    const res = await injectAs(app, "finance", "POST", "/api/v1/margin-thresholds", {
      level: "customer",
      referenceId: TEST_IDS.company.customerA,
      minimumMarginPercent: 5,
      warningMarginPercent: 8,
      requiresApproval: true,
    });

    expect(res.statusCode).toBe(201);
    const data = res.json().data as Record<string, unknown>;
    expect(data.level).toBe("customer");
    expect(data.referenceId).toBe(TEST_IDS.company.customerA);
    expect(data.requiresApproval).toBe(true);
  });

  it("should list all thresholds", async () => {
    await injectAs(app, "finance", "POST", "/api/v1/margin-thresholds", {
      level: "global", minimumMarginPercent: 10, warningMarginPercent: 15,
    });
    await injectAs(app, "finance", "POST", "/api/v1/margin-thresholds", {
      level: "category", referenceId: TEST_IDS.company.customerA, minimumMarginPercent: 8, warningMarginPercent: 12,
    });

    const res = await injectAs(app, "finance", "GET", "/api/v1/margin-thresholds");
    expect(res.statusCode).toBe(200);
    expect((res.json().data as unknown[]).length).toBe(2);
  });

  it("should update a threshold", async () => {
    const createRes = await injectAs(app, "finance", "POST", "/api/v1/margin-thresholds", {
      level: "global", minimumMarginPercent: 10, warningMarginPercent: 15,
    });
    const id = (createRes.json().data as Record<string, unknown>).id as string;

    const res = await injectAs(app, "finance", "PUT", `/api/v1/margin-thresholds/${id}`, {
      minimumMarginPercent: 12,
      requiresApproval: true,
    });
    expect(res.statusCode).toBe(200);
    expect(parseFloat((res.json().data as Record<string, unknown>).minimumMarginPercent as string)).toBeCloseTo(12);
    expect((res.json().data as Record<string, unknown>).requiresApproval).toBe(true);
  });

  it("should soft delete a threshold", async () => {
    const createRes = await injectAs(app, "finance", "POST", "/api/v1/margin-thresholds", {
      level: "global", minimumMarginPercent: 10, warningMarginPercent: 15,
    });
    const id = (createRes.json().data as Record<string, unknown>).id as string;

    await injectAs(app, "finance", "DELETE", `/api/v1/margin-thresholds/${id}`);

    const listRes = await injectAs(app, "finance", "GET", "/api/v1/margin-thresholds");
    expect((listRes.json().data as unknown[]).length).toBe(0);
  });
});
