import { describe, it, expect } from "vitest";
import {
  isValidTransition,
  requiresReason,
  getValidTransitions,
} from "./job-lifecycle.js";
import { JOB_STATUSES } from "./constants/index.js";

describe("isValidTransition", () => {
  // ── Happy path: forward flow ──

  it("draft → quoted (quoting)", () => {
    expect(isValidTransition("draft", "quoted")).toBe(true);
  });

  it("draft → scheduled (skip quote)", () => {
    expect(isValidTransition("draft", "scheduled")).toBe(true);
  });

  it("draft → confirmed (urgent — skip quote and schedule)", () => {
    expect(isValidTransition("draft", "confirmed")).toBe(true);
  });

  it("quoted → confirmed (customer accepts quote)", () => {
    expect(isValidTransition("quoted", "confirmed")).toBe(true);
  });

  it("quoted → scheduled (schedule before confirming)", () => {
    expect(isValidTransition("quoted", "scheduled")).toBe(true);
  });

  it("scheduled → confirmed (dispatcher confirms)", () => {
    expect(isValidTransition("scheduled", "confirmed")).toBe(true);
  });

  it("confirmed → in_progress (work starts)", () => {
    expect(isValidTransition("confirmed", "in_progress")).toBe(true);
  });

  it("in_progress → completed (work finished)", () => {
    expect(isValidTransition("in_progress", "completed")).toBe(true);
  });

  it("completed → invoiced (invoice generated)", () => {
    expect(isValidTransition("completed", "invoiced")).toBe(true);
  });

  // ── Rework path ──

  it("completed → in_progress (rework — reopening a completed job)", () => {
    expect(isValidTransition("completed", "in_progress")).toBe(true);
  });

  // ── Cancellation ──

  it("draft → cancelled", () => {
    expect(isValidTransition("draft", "cancelled")).toBe(true);
  });

  it("quoted → cancelled", () => {
    expect(isValidTransition("quoted", "cancelled")).toBe(true);
  });

  it("scheduled → cancelled", () => {
    expect(isValidTransition("scheduled", "cancelled")).toBe(true);
  });

  it("confirmed → cancelled", () => {
    expect(isValidTransition("confirmed", "cancelled")).toBe(true);
  });

  it("in_progress → cancelled", () => {
    expect(isValidTransition("in_progress", "cancelled")).toBe(true);
  });

  // ── Decline ──

  it("quoted → declined (customer declines quote)", () => {
    expect(isValidTransition("quoted", "declined")).toBe(true);
  });

  // ── Recovery from cancelled/declined ──

  it("cancelled → draft (reactivate)", () => {
    expect(isValidTransition("cancelled", "draft")).toBe(true);
  });

  it("declined → draft (restart from scratch)", () => {
    expect(isValidTransition("declined", "draft")).toBe(true);
  });

  it("declined → quoted (re-quote)", () => {
    expect(isValidTransition("declined", "quoted")).toBe(true);
  });

  // ── Terminal state ──

  it("invoiced is terminal — no transitions allowed", () => {
    for (const status of JOB_STATUSES) {
      expect(isValidTransition("invoiced", status)).toBe(false);
    }
  });

  // ── Invalid transitions ──

  it("should reject backward transitions not explicitly allowed", () => {
    expect(isValidTransition("completed", "confirmed")).toBe(false);
    expect(isValidTransition("in_progress", "scheduled")).toBe(false);
    expect(isValidTransition("confirmed", "draft")).toBe(false);
    expect(isValidTransition("scheduled", "draft")).toBe(false);
  });

  it("should reject transitions from completed to cancelled", () => {
    expect(isValidTransition("completed", "cancelled")).toBe(false);
  });

  it("should reject self-transitions", () => {
    for (const status of JOB_STATUSES) {
      expect(isValidTransition(status, status)).toBe(false);
    }
  });

  it("cancelled cannot go directly to in_progress or completed", () => {
    expect(isValidTransition("cancelled", "in_progress")).toBe(false);
    expect(isValidTransition("cancelled", "completed")).toBe(false);
    expect(isValidTransition("cancelled", "invoiced")).toBe(false);
  });
});

describe("requiresReason", () => {
  // ── Transitions requiring reason ──

  it("confirmed → cancelled requires reason", () => {
    expect(requiresReason("confirmed", "cancelled")).toBe(true);
  });

  it("in_progress → cancelled requires reason", () => {
    expect(requiresReason("in_progress", "cancelled")).toBe(true);
  });

  it("completed → in_progress (rework) requires reason", () => {
    expect(requiresReason("completed", "in_progress")).toBe(true);
  });

  it("cancelled → draft (reactivation) requires reason", () => {
    expect(requiresReason("cancelled", "draft")).toBe(true);
  });

  it("declined → draft requires reason", () => {
    expect(requiresReason("declined", "draft")).toBe(true);
  });

  it("declined → quoted requires reason", () => {
    expect(requiresReason("declined", "quoted")).toBe(true);
  });

  it("quoted → declined requires reason", () => {
    expect(requiresReason("quoted", "declined")).toBe(true);
  });

  // ── Transitions NOT requiring reason ──

  it("draft → cancelled does NOT require reason (nothing invested yet)", () => {
    expect(requiresReason("draft", "cancelled")).toBe(false);
  });

  it("draft → quoted does NOT require reason", () => {
    expect(requiresReason("draft", "quoted")).toBe(false);
  });

  it("confirmed → in_progress does NOT require reason", () => {
    expect(requiresReason("confirmed", "in_progress")).toBe(false);
  });

  it("in_progress → completed does NOT require reason", () => {
    expect(requiresReason("in_progress", "completed")).toBe(false);
  });

  it("completed → invoiced does NOT require reason", () => {
    expect(requiresReason("completed", "invoiced")).toBe(false);
  });

  it("scheduled → confirmed does NOT require reason", () => {
    expect(requiresReason("scheduled", "confirmed")).toBe(false);
  });
});

describe("getValidTransitions", () => {
  it("should return valid targets for draft", () => {
    const transitions = getValidTransitions("draft");
    expect(transitions).toContain("quoted");
    expect(transitions).toContain("scheduled");
    expect(transitions).toContain("confirmed");
    expect(transitions).toContain("cancelled");
    expect(transitions).not.toContain("in_progress");
    expect(transitions).not.toContain("completed");
  });

  it("should return empty array for invoiced (terminal)", () => {
    const transitions = getValidTransitions("invoiced");
    expect(transitions).toEqual([]);
  });

  it("should return only draft for cancelled", () => {
    const transitions = getValidTransitions("cancelled");
    expect(transitions).toEqual(["draft"]);
  });

  it("should return draft and quoted for declined", () => {
    const transitions = getValidTransitions("declined");
    expect(transitions).toContain("draft");
    expect(transitions).toContain("quoted");
    expect(transitions).toHaveLength(2);
  });

  it("every valid transition should be a known job status", () => {
    const statusSet = new Set<string>(JOB_STATUSES);
    for (const status of JOB_STATUSES) {
      const targets = getValidTransitions(status);
      for (const target of targets) {
        expect(statusSet.has(target)).toBe(true);
      }
    }
  });

  it("getValidTransitions should be consistent with isValidTransition", () => {
    for (const from of JOB_STATUSES) {
      const validTargets = getValidTransitions(from);
      for (const to of JOB_STATUSES) {
        const expected = validTargets.includes(to);
        expect(isValidTransition(from, to)).toBe(expected);
      }
    }
  });
});
