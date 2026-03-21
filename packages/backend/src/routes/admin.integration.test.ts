import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { injectAs } from "../test-utils/helpers.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  app = buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ── Organisation ──

describe("organisation settings", () => {
  it("should return organisation for owner", async () => {
    const res = await injectAs(app, "owner", "GET", "/api/v1/organisation");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    const data = body.data as Record<string, unknown>;
    expect(data.companyName).toBe("Test Transport Co");
    expect(data.timezone).toBe("Australia/Brisbane");
  });

  it("should update organisation for owner", async () => {
    const res = await injectAs(app, "owner", "PUT", "/api/v1/organisation", {
      tradingName: "Updated Trading Name",
      defaultPaymentTerms: 14,
    });
    expect(res.statusCode).toBe(200);
    const data = (res.json().data as Record<string, unknown>);
    expect(data.tradingName).toBe("Updated Trading Name");
    expect(data.defaultPaymentTerms).toBe(14);

    // Restore original
    await injectAs(app, "owner", "PUT", "/api/v1/organisation", {
      tradingName: "Test Transport",
      defaultPaymentTerms: 30,
    });
  });

  it("should reject organisation update from read_only", async () => {
    const res = await injectAs(app, "read_only", "PUT", "/api/v1/organisation", {
      companyName: "Hacked",
    });
    expect(res.statusCode).toBe(403);
  });

  it("should reject organisation update from dispatcher", async () => {
    const res = await injectAs(app, "dispatcher", "PUT", "/api/v1/organisation", {
      companyName: "Nope",
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── Users ──

describe("user management", () => {
  it("should list users for owner", async () => {
    const res = await injectAs(app, "owner", "GET", "/api/v1/users");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    const users = body.data as Array<Record<string, unknown>>;
    expect(users.length).toBeGreaterThanOrEqual(4);
  });

  it("should allow user list from read_only (has view:users)", async () => {
    const res = await injectAs(app, "read_only", "GET", "/api/v1/users");
    expect(res.statusCode).toBe(200);
  });
});

// ── Audit Log ──

describe("audit log", () => {
  it("should return audit log for owner", async () => {
    // Create some audit entries first
    await injectAs(app, "owner", "PUT", "/api/v1/organisation", {
      tradingName: "Audit Test",
    });

    const res = await injectAs(app, "owner", "GET", "/api/v1/audit-log?limit=10");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    const data = body.data as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThan(0);

    // Restore
    await injectAs(app, "owner", "PUT", "/api/v1/organisation", {
      tradingName: "Test Transport",
    });
  });

  it("should filter audit log by action", async () => {
    const res = await injectAs(app, "owner", "GET", "/api/v1/audit-log?action=UPDATE&limit=10");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const data = body.data as Array<Record<string, unknown>>;
    for (const entry of data) {
      expect(entry.action).toBe("UPDATE");
    }
  });

  it("should filter audit log by entity type", async () => {
    const res = await injectAs(app, "owner", "GET", "/api/v1/audit-log?entityType=organisation&limit=10");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const data = body.data as Array<Record<string, unknown>>;
    for (const entry of data) {
      expect(entry.entityType).toBe("organisation");
    }
  });

  it("should reject audit log from dispatcher", async () => {
    const res = await injectAs(app, "dispatcher", "GET", "/api/v1/audit-log");
    expect(res.statusCode).toBe(403);
  });

  it("should support pagination", async () => {
    const res = await injectAs(app, "owner", "GET", "/api/v1/audit-log?limit=2");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data).toBeDefined();
    expect(typeof body.hasMore).toBe("boolean");
  });
});
