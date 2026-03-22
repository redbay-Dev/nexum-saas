/**
 * RCTI status transitions — validates state machine rules.
 * Pure functions, no database access.
 */

import type { RctiStatus } from "@nexum/shared";

const VALID_RCTI_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ["accumulating", "cancelled"],
  accumulating: ["ready", "cancelled"],
  ready: ["pending_approval", "approved", "cancelled"],
  pending_approval: ["approved", "cancelled"],
  approved: ["sent"],
  sent: ["partially_paid", "paid", "disputed"],
  partially_paid: ["paid", "disputed"],
  paid: [],
  cancelled: [],
  disputed: ["sent", "cancelled"],
};

/**
 * Check if a status transition is valid.
 */
export function isValidRctiTransition(
  currentStatus: string,
  targetStatus: string,
): boolean {
  const allowed = VALID_RCTI_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(targetStatus);
}

/**
 * Get the list of valid next statuses from the current status.
 */
export function getValidRctiTransitions(currentStatus: string): readonly string[] {
  return VALID_RCTI_TRANSITIONS[currentStatus] ?? [];
}

/**
 * Check if an RCTI is immutable (cannot be edited).
 */
export function isRctiImmutable(status: string): boolean {
  const immutableStatuses: readonly string[] = [
    "approved",
    "sent",
    "partially_paid",
    "paid",
    "cancelled",
  ] satisfies RctiStatus[];
  return immutableStatuses.includes(status);
}
