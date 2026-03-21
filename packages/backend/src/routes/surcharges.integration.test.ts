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

async function cleanupSurcharges(): Promise<void> {
  await tenantDb.execute(sql.raw(`TRUNCATE TABLE surcharge_history CASCADE`));
  await tenantDb.execute(sql.raw(`TRUNCATE TABLE surcharges CASCADE`));
  await tenantDb.execute(sql.raw(`TRUNCATE TABLE audit_log`));
}

describe("Surcharges CRUD", () => {
  beforeEach(async () => {
    await cleanupSurcharges();
  });

  it("should create a percentage surcharge", async () => {
    const res = await injectAs(app, "finance", "POST", "/api/v1/surcharges", {
      name: "Fuel Levy",
      type: "percentage",
      value: 3.5,
      appliesTo: ["cartage", "hire"],
      effectiveFrom: "2026-01-01",
    });

    expect(res.statusCode).toBe(201);
    const data = res.json().data as Record<string, unknown>;
    expect(data.name).toBe("Fuel Levy");
    expect(data.type).toBe("percentage");
    expect(parseFloat(data.value as string)).toBeCloseTo(3.5);
    expect(data.appliesTo).toEqual(["cartage", "hire"]);
    expect(data.autoApply).toBe(true);
  });

  it("should create a fixed surcharge", async () => {
    const res = await injectAs(app, "finance", "POST", "/api/v1/surcharges", {
      name: "Environmental Levy",
      type: "fixed",
      value: 2.50,
      appliesTo: ["tip_fee"],
      autoApply: true,
      effectiveFrom: "2026-04-01",
      effectiveTo: "2026-06-30",
    });

    expect(res.statusCode).toBe(201);
    const data = res.json().data as Record<string, unknown>;
    expect(data.effectiveTo).toBe("2026-06-30");
  });

  it("should list surcharges", async () => {
    await injectAs(app, "finance", "POST", "/api/v1/surcharges", {
      name: "Levy 1", type: "percentage", value: 3, appliesTo: ["cartage"], effectiveFrom: "2026-01-01",
    });
    await injectAs(app, "finance", "POST", "/api/v1/surcharges", {
      name: "Levy 2", type: "fixed", value: 1, appliesTo: ["hire"], effectiveFrom: "2026-01-01",
    });

    const res = await injectAs(app, "finance", "GET", "/api/v1/surcharges");
    expect(res.statusCode).toBe(200);
    expect((res.json().data as unknown[]).length).toBe(2);
  });

  it("should update surcharge and record value history", async () => {
    const createRes = await injectAs(app, "finance", "POST", "/api/v1/surcharges", {
      name: "Fuel Levy", type: "percentage", value: 3, appliesTo: ["cartage"], effectiveFrom: "2026-01-01",
    });
    const id = (createRes.json().data as Record<string, unknown>).id as string;

    // Update value
    const updateRes = await injectAs(app, "finance", "PUT", `/api/v1/surcharges/${id}`, {
      value: 4.5,
    });
    expect(updateRes.statusCode).toBe(200);

    // Check history was recorded
    const detailRes = await injectAs(app, "finance", "GET", `/api/v1/surcharges/${id}`);
    const data = detailRes.json().data as Record<string, unknown>;
    const history = data.history as Array<Record<string, unknown>>;
    expect(history.length).toBe(1);
    expect(parseFloat(history[0]?.previousValue as string)).toBeCloseTo(3);
    expect(parseFloat(history[0]?.newValue as string)).toBeCloseTo(4.5);
  });

  it("should soft delete a surcharge", async () => {
    const createRes = await injectAs(app, "finance", "POST", "/api/v1/surcharges", {
      name: "To Delete", type: "fixed", value: 1, appliesTo: ["other"], effectiveFrom: "2026-01-01",
    });
    const id = (createRes.json().data as Record<string, unknown>).id as string;

    await injectAs(app, "finance", "DELETE", `/api/v1/surcharges/${id}`);

    const listRes = await injectAs(app, "finance", "GET", "/api/v1/surcharges");
    expect((listRes.json().data as unknown[]).length).toBe(0);
  });

  it("should reject creation for read_only users", async () => {
    const res = await injectAs(app, "read_only", "POST", "/api/v1/surcharges", {
      name: "Denied", type: "percentage", value: 5, appliesTo: ["cartage"], effectiveFrom: "2026-01-01",
    });
    expect(res.statusCode).toBe(403);
  });

  it("should create audit log entries", async () => {
    const createRes = await injectAs(app, "finance", "POST", "/api/v1/surcharges", {
      name: "Audit Test", type: "percentage", value: 2, appliesTo: ["hire"], effectiveFrom: "2026-01-01",
    });
    const id = (createRes.json().data as Record<string, unknown>).id as string;

    const auditRows = await tenantDb.execute(
      sql`SELECT action FROM audit_log WHERE entity_type = 'surcharge' AND entity_id = ${id}::uuid`,
    );
    expect((auditRows as unknown[]).length).toBeGreaterThanOrEqual(1);
  });
});
