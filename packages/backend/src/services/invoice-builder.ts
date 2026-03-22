/**
 * Invoice builder — groups charges, builds line items, calculates totals.
 * Pure functions, no database access.
 */

interface ChargeInput {
  id: string;
  jobId: string;
  partyId: string | null;
  partyName: string | null;
  category: string;
  description: string | null;
  rateType: string;
  quantity: string;
  unitRate: string;
  total: string;
  lineType: string;
  daysheetId: string;
}

interface JobInfo {
  id: string;
  jobNumber: string | null;
  poNumber: string | null;
  projectId: string | null;
  customerId: string | null;
}

interface InvoiceLineItemInput {
  chargeId: string;
  jobId: string;
  description: string;
  quantity: number;
  unitOfMeasure: string | null;
  unitPrice: number;
  lineTotal: number;
  calculationMethod: string;
  sourceJobNumber: string | null;
  pricingSnapshot: Record<string, unknown>;
}

interface InvoiceTotals {
  subtotal: number;
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

function buildCalcMethod(quantity: number, unitRate: number, total: number, rateType: string): string {
  const uom = rateTypeToUom(rateType) ?? "unit";
  if (rateType === "flat") {
    return `Flat rate $${unitRate.toFixed(2)}`;
  }
  return `${quantity} ${uom} @ $${unitRate.toFixed(2)}/${uom} = $${total.toFixed(2)}`;
}

/**
 * Group charges by invoicing mode.
 * Returns a map of group key → charge array.
 */
export function groupChargesForInvoicing(
  charges: ChargeInput[],
  jobs: JobInfo[],
  groupingMode: string,
): Map<string, ChargeInput[]> {
  const jobMap = new Map(jobs.map((j) => [j.id, j]));
  const groups = new Map<string, ChargeInput[]>();

  for (const charge of charges) {
    const job = jobMap.get(charge.jobId);
    let key: string;

    switch (groupingMode) {
      case "per_po":
        key = job?.poNumber ?? charge.jobId;
        break;
      case "per_project":
        key = job?.projectId ?? charge.jobId;
        break;
      case "per_site":
        // Group by job since site info is on the job
        key = charge.jobId;
        break;
      case "combine_all":
        key = "all";
        break;
      case "per_job":
      default:
        key = charge.jobId;
        break;
    }

    const existing = groups.get(key);
    if (existing) {
      existing.push(charge);
    } else {
      groups.set(key, [charge]);
    }
  }

  return groups;
}

/**
 * Build invoice line items from charges.
 */
export function buildInvoiceLineItems(
  charges: ChargeInput[],
  jobs: JobInfo[],
): InvoiceLineItemInput[] {
  const jobMap = new Map(jobs.map((j) => [j.id, j]));

  return charges.map((charge) => {
    const job = jobMap.get(charge.jobId);
    const quantity = parseFloat(charge.quantity);
    const unitPrice = parseFloat(charge.unitRate);
    const lineTotal = parseFloat(charge.total);

    return {
      chargeId: charge.id,
      jobId: charge.jobId,
      description: charge.description ?? `${charge.category} — ${charge.rateType}`,
      quantity: round2(quantity),
      unitOfMeasure: rateTypeToUom(charge.rateType),
      unitPrice: round2(unitPrice),
      lineTotal: round2(lineTotal),
      calculationMethod: buildCalcMethod(quantity, unitPrice, lineTotal, charge.rateType),
      sourceJobNumber: job?.jobNumber ?? null,
      pricingSnapshot: {
        chargeId: charge.id,
        category: charge.category,
        rateType: charge.rateType,
        originalQuantity: charge.quantity,
        originalUnitRate: charge.unitRate,
        originalTotal: charge.total,
        snapshotAt: new Date().toISOString(),
      },
    };
  });
}

/**
 * Calculate invoice totals from line items.
 * Note: GST is handled in Xero, not Nexum.
 */
export function calculateInvoiceTotals(lineItems: InvoiceLineItemInput[]): InvoiceTotals {
  const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  return {
    subtotal: round2(subtotal),
    total: round2(subtotal), // No tax in Nexum — handled by Xero
  };
}

/**
 * Split charges by customer (partyId) for multi-customer jobs.
 */
export function splitChargesByCustomer(
  charges: ChargeInput[],
): Map<string, ChargeInput[]> {
  const groups = new Map<string, ChargeInput[]>();

  for (const charge of charges) {
    const key = charge.partyId ?? "unassigned";
    const existing = groups.get(key);
    if (existing) {
      existing.push(charge);
    } else {
      groups.set(key, [charge]);
    }
  }

  return groups;
}
