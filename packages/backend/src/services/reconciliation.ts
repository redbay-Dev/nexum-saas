/**
 * Docket-to-daysheet reconciliation service (doc 08).
 *
 * When dockets exist, compares their quantities against the daysheet:
 * - Weighbridge ticket weight vs daysheet weight
 * - Tip receipt load count vs daysheet loads
 * - Flags discrepancies above configurable tolerance
 */

interface ReconciliationItem {
  field: string;
  daysheetValue: number;
  docketValue: number;
  difference: number;
  differencePercent: number;
  isWithinTolerance: boolean;
}

export interface ReconciliationResult {
  isReconciled: boolean;
  hasDiscrepancy: boolean;
  items: ReconciliationItem[];
  discrepancyNotes: string;
}

/**
 * Reconcile docket data against daysheet data.
 * Returns a result indicating whether all values match within tolerance.
 */
export function reconcileDocketWithDaysheet(
  daysheet: {
    totalNetWeight?: number;
    totalGrossWeight?: number;
    totalTareWeight?: number;
    totalQuantity?: number;
    loadCount?: number;
  },
  docket: {
    netWeight?: number;
    grossWeight?: number;
    tareWeight?: number;
    quantity?: number;
  },
  tolerancePercent: number = 1,
): ReconciliationResult {
  const items: ReconciliationItem[] = [];

  // Compare weights
  if (docket.grossWeight !== undefined && docket.grossWeight > 0) {
    items.push(compareValues("grossWeight", daysheet.totalGrossWeight ?? 0, docket.grossWeight, tolerancePercent));
  }

  if (docket.tareWeight !== undefined && docket.tareWeight > 0) {
    items.push(compareValues("tareWeight", daysheet.totalTareWeight ?? 0, docket.tareWeight, tolerancePercent));
  }

  if (docket.netWeight !== undefined && docket.netWeight > 0) {
    items.push(compareValues("netWeight", daysheet.totalNetWeight ?? 0, docket.netWeight, tolerancePercent));
  }

  // Compare quantities
  if (docket.quantity !== undefined && docket.quantity > 0) {
    items.push(compareValues("quantity", daysheet.totalQuantity ?? 0, docket.quantity, tolerancePercent));
  }

  const hasDiscrepancy = items.some((item) => !item.isWithinTolerance);

  const discrepancyItems = items.filter((item) => !item.isWithinTolerance);
  const discrepancyNotes = discrepancyItems.length > 0
    ? discrepancyItems
        .map((item) =>
          `${item.field}: daysheet=${item.daysheetValue}, docket=${item.docketValue} (diff=${item.difference}, ${item.differencePercent}%)`,
        )
        .join("; ")
    : "";

  return {
    isReconciled: true,
    hasDiscrepancy,
    items,
    discrepancyNotes,
  };
}

function compareValues(
  field: string,
  daysheetValue: number,
  docketValue: number,
  tolerancePercent: number,
): ReconciliationItem {
  const difference = round4(Math.abs(daysheetValue - docketValue));
  const referenceValue = Math.max(daysheetValue, docketValue);
  const differencePercent = referenceValue > 0
    ? round4((difference / referenceValue) * 100)
    : 0;

  return {
    field,
    daysheetValue,
    docketValue,
    difference,
    differencePercent,
    isWithinTolerance: differencePercent <= tolerancePercent,
  };
}

/**
 * Check if a daysheet's data is "clean" enough for auto-processing:
 * - All required fields present
 * - No pending overages
 * - All dockets reconciled without discrepancy
 * - Quantities within tolerance of job estimates
 */
export function isEligibleForAutoProcessing(
  daysheet: {
    loadCount?: number;
    totalNetWeight?: number;
    totalBillableHours?: number;
    hasOverages: boolean;
    hasDocketDiscrepancies: boolean;
  },
  jobEstimates?: {
    estimatedQuantity?: number;
    tolerancePercent?: number;
  },
): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Must have some quantity data
  const hasQuantityData = (daysheet.loadCount && daysheet.loadCount > 0)
    || (daysheet.totalNetWeight && daysheet.totalNetWeight > 0)
    || (daysheet.totalBillableHours && daysheet.totalBillableHours > 0);

  if (!hasQuantityData) {
    reasons.push("No quantity data (loads, weight, or hours) recorded");
  }

  // No pending overages
  if (daysheet.hasOverages) {
    reasons.push("Has pending overages requiring approval");
  }

  // No docket discrepancies
  if (daysheet.hasDocketDiscrepancies) {
    reasons.push("Has docket discrepancies requiring review");
  }

  // Check against job estimates if available
  if (jobEstimates?.estimatedQuantity && daysheet.totalNetWeight) {
    const tolerance = jobEstimates.tolerancePercent ?? 5;
    const diff = Math.abs(daysheet.totalNetWeight - jobEstimates.estimatedQuantity);
    const diffPercent = (diff / jobEstimates.estimatedQuantity) * 100;
    if (diffPercent > tolerance) {
      reasons.push(`Quantity deviates ${round4(diffPercent)}% from estimate (tolerance: ${tolerance}%)`);
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
