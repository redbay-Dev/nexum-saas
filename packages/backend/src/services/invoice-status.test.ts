import { describe, it, expect } from "vitest";
import {
  isValidInvoiceTransition,
  getValidInvoiceTransitions,
  isInvoiceImmutable,
} from "./invoice-status.js";

describe("isValidInvoiceTransition", () => {
  it("should allow draft → verified", () => {
    expect(isValidInvoiceTransition("draft", "verified")).toBe(true);
  });

  it("should allow draft → rejected", () => {
    expect(isValidInvoiceTransition("draft", "rejected")).toBe(true);
  });

  it("should allow draft → cancelled", () => {
    expect(isValidInvoiceTransition("draft", "cancelled")).toBe(true);
  });

  it("should allow verified → sent", () => {
    expect(isValidInvoiceTransition("verified", "sent")).toBe(true);
  });

  it("should allow sent → paid", () => {
    expect(isValidInvoiceTransition("sent", "paid")).toBe(true);
  });

  it("should allow sent → partially_paid", () => {
    expect(isValidInvoiceTransition("sent", "partially_paid")).toBe(true);
  });

  it("should allow sent → overdue", () => {
    expect(isValidInvoiceTransition("sent", "overdue")).toBe(true);
  });

  it("should allow overdue → paid", () => {
    expect(isValidInvoiceTransition("overdue", "paid")).toBe(true);
  });

  it("should allow rejected → draft", () => {
    expect(isValidInvoiceTransition("rejected", "draft")).toBe(true);
  });

  it("should not allow draft → paid", () => {
    expect(isValidInvoiceTransition("draft", "paid")).toBe(false);
  });

  it("should not allow paid → anything", () => {
    expect(isValidInvoiceTransition("paid", "draft")).toBe(false);
    expect(isValidInvoiceTransition("paid", "sent")).toBe(false);
  });

  it("should not allow cancelled → anything", () => {
    expect(isValidInvoiceTransition("cancelled", "draft")).toBe(false);
  });

  it("should return false for unknown status", () => {
    expect(isValidInvoiceTransition("unknown", "draft")).toBe(false);
  });
});

describe("getValidInvoiceTransitions", () => {
  it("should return transitions for draft", () => {
    const transitions = getValidInvoiceTransitions("draft");
    expect(transitions).toContain("verified");
    expect(transitions).toContain("rejected");
    expect(transitions).toContain("cancelled");
  });

  it("should return empty for paid", () => {
    expect(getValidInvoiceTransitions("paid")).toEqual([]);
  });

  it("should return empty for unknown status", () => {
    expect(getValidInvoiceTransitions("unknown")).toEqual([]);
  });
});

describe("isInvoiceImmutable", () => {
  it("should be mutable for draft", () => {
    expect(isInvoiceImmutable("draft")).toBe(false);
  });

  it("should be mutable for verified", () => {
    expect(isInvoiceImmutable("verified")).toBe(false);
  });

  it("should be mutable for rejected", () => {
    expect(isInvoiceImmutable("rejected")).toBe(false);
  });

  it("should be immutable for sent", () => {
    expect(isInvoiceImmutable("sent")).toBe(true);
  });

  it("should be immutable for paid", () => {
    expect(isInvoiceImmutable("paid")).toBe(true);
  });

  it("should be immutable for partially_paid", () => {
    expect(isInvoiceImmutable("partially_paid")).toBe(true);
  });

  it("should be immutable for overdue", () => {
    expect(isInvoiceImmutable("overdue")).toBe(true);
  });

  it("should be immutable for cancelled", () => {
    expect(isInvoiceImmutable("cancelled")).toBe(true);
  });
});
