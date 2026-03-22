import { describe, it, expect } from "vitest";
import {
  isValidRctiTransition,
  getValidRctiTransitions,
  isRctiImmutable,
} from "./rcti-status.js";

describe("isValidRctiTransition", () => {
  it("should allow draft → accumulating", () => {
    expect(isValidRctiTransition("draft", "accumulating")).toBe(true);
  });

  it("should allow accumulating → ready", () => {
    expect(isValidRctiTransition("accumulating", "ready")).toBe(true);
  });

  it("should allow ready → pending_approval", () => {
    expect(isValidRctiTransition("ready", "pending_approval")).toBe(true);
  });

  it("should allow ready → approved (skip approval if not required)", () => {
    expect(isValidRctiTransition("ready", "approved")).toBe(true);
  });

  it("should allow pending_approval → approved", () => {
    expect(isValidRctiTransition("pending_approval", "approved")).toBe(true);
  });

  it("should allow approved → sent", () => {
    expect(isValidRctiTransition("approved", "sent")).toBe(true);
  });

  it("should allow sent → paid", () => {
    expect(isValidRctiTransition("sent", "paid")).toBe(true);
  });

  it("should allow sent → partially_paid", () => {
    expect(isValidRctiTransition("sent", "partially_paid")).toBe(true);
  });

  it("should allow sent → disputed", () => {
    expect(isValidRctiTransition("sent", "disputed")).toBe(true);
  });

  it("should allow disputed → sent (resolved)", () => {
    expect(isValidRctiTransition("disputed", "sent")).toBe(true);
  });

  it("should allow cancelled from draft/accumulating/ready", () => {
    expect(isValidRctiTransition("draft", "cancelled")).toBe(true);
    expect(isValidRctiTransition("accumulating", "cancelled")).toBe(true);
    expect(isValidRctiTransition("ready", "cancelled")).toBe(true);
    expect(isValidRctiTransition("pending_approval", "cancelled")).toBe(true);
  });

  it("should not allow draft → paid", () => {
    expect(isValidRctiTransition("draft", "paid")).toBe(false);
  });

  it("should not allow paid → anything", () => {
    expect(isValidRctiTransition("paid", "draft")).toBe(false);
    expect(isValidRctiTransition("paid", "sent")).toBe(false);
  });

  it("should return false for unknown status", () => {
    expect(isValidRctiTransition("unknown", "draft")).toBe(false);
  });
});

describe("getValidRctiTransitions", () => {
  it("should return transitions for draft", () => {
    const transitions = getValidRctiTransitions("draft");
    expect(transitions).toContain("accumulating");
    expect(transitions).toContain("cancelled");
  });

  it("should return empty for paid", () => {
    expect(getValidRctiTransitions("paid")).toEqual([]);
  });
});

describe("isRctiImmutable", () => {
  it("should be mutable for draft", () => {
    expect(isRctiImmutable("draft")).toBe(false);
  });

  it("should be mutable for accumulating", () => {
    expect(isRctiImmutable("accumulating")).toBe(false);
  });

  it("should be mutable for ready", () => {
    expect(isRctiImmutable("ready")).toBe(false);
  });

  it("should be immutable for approved", () => {
    expect(isRctiImmutable("approved")).toBe(true);
  });

  it("should be immutable for sent", () => {
    expect(isRctiImmutable("sent")).toBe(true);
  });

  it("should be immutable for paid", () => {
    expect(isRctiImmutable("paid")).toBe(true);
  });
});
