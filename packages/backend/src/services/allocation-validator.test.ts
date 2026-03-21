import { describe, it, expect } from "vitest";
import { validateAllocations } from "./allocation-validator.js";

describe("validateAllocations", () => {
  it("should accept valid 50/50 split", () => {
    const result = validateAllocations(
      [
        { amount: 500, percentage: 50 },
        { amount: 500, percentage: 50 },
      ],
      1000,
    );
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it("should accept valid three-way split", () => {
    const result = validateAllocations(
      [
        { amount: 333.34, percentage: 33.34 },
        { amount: 333.33, percentage: 33.33 },
        { amount: 333.33, percentage: 33.33 },
      ],
      1000,
    );
    expect(result.valid).toBe(true);
  });

  it("should reject percentages not summing to 100", () => {
    const result = validateAllocations(
      [
        { amount: 500, percentage: 40 },
        { amount: 500, percentage: 40 },
      ],
      1000,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("80.00%");
  });

  it("should reject amounts not summing to line total", () => {
    const result = validateAllocations(
      [
        { amount: 400, percentage: 50 },
        { amount: 400, percentage: 50 },
      ],
      1000,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("$800.00");
  });

  it("should accept empty allocations", () => {
    const result = validateAllocations([], 1000);
    expect(result.valid).toBe(true);
  });

  it("should reject non-positive percentage", () => {
    const result = validateAllocations(
      [
        { amount: 1000, percentage: 100 },
        { amount: 0, percentage: 0 },
      ],
      1000,
    );
    expect(result.valid).toBe(false);
  });

  it("should handle rounding tolerance", () => {
    const result = validateAllocations(
      [
        { amount: 333.33, percentage: 33.33 },
        { amount: 333.34, percentage: 33.34 },
        { amount: 333.33, percentage: 33.33 },
      ],
      1000,
    );
    expect(result.valid).toBe(true);
  });
});
