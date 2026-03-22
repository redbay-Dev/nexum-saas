/**
 * Charge creation service (doc 08).
 *
 * When a daysheet is processed, creates charge lines from the job's pricing lines
 * using the daysheet's actual quantities.
 *
 * - Revenue lines: what the customer pays
 * - Cost lines: what the tenant pays out (subcontractor rates, material costs)
 * - Links each charge to its source pricing line for traceability
 * - Skips contractor cost lines for customer-supplied assets
 */

interface PricingLineInput {
  id: string;
  lineType: string;
  partyId: string | null;
  partyName: string | null;
  category: string;
  description: string | null;
  rateType: string;
  quantity: string;
  unitRate: string;
  total: string;
  isLocked: boolean;
}

interface DaysheetQuantities {
  /** Total net weight (tonnes) */
  totalNetWeight: number;
  /** Total quantity (cubic metres or loads) */
  totalQuantity: number;
  /** Total billable hours */
  totalBillableHours: number;
  /** Load count */
  loadCount: number;
  /** Overtime hours */
  overtimeHours: number;
}

export interface GeneratedCharge {
  pricingLineId: string;
  lineType: string;
  partyId: string | null;
  partyName: string | null;
  category: string;
  description: string | null;
  rateType: string;
  quantity: number;
  unitRate: number;
  total: number;
}

/**
 * Generate charge lines from a job's pricing lines using daysheet actual quantities.
 *
 * The quantity used depends on the rate type:
 * - per_tonne: totalNetWeight
 * - per_cubic_metre: totalQuantity
 * - per_load: loadCount
 * - per_hour: totalBillableHours
 * - per_km: use planned quantity (distance not on daysheet)
 * - flat: quantity = 1
 */
export function generateChargesFromPricingLines(
  pricingLines: PricingLineInput[],
  daysheetQuantities: DaysheetQuantities,
  options?: {
    /** If true, skip cost lines for contractor-owned assets */
    isCustomerSuppliedAsset?: boolean;
  },
): GeneratedCharge[] {
  const charges: GeneratedCharge[] = [];

  for (const line of pricingLines) {
    // Skip contractor cost lines for customer-supplied assets
    if (
      options?.isCustomerSuppliedAsset &&
      line.lineType === "cost" &&
      line.category === "subcontractor"
    ) {
      continue;
    }

    const unitRate = parseFloat(line.unitRate) || 0;
    const quantity = resolveQuantity(line.rateType, daysheetQuantities, line.quantity);
    const total = round2(quantity * unitRate);

    charges.push({
      pricingLineId: line.id,
      lineType: line.lineType,
      partyId: line.partyId,
      partyName: line.partyName,
      category: line.category,
      description: line.description,
      rateType: line.rateType,
      quantity,
      unitRate,
      total,
    });
  }

  return charges;
}

/**
 * Resolve the actual quantity for a charge based on rate type.
 */
function resolveQuantity(
  rateType: string,
  daysheetQuantities: DaysheetQuantities,
  plannedQuantity: string,
): number {
  switch (rateType) {
    case "per_tonne":
      return daysheetQuantities.totalNetWeight;
    case "per_cubic_metre":
      return daysheetQuantities.totalQuantity;
    case "per_load":
      return daysheetQuantities.loadCount;
    case "per_hour":
      return daysheetQuantities.totalBillableHours;
    case "per_km":
      // Distance not captured on daysheet — use planned quantity
      return parseFloat(plannedQuantity) || 0;
    case "flat":
      return 1;
    default:
      return parseFloat(plannedQuantity) || 0;
  }
}

/**
 * Calculate financial summary from generated charges.
 */
export function summariseCharges(
  charges: GeneratedCharge[],
): { totalRevenue: number; totalCost: number; grossProfit: number; marginPercent: number | null } {
  let totalRevenue = 0;
  let totalCost = 0;

  for (const charge of charges) {
    if (charge.lineType === "revenue") {
      totalRevenue += charge.total;
    } else {
      totalCost += charge.total;
    }
  }

  totalRevenue = round2(totalRevenue);
  totalCost = round2(totalCost);
  const grossProfit = round2(totalRevenue - totalCost);
  const marginPercent = totalRevenue > 0
    ? round2((grossProfit / totalRevenue) * 100)
    : null;

  return { totalRevenue, totalCost, grossProfit, marginPercent };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
