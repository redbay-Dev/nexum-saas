import type { JobStatus } from "./constants/index.js";

/**
 * Valid job status transitions.
 * Key = from status, value = array of allowed target statuses.
 */
const VALID_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  draft: ["quoted", "scheduled", "confirmed", "cancelled"],
  quoted: ["confirmed", "scheduled", "declined", "cancelled"],
  scheduled: ["confirmed", "cancelled"],
  confirmed: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["invoiced", "in_progress"],
  invoiced: [],
  cancelled: ["draft"],
  declined: ["draft", "quoted"],
};

/**
 * Transitions that require a reason from the user.
 */
const REASON_REQUIRED_TRANSITIONS: ReadonlySet<string> = new Set([
  "confirmed->cancelled",
  "in_progress->cancelled",
  "completed->in_progress",
  "cancelled->draft",
  "declined->draft",
  "declined->quoted",
  "quoted->declined",
]);

/**
 * Check whether transitioning from one status to another is allowed.
 */
export function isValidTransition(from: JobStatus, to: JobStatus): boolean {
  const allowed = VALID_TRANSITIONS[from];
  return allowed.includes(to);
}

/**
 * Check whether a reason is required for this transition.
 */
export function requiresReason(from: JobStatus, to: JobStatus): boolean {
  return REASON_REQUIRED_TRANSITIONS.has(`${from}->${to}`);
}

/**
 * Get the list of valid target statuses from a given status.
 */
export function getValidTransitions(from: JobStatus): readonly JobStatus[] {
  return VALID_TRANSITIONS[from];
}
