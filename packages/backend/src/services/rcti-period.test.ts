import { describe, it, expect } from "vitest";
import {
  calculatePeriodBounds,
  calculateDueDate,
} from "./rcti-period.js";

describe("calculatePeriodBounds — weekly", () => {
  it("should calculate Monday-Sunday for a Wednesday", () => {
    const result = calculatePeriodBounds("weekly", "2026-03-18"); // Wednesday
    expect(result.start).toBe("2026-03-16"); // Monday
    expect(result.end).toBe("2026-03-22"); // Sunday
  });

  it("should handle Monday", () => {
    const result = calculatePeriodBounds("weekly", "2026-03-16"); // Monday
    expect(result.start).toBe("2026-03-16");
    expect(result.end).toBe("2026-03-22");
  });

  it("should handle Sunday", () => {
    const result = calculatePeriodBounds("weekly", "2026-03-22"); // Sunday
    expect(result.start).toBe("2026-03-16");
    expect(result.end).toBe("2026-03-22");
  });

  it("should handle week spanning month boundary", () => {
    const result = calculatePeriodBounds("weekly", "2026-04-01"); // Wednesday
    expect(result.start).toBe("2026-03-30"); // Monday
    expect(result.end).toBe("2026-04-05"); // Sunday
  });
});

describe("calculatePeriodBounds — bi_monthly", () => {
  it("should calculate first half (1st to 15th)", () => {
    const result = calculatePeriodBounds("bi_monthly", "2026-03-10", {
      paymentDay1: 15,
      paymentDay2: 28,
    });
    expect(result.start).toBe("2026-03-01");
    expect(result.end).toBe("2026-03-15");
  });

  it("should calculate second half (16th to 28th)", () => {
    const result = calculatePeriodBounds("bi_monthly", "2026-03-20", {
      paymentDay1: 15,
      paymentDay2: 28,
    });
    expect(result.start).toBe("2026-03-16");
    expect(result.end).toBe("2026-03-28");
  });

  it("should handle date on boundary (15th)", () => {
    const result = calculatePeriodBounds("bi_monthly", "2026-03-15", {
      paymentDay1: 15,
      paymentDay2: 28,
    });
    expect(result.start).toBe("2026-03-01");
    expect(result.end).toBe("2026-03-15");
  });

  it("should cap second half at end of month for short months", () => {
    const result = calculatePeriodBounds("bi_monthly", "2026-02-20", {
      paymentDay1: 15,
      paymentDay2: 30,
    });
    expect(result.start).toBe("2026-02-16");
    expect(result.end).toBe("2026-02-28"); // Feb has 28 days
  });
});

describe("calculatePeriodBounds — monthly", () => {
  it("should calculate full month", () => {
    const result = calculatePeriodBounds("monthly", "2026-03-15");
    expect(result.start).toBe("2026-03-01");
    expect(result.end).toBe("2026-03-31");
  });

  it("should handle February", () => {
    const result = calculatePeriodBounds("monthly", "2026-02-10");
    expect(result.start).toBe("2026-02-01");
    expect(result.end).toBe("2026-02-28");
  });

  it("should handle leap year February", () => {
    const result = calculatePeriodBounds("monthly", "2028-02-10");
    expect(result.start).toBe("2028-02-01");
    expect(result.end).toBe("2028-02-29");
  });
});

describe("calculateDueDate", () => {
  it("should add payment terms to period end", () => {
    expect(calculateDueDate("2026-03-22", 7)).toBe("2026-03-29");
  });

  it("should handle month boundary", () => {
    expect(calculateDueDate("2026-03-28", 7)).toBe("2026-04-04");
  });

  it("should handle zero terms", () => {
    expect(calculateDueDate("2026-03-22", 0)).toBe("2026-03-22");
  });

  it("should handle 30-day terms", () => {
    expect(calculateDueDate("2026-03-31", 30)).toBe("2026-04-30");
  });
});
