/**
 * Credit manager — credit limit tracking and availability checks.
 * Pure functions, no database access.
 */

interface CreditTransaction {
  transactionType: string;
  amount: string;
}

interface CreditCheckResult {
  creditLimit: number | null;
  creditUsed: number;
  creditAvailable: number | null;
  wouldExceed: boolean;
  utilizationPercent: number | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calculate total credit used from transaction history.
 * Positive transactions (invoice_created, manual_adjustment) increase usage.
 * Negative transactions (payment_received, job_completed, job_cancelled) decrease usage.
 */
export function calculateCreditUsed(transactions: CreditTransaction[]): number {
  let used = 0;
  for (const tx of transactions) {
    const amount = parseFloat(tx.amount);
    switch (tx.transactionType) {
      case "invoice_created":
        used += amount;
        break;
      case "payment_received":
        used -= amount;
        break;
      case "job_completed":
      case "job_cancelled":
        used -= amount;
        break;
      case "manual_adjustment":
        used += amount; // Can be positive or negative
        break;
    }
  }
  return round2(Math.max(0, used));
}

/**
 * Check credit availability for a proposed additional amount.
 */
export function checkCreditAvailability(
  creditLimit: number | null,
  creditUsed: number,
  additionalAmount: number,
): CreditCheckResult {
  if (creditLimit === null) {
    // No credit limit set — unlimited
    return {
      creditLimit: null,
      creditUsed: round2(creditUsed),
      creditAvailable: null,
      wouldExceed: false,
      utilizationPercent: null,
    };
  }

  const newUsed = creditUsed + additionalAmount;
  const available = round2(Math.max(0, creditLimit - creditUsed));
  const wouldExceed = newUsed > creditLimit;
  const utilizationPercent = creditLimit > 0 ? round2((creditUsed / creditLimit) * 100) : 0;

  return {
    creditLimit: round2(creditLimit),
    creditUsed: round2(creditUsed),
    creditAvailable: available,
    wouldExceed,
    utilizationPercent,
  };
}
