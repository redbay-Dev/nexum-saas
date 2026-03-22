/**
 * Invoice status transitions — validates state machine rules.
 * Pure functions, no database access.
 */

import type { InvoiceStatus } from "@nexum/shared";

const VALID_INVOICE_TRANSITIONS: Record<string, readonly string[]> = {
  draft: ["verified", "rejected", "cancelled"],
  verified: ["sent", "rejected", "cancelled"],
  sent: ["partially_paid", "paid", "overdue"],
  partially_paid: ["paid", "overdue"],
  paid: [],
  overdue: ["partially_paid", "paid"],
  rejected: ["draft"],
  cancelled: [],
};

/**
 * Check if a status transition is valid.
 */
export function isValidInvoiceTransition(
  currentStatus: string,
  targetStatus: string,
): boolean {
  const allowed = VALID_INVOICE_TRANSITIONS[currentStatus];
  if (!allowed) return false;
  return allowed.includes(targetStatus);
}

/**
 * Get the list of valid next statuses from the current status.
 */
export function getValidInvoiceTransitions(currentStatus: string): readonly string[] {
  return VALID_INVOICE_TRANSITIONS[currentStatus] ?? [];
}

/**
 * Check if an invoice is immutable (cannot be edited).
 * Once sent, paid, or partially paid, the financial record is locked.
 */
export function isInvoiceImmutable(status: string): boolean {
  const immutableStatuses: readonly string[] = [
    "sent",
    "partially_paid",
    "paid",
    "overdue",
    "cancelled",
  ] satisfies InvoiceStatus[];
  return immutableStatuses.includes(status);
}
