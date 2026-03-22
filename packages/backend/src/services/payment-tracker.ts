/**
 * Payment tracker — status determination and outstanding calculation.
 * Pure functions, no database access.
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Determine the status after a payment is recorded.
 */
export function determineStatusAfterPayment(
  total: number,
  amountPaid: number,
): "paid" | "partially_paid" {
  return amountPaid >= total ? "paid" : "partially_paid";
}

/**
 * Calculate the outstanding amount.
 */
export function calculateOutstanding(
  total: number,
  amountPaid: number,
): number {
  return round2(Math.max(0, total - amountPaid));
}
