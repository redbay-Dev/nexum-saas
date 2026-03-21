export interface AllocationValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate pricing line allocations:
 * - Percentages must sum to 100%
 * - Amounts must sum to the line total
 * - Each allocation must have a positive percentage and amount
 */
export function validateAllocations(
  allocations: Array<{ amount: number; percentage: number }>,
  lineTotal: number,
): AllocationValidationResult {
  const errors: string[] = [];

  if (allocations.length === 0) {
    return { valid: true, errors: [] };
  }

  const totalPercentage = allocations.reduce((sum, a) => sum + a.percentage, 0);
  const totalAmount = allocations.reduce((sum, a) => sum + a.amount, 0);

  // Check percentage sum (allow 0.01% tolerance for rounding)
  if (Math.abs(totalPercentage - 100) > 0.01) {
    errors.push(`Allocation percentages sum to ${totalPercentage.toFixed(2)}%, must equal 100%`);
  }

  // Check amount sum (allow $0.01 tolerance for rounding)
  if (Math.abs(totalAmount - lineTotal) > 0.01) {
    errors.push(`Allocation amounts sum to $${totalAmount.toFixed(2)}, must equal line total $${lineTotal.toFixed(2)}`);
  }

  // Check individual allocations
  for (let i = 0; i < allocations.length; i++) {
    const alloc = allocations[i];
    if (!alloc) continue;
    if (alloc.percentage <= 0) {
      errors.push(`Allocation ${i + 1} has non-positive percentage`);
    }
    if (alloc.amount <= 0) {
      errors.push(`Allocation ${i + 1} has non-positive amount`);
    }
  }

  return { valid: errors.length === 0, errors };
}
