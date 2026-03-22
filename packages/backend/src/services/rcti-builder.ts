/**
 * RCTI builder — builds RCTI line items from cost charges, handles deductions.
 * Pure functions, no database access.
 */

interface CostChargeInput {
  id: string;
  jobId: string;
  daysheetId: string;
  partyId: string | null;
  partyName: string | null;
  category: string;
  description: string | null;
  rateType: string;
  quantity: string;
  unitRate: string;
  total: string;
}

interface JobInfo {
  id: string;
  jobNumber: string | null;
}

interface DaysheetInfo {
  id: string;
  assetId: string | null;
  assetRegistration: string | null;
}

interface RctiLineItemInput {
  chargeId: string | null;
  jobId: string | null;
  daysheetId: string | null;
  lineType: "charge" | "deduction";
  description: string;
  quantity: number;
  unitOfMeasure: string | null;
  unitPrice: number;
  lineTotal: number;
  deductionCategory: string | null;
  deductionDetails: string | null;
  assetRegistration: string | null;
  materialName: string | null;
  sourceJobNumber: string | null;
}

interface RctiTotals {
  subtotal: number;
  deductionsTotal: number;
  total: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function rateTypeToUom(rateType: string): string | null {
  const map: Record<string, string> = {
    per_tonne: "tonne",
    per_cubic_metre: "m³",
    per_hour: "hour",
    per_km: "km",
    per_load: "load",
    flat: "ea",
  };
  return map[rateType] ?? null;
}

/**
 * Build RCTI line items from cost charges.
 */
export function buildRctiLineItems(
  charges: CostChargeInput[],
  jobs: JobInfo[],
  daysheets: DaysheetInfo[],
): RctiLineItemInput[] {
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const daysheetMap = new Map(daysheets.map((d) => [d.id, d]));

  return charges.map((charge) => {
    const job = jobMap.get(charge.jobId);
    const daysheet = daysheetMap.get(charge.daysheetId);
    const quantity = parseFloat(charge.quantity);
    const unitPrice = parseFloat(charge.unitRate);
    const lineTotal = parseFloat(charge.total);

    return {
      chargeId: charge.id,
      jobId: charge.jobId,
      daysheetId: charge.daysheetId,
      lineType: "charge" as const,
      description: charge.description ?? `${charge.category} — ${charge.rateType}`,
      quantity: round2(quantity),
      unitOfMeasure: rateTypeToUom(charge.rateType),
      unitPrice: round2(unitPrice),
      lineTotal: round2(lineTotal),
      deductionCategory: null,
      deductionDetails: null,
      assetRegistration: daysheet?.assetRegistration ?? null,
      materialName: null,
      sourceJobNumber: job?.jobNumber ?? null,
    };
  });
}

/**
 * Calculate RCTI totals from line items.
 */
export function calculateRctiTotals(lineItems: RctiLineItemInput[]): RctiTotals {
  let subtotal = 0;
  let deductionsTotal = 0;

  for (const item of lineItems) {
    if (item.lineType === "deduction") {
      deductionsTotal += Math.abs(item.lineTotal);
    } else {
      subtotal += item.lineTotal;
    }
  }

  return {
    subtotal: round2(subtotal),
    deductionsTotal: round2(deductionsTotal),
    total: round2(subtotal - deductionsTotal),
  };
}
