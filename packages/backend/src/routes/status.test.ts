import { describe, it, expect, afterAll } from "vitest";
import { buildApp } from "../app.js";

describe("GET /api/v1/status", () => {
  const app = buildApp();

  afterAll(async () => {
    await app.close();
  });

  it("should return version and environment", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/status",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      success: boolean;
      data: { version: string; environment: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.version).toBe("0.0.0");
    expect(body.data.environment).toBeDefined();
  });
});

describe("unauthenticated route access", () => {
  const app = buildApp();

  afterAll(async () => {
    await app.close();
  });

  it("GET /health should work without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health",
    });
    expect(response.statusCode).toBe(200);
  });

  it("GET /api/v1/status should work without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/status",
    });
    expect(response.statusCode).toBe(200);
  });

  it("GET /api/v1/companies should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/companies",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/jobs should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/jobs",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/employees should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/employees",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/assets should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/assets",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/scheduling should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/scheduling",
    });
    expect(response.statusCode).toBe(401);
  });

  it("POST /api/v1/jobs should return 401 without auth", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/jobs",
      payload: { name: "Test", jobTypeId: "550e8400-e29b-41d4-a716-446655440000" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/materials/tenant should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/materials/tenant",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/contacts should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/contacts",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/addresses should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/addresses",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/regions should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/regions",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/projects should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/projects",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/job-types should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/job-types",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/asset-categories should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/asset-categories",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/material-categories should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/material-categories",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/qualification-types should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/qualification-types",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/organisation should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/organisation",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/users should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/users",
    });
    expect(response.statusCode).toBe(401);
  });

  it("GET /api/v1/audit-log should return 401 without auth", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/audit-log",
    });
    expect(response.statusCode).toBe(401);
  });

  it("should return 404 for non-existent routes", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/nonexistent",
    });
    expect(response.statusCode).toBe(404);
  });
});
