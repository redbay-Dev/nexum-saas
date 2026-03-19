import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";

describe("GET /health", () => {
  it("should return ok status", async () => {
    const app = buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      status: string;
      service: string;
    };
    expect(body.status).toBe("ok");
    expect(body.service).toBe("nexum-api");

    await app.close();
  });
});
