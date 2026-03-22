import { describe, it, expect } from "vitest";
import {
  determineStatusAfterPayment,
  calculateOutstanding,
} from "./payment-tracker.js";

describe("determineStatusAfterPayment", () => {
  it("should return paid when fully paid", () => {
    expect(determineStatusAfterPayment(5000, 5000)).toBe("paid");
  });

  it("should return paid when overpaid", () => {
    expect(determineStatusAfterPayment(5000, 5100)).toBe("paid");
  });

  it("should return partially_paid when underpaid", () => {
    expect(determineStatusAfterPayment(5000, 3000)).toBe("partially_paid");
  });

  it("should return partially_paid for zero payment", () => {
    expect(determineStatusAfterPayment(5000, 0)).toBe("partially_paid");
  });
});

describe("calculateOutstanding", () => {
  it("should calculate remaining amount", () => {
    expect(calculateOutstanding(5000, 3000)).toBe(2000);
  });

  it("should return zero when fully paid", () => {
    expect(calculateOutstanding(5000, 5000)).toBe(0);
  });

  it("should return zero when overpaid", () => {
    expect(calculateOutstanding(5000, 6000)).toBe(0);
  });

  it("should return full amount when nothing paid", () => {
    expect(calculateOutstanding(5000, 0)).toBe(5000);
  });

  it("should round to 2 decimal places", () => {
    expect(calculateOutstanding(100.01, 33.33)).toBe(66.68);
  });
});
