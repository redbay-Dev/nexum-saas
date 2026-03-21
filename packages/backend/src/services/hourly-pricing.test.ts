import { describe, it, expect } from "vitest";
import { calculateHourlyCharge } from "./hourly-pricing.js";

describe("calculateHourlyCharge", () => {
  it("should calculate basic hourly charge", () => {
    const result = calculateHourlyCharge(8, 120);
    expect(result.chargeableHours).toBe(8);
    expect(result.baseCharge).toBe(960);
    expect(result.totalCharge).toBe(960);
    expect(result.minimumApplied).toBe(false);
    expect(result.overtimeApplied).toBe(false);
  });

  it("should enforce minimum charge hours", () => {
    const result = calculateHourlyCharge(3, 120, 4);
    expect(result.chargeableHours).toBe(4);
    expect(result.baseCharge).toBe(480);
    expect(result.totalCharge).toBe(480);
    expect(result.minimumApplied).toBe(true);
  });

  it("should not apply minimum when actual exceeds it", () => {
    const result = calculateHourlyCharge(6, 120, 4);
    expect(result.chargeableHours).toBe(6);
    expect(result.baseCharge).toBe(720);
    expect(result.minimumApplied).toBe(false);
  });

  it("should calculate overtime when exceeding threshold", () => {
    const result = calculateHourlyCharge(10, 120, 0, 180, 8);
    expect(result.overtimeApplied).toBe(true);
    expect(result.baseCharge).toBe(960); // 8 hours * $120
    expect(result.overtimeCharge).toBe(360); // 2 hours * $180
    expect(result.totalCharge).toBe(1320);
  });

  it("should not apply overtime when below threshold", () => {
    const result = calculateHourlyCharge(6, 120, 0, 180, 8);
    expect(result.overtimeApplied).toBe(false);
    expect(result.overtimeCharge).toBe(0);
    expect(result.totalCharge).toBe(720);
  });

  it("should apply both minimum and overtime correctly", () => {
    // Minimum 4h, overtime after 8h at $180
    // Work 2 hours — minimum applies → 4h charged at base rate
    const result = calculateHourlyCharge(2, 120, 4, 180, 8);
    expect(result.minimumApplied).toBe(true);
    expect(result.overtimeApplied).toBe(false);
    expect(result.totalCharge).toBe(480);
  });

  it("should handle zero hours", () => {
    const result = calculateHourlyCharge(0, 120, 4);
    expect(result.minimumApplied).toBe(true);
    expect(result.chargeableHours).toBe(4);
    expect(result.totalCharge).toBe(480);
  });

  it("should round to 2 decimal places", () => {
    const result = calculateHourlyCharge(3, 33.33);
    expect(result.totalCharge).toBe(99.99);
  });
});
