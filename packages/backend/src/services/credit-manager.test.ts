import { describe, it, expect } from "vitest";
import { calculateCreditUsed, checkCreditAvailability } from "./credit-manager.js";

describe("calculateCreditUsed", () => {
  it("should sum invoice_created as positive", () => {
    const txns = [
      { transactionType: "invoice_created", amount: "5000" },
      { transactionType: "invoice_created", amount: "3000" },
    ];
    expect(calculateCreditUsed(txns)).toBe(8000);
  });

  it("should subtract payment_received", () => {
    const txns = [
      { transactionType: "invoice_created", amount: "5000" },
      { transactionType: "payment_received", amount: "2000" },
    ];
    expect(calculateCreditUsed(txns)).toBe(3000);
  });

  it("should subtract job_completed", () => {
    const txns = [
      { transactionType: "invoice_created", amount: "5000" },
      { transactionType: "job_completed", amount: "1000" },
    ];
    expect(calculateCreditUsed(txns)).toBe(4000);
  });

  it("should handle manual_adjustment (positive)", () => {
    const txns = [
      { transactionType: "manual_adjustment", amount: "500" },
    ];
    expect(calculateCreditUsed(txns)).toBe(500);
  });

  it("should handle manual_adjustment (negative)", () => {
    const txns = [
      { transactionType: "invoice_created", amount: "5000" },
      { transactionType: "manual_adjustment", amount: "-500" },
    ];
    expect(calculateCreditUsed(txns)).toBe(4500);
  });

  it("should never go below zero", () => {
    const txns = [
      { transactionType: "payment_received", amount: "10000" },
    ];
    expect(calculateCreditUsed(txns)).toBe(0);
  });

  it("should handle empty transactions", () => {
    expect(calculateCreditUsed([])).toBe(0);
  });

  it("should round to 2 decimal places", () => {
    const txns = [
      { transactionType: "invoice_created", amount: "33.33" },
      { transactionType: "invoice_created", amount: "66.67" },
    ];
    expect(calculateCreditUsed(txns)).toBe(100);
  });
});

describe("checkCreditAvailability", () => {
  it("should report unlimited when no credit limit", () => {
    const result = checkCreditAvailability(null, 5000, 10000);
    expect(result.creditLimit).toBeNull();
    expect(result.creditAvailable).toBeNull();
    expect(result.wouldExceed).toBe(false);
    expect(result.utilizationPercent).toBeNull();
  });

  it("should allow within credit limit", () => {
    const result = checkCreditAvailability(50000, 20000, 10000);
    expect(result.creditLimit).toBe(50000);
    expect(result.creditUsed).toBe(20000);
    expect(result.creditAvailable).toBe(30000);
    expect(result.wouldExceed).toBe(false);
    expect(result.utilizationPercent).toBe(40);
  });

  it("should detect would exceed", () => {
    const result = checkCreditAvailability(50000, 45000, 10000);
    expect(result.wouldExceed).toBe(true);
    expect(result.creditAvailable).toBe(5000);
  });

  it("should handle zero credit limit", () => {
    const result = checkCreditAvailability(0, 0, 100);
    expect(result.wouldExceed).toBe(true);
    expect(result.creditAvailable).toBe(0);
    expect(result.utilizationPercent).toBe(0);
  });

  it("should calculate utilization percent", () => {
    const result = checkCreditAvailability(100000, 80000, 0);
    expect(result.utilizationPercent).toBe(80);
  });
});
