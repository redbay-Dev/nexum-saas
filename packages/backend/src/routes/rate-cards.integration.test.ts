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

async function cleanupRateCards(): Promise<void> {
  await tenantDb.execute(sql.raw(`TRUNCATE TABLE customer_rate_card_entries CASCADE`));
  await tenantDb.execute(sql.raw(`TRUNCATE TABLE customer_rate_cards CASCADE`));
  await tenantDb.execute(sql.raw(`TRUNCATE TABLE audit_log`));
}

describe("Rate Cards CRUD", () => {
  beforeEach(async () => {
    await cleanupRateCards();
  });

  it("should create a rate card", async () => {
    const res = await injectAs(app, "finance", "POST", "/api/v1/rate-cards", {
      customerId: TEST_IDS.company.customerA,
      name: "Standard Rates 2026",
      effectiveFrom: "2026-01-01",
    });

    expect(res.statusCode).toBe(201);
    const data = res.json().data as Record<string, unknown>;
    expect(data.id).toBeDefined();
    expect(data.name).toBe("Standard Rates 2026");
    expect(data.customerId).toBe(TEST_IDS.company.customerA);
    expect(data.isActive).toBe(true);
  });

  it("should create a rate card with effective date range", async () => {
    const res = await injectAs(app, "finance", "POST", "/api/v1/rate-cards", {
      customerId: TEST_IDS.company.customerA,
      name: "Q1 Rates",
      effectiveFrom: "2026-01-01",
      effectiveTo: "2026-03-31",
      notes: "Quarterly rate review",
    });

    expect(res.statusCode).toBe(201);
    const data = res.json().data as Record<string, unknown>;
    expect(data.effectiveFrom).toBe("2026-01-01");
    expect(data.effectiveTo).toBe("2026-03-31");
    expect(data.notes).toBe("Quarterly rate review");
  });

  it("should list rate cards", async () => {
    await injectAs(app, "finance", "POST", "/api/v1/rate-cards", {
      customerId: TEST_IDS.company.customerA,
      name: "Card 1",
      effectiveFrom: "2026-01-01",
    });
    await injectAs(app, "finance", "POST", "/api/v1/rate-cards", {
      customerId: TEST_IDS.company.customerA,
      name: "Card 2",
      effectiveFrom: "2026-04-01",
    });

    const res = await injectAs(app, "finance", "GET", "/api/v1/rate-cards");
    expect(res.statusCode).toBe(200);
    const data = res.json().data as unknown[];
    expect(data.length).toBe(2);
  });

  it("should filter rate cards by customer", async () => {
    await injectAs(app, "finance", "POST", "/api/v1/rate-cards", {
      customerId: TEST_IDS.company.customerA,
      name: "Customer A Card",
      effectiveFrom: "2026-01-01",
    });

    const res = await injectAs(
      app, "finance", "GET",
      `/api/v1/rate-cards?customerId=${TEST_IDS.company.customerA}`,
    );
    expect(res.statusCode).toBe(200);
    const data = res.json().data as unknown[];
    expect(data.length).toBe(1);
  });

  it("should get rate card with entries", async () => {
    const createRes = await injectAs(app, "finance", "POST", "/api/v1/rate-cards", {
      customerId: TEST_IDS.company.customerA,
      name: "Test Card",
      effectiveFrom: "2026-01-01",
    });
    const cardId = (createRes.json().data as Record<string, unknown>).id as string;

    // Add entry
    await injectAs(app, "finance", "POST", `/api/v1/rate-cards/${cardId}/entries`, {
      category: "cartage",
      rateType: "per_tonne",
      unitRate: 15.50,
      description: "Standard cartage",
    });

    const res = await injectAs(app, "finance", "GET", `/api/v1/rate-cards/${cardId}`);
    expect(res.statusCode).toBe(200);
    const data = res.json().data as Record<string, unknown>;
    expect(data.name).toBe("Test Card");
    const entries = data.entries as unknown[];
    expect(entries.length).toBe(1);
  });

  it("should update a rate card", async () => {
    const createRes = await injectAs(app, "finance", "POST", "/api/v1/rate-cards", {
      customerId: TEST_IDS.company.customerA,
      name: "Original Name",
      effectiveFrom: "2026-01-01",
    });
    const cardId = (createRes.json().data as Record<string, unknown>).id as string;

    const res = await injectAs(app, "finance", "PUT", `/api/v1/rate-cards/${cardId}`, {
      name: "Updated Name",
      isActive: false,
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data as Record<string, unknown>;
    expect(data.name).toBe("Updated Name");
    expect(data.isActive).toBe(false);
  });

  it("should soft delete a rate card", async () => {
    const createRes = await injectAs(app, "finance", "POST", "/api/v1/rate-cards", {
      customerId: TEST_IDS.company.customerA,
      name: "To Delete",
      effectiveFrom: "2026-01-01",
    });
    const cardId = (createRes.json().data as Record<string, unknown>).id as string;

    const delRes = await injectAs(app, "finance", "DELETE", `/api/v1/rate-cards/${cardId}`);
    expect(delRes.statusCode).toBe(200);

    // Should not appear in list
    const listRes = await injectAs(app, "finance", "GET", "/api/v1/rate-cards");
    expect((listRes.json().data as unknown[]).length).toBe(0);
  });

  it("should reject rate card creation for read_only users", async () => {
    const res = await injectAs(app, "read_only", "POST", "/api/v1/rate-cards", {
      customerId: TEST_IDS.company.customerA,
      name: "Should Fail",
      effectiveFrom: "2026-01-01",
    });
    expect(res.statusCode).toBe(403);
  });

  it("should allow finance users to view rate cards", async () => {
    const res = await injectAs(app, "finance", "GET", "/api/v1/rate-cards");
    expect(res.statusCode).toBe(200);
  });
});

describe("Rate Card Entries", () => {
  let cardId: string;

  beforeEach(async () => {
    await cleanupRateCards();
    const createRes = await injectAs(app, "finance", "POST", "/api/v1/rate-cards", {
      customerId: TEST_IDS.company.customerA,
      name: "Entry Test Card",
      effectiveFrom: "2026-01-01",
    });
    cardId = (createRes.json().data as Record<string, unknown>).id as string;
  });

  it("should add an entry to a rate card", async () => {
    const res = await injectAs(app, "finance", "POST", `/api/v1/rate-cards/${cardId}/entries`, {
      category: "cartage",
      rateType: "per_tonne",
      unitRate: 15.50,
      description: "Standard cartage rate",
    });
    expect(res.statusCode).toBe(201);
    const data = res.json().data as Record<string, unknown>;
    expect(data.rateCardId).toBe(cardId);
    expect(parseFloat(data.unitRate as string)).toBeCloseTo(15.50);
    expect(data.category).toBe("cartage");
  });

  it("should update an entry", async () => {
    const createRes = await injectAs(app, "finance", "POST", `/api/v1/rate-cards/${cardId}/entries`, {
      category: "hire",
      rateType: "per_hour",
      unitRate: 120,
    });
    const entryId = (createRes.json().data as Record<string, unknown>).id as string;

    const res = await injectAs(app, "finance", "PUT", `/api/v1/rate-cards/${cardId}/entries/${entryId}`, {
      unitRate: 130,
      description: "Updated hourly rate",
    });
    expect(res.statusCode).toBe(200);
    expect(parseFloat((res.json().data as Record<string, unknown>).unitRate as string)).toBeCloseTo(130);
  });

  it("should delete an entry", async () => {
    const createRes = await injectAs(app, "finance", "POST", `/api/v1/rate-cards/${cardId}/entries`, {
      category: "material",
      rateType: "per_tonne",
      unitRate: 30,
    });
    const entryId = (createRes.json().data as Record<string, unknown>).id as string;

    const res = await injectAs(app, "finance", "DELETE", `/api/v1/rate-cards/${cardId}/entries/${entryId}`);
    expect(res.statusCode).toBe(200);

    // Verify entry is gone
    const detailRes = await injectAs(app, "finance", "GET", `/api/v1/rate-cards/${cardId}`);
    const entries = (detailRes.json().data as Record<string, unknown>).entries as unknown[];
    expect(entries.length).toBe(0);
  });

  it("should add multiple entries with different categories", async () => {
    await injectAs(app, "finance", "POST", `/api/v1/rate-cards/${cardId}/entries`, {
      category: "cartage",
      rateType: "per_tonne",
      unitRate: 15,
    });
    await injectAs(app, "finance", "POST", `/api/v1/rate-cards/${cardId}/entries`, {
      category: "hire",
      rateType: "per_hour",
      unitRate: 120,
    });
    await injectAs(app, "finance", "POST", `/api/v1/rate-cards/${cardId}/entries`, {
      category: "tip_fee",
      rateType: "per_tonne",
      unitRate: 8.50,
    });

    const res = await injectAs(app, "finance", "GET", `/api/v1/rate-cards/${cardId}`);
    const entries = (res.json().data as Record<string, unknown>).entries as unknown[];
    expect(entries.length).toBe(3);
  });
});

describe("Rate Lookup", () => {
  beforeEach(async () => {
    await cleanupRateCards();
  });

  it("should return rate_card source when active rate card exists", async () => {
    // Create rate card
    const createRes = await injectAs(app, "finance", "POST", "/api/v1/rate-cards", {
      customerId: TEST_IDS.company.customerA,
      name: "Active Card",
      effectiveFrom: "2026-01-01",
    });
    const cardId = (createRes.json().data as Record<string, unknown>).id as string;

    // Add entry
    await injectAs(app, "finance", "POST", `/api/v1/rate-cards/${cardId}/entries`, {
      category: "cartage",
      rateType: "per_tonne",
      unitRate: 18.75,
    });

    // Lookup
    const res = await injectAs(
      app, "finance", "GET",
      `/api/v1/rate-cards/lookup?customerId=${TEST_IDS.company.customerA}&category=cartage&rateType=per_tonne&jobDate=2026-02-15`,
    );
    expect(res.statusCode).toBe(200);
    const data = res.json().data as Record<string, unknown>;
    expect(data.source).toBe("rate_card");
    expect(data.rate).toBeCloseTo(18.75);
    expect(data.rateCardEntryId).toBeDefined();
  });

  it("should return not_found when no rate card exists", async () => {
    const res = await injectAs(
      app, "finance", "GET",
      `/api/v1/rate-cards/lookup?customerId=${TEST_IDS.company.customerA}&category=cartage&rateType=per_tonne`,
    );
    expect(res.statusCode).toBe(200);
    const data = res.json().data as Record<string, unknown>;
    expect(data.source).toBe("not_found");
    expect(data.rate).toBe(0);
  });

  it("should not return rates from inactive rate cards", async () => {
    const createRes = await injectAs(app, "finance", "POST", "/api/v1/rate-cards", {
      customerId: TEST_IDS.company.customerA,
      name: "Inactive Card",
      effectiveFrom: "2026-01-01",
      isActive: false,
    });
    const cardId = (createRes.json().data as Record<string, unknown>).id as string;

    await injectAs(app, "finance", "POST", `/api/v1/rate-cards/${cardId}/entries`, {
      category: "cartage",
      rateType: "per_tonne",
      unitRate: 20,
    });

    const res = await injectAs(
      app, "finance", "GET",
      `/api/v1/rate-cards/lookup?customerId=${TEST_IDS.company.customerA}&category=cartage&rateType=per_tonne&jobDate=2026-02-15`,
    );
    const data = res.json().data as Record<string, unknown>;
    expect(data.source).toBe("not_found");
  });

  it("should not return rates outside effective date range", async () => {
    const createRes = await injectAs(app, "finance", "POST", "/api/v1/rate-cards", {
      customerId: TEST_IDS.company.customerA,
      name: "Expired Card",
      effectiveFrom: "2025-01-01",
      effectiveTo: "2025-12-31",
    });
    const cardId = (createRes.json().data as Record<string, unknown>).id as string;

    await injectAs(app, "finance", "POST", `/api/v1/rate-cards/${cardId}/entries`, {
      category: "cartage",
      rateType: "per_tonne",
      unitRate: 20,
    });

    const res = await injectAs(
      app, "finance", "GET",
      `/api/v1/rate-cards/lookup?customerId=${TEST_IDS.company.customerA}&category=cartage&rateType=per_tonne&jobDate=2026-02-15`,
    );
    const data = res.json().data as Record<string, unknown>;
    expect(data.source).toBe("not_found");
  });

  it("should create audit log entries for rate card operations", async () => {
    const createRes = await injectAs(app, "finance", "POST", "/api/v1/rate-cards", {
      customerId: TEST_IDS.company.customerA,
      name: "Audit Test",
      effectiveFrom: "2026-01-01",
    });
    const cardId = (createRes.json().data as Record<string, unknown>).id as string;

    // Check audit log
    const auditRows = await tenantDb.execute(
      sql`SELECT action, entity_type FROM audit_log WHERE entity_type = 'customer_rate_card' AND entity_id = ${cardId}::uuid`,
    );
    expect((auditRows as unknown[]).length).toBeGreaterThanOrEqual(1);
  });
});
