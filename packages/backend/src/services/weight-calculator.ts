/**
 * Weight calculation service for tonnage work (doc 08).
 *
 * Handles:
 * - Net weight = gross - tare (auto-calculated)
 * - Payable weight = lesser of net weight and contract limit
 * - Overage detection for payload and contract limits
 */

interface WeightInput {
  grossWeight: number;
  tareWeight: number;
}

interface WeightResult {
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
}

interface PayableWeightInput {
  netWeight: number;
  contractLimit?: number;
}

interface PayableWeightResult {
  payableWeight: number;
  isCapped: boolean;
  overageAmount: number;
}

interface PayloadCheckInput {
  netWeight: number;
  /** Asset GVM minus tare = max payload capacity */
  payloadCapacity: number;
}

interface PayloadCheckResult {
  isOverloaded: boolean;
  overageAmount: number;
  overagePercent: number;
}

/**
 * Calculate net weight from gross and tare.
 */
export function calculateNetWeight(input: WeightInput): WeightResult {
  const netWeight = Math.max(0, input.grossWeight - input.tareWeight);
  return {
    grossWeight: input.grossWeight,
    tareWeight: input.tareWeight,
    netWeight: round4(netWeight),
  };
}

/**
 * Calculate payable weight, applying contract limit cap if applicable.
 */
export function calculatePayableWeight(input: PayableWeightInput): PayableWeightResult {
  if (input.contractLimit === undefined || input.contractLimit <= 0) {
    return {
      payableWeight: input.netWeight,
      isCapped: false,
      overageAmount: 0,
    };
  }

  const isCapped = input.netWeight > input.contractLimit;
  return {
    payableWeight: isCapped ? input.contractLimit : input.netWeight,
    isCapped,
    overageAmount: isCapped ? round4(input.netWeight - input.contractLimit) : 0,
  };
}

/**
 * Check if net weight exceeds the asset's payload capacity.
 * Payload capacity = GVM - tare weight of the vehicle.
 */
export function checkPayloadOverage(input: PayloadCheckInput): PayloadCheckResult {
  if (input.payloadCapacity <= 0) {
    return { isOverloaded: false, overageAmount: 0, overagePercent: 0 };
  }

  const isOverloaded = input.netWeight > input.payloadCapacity;
  const overageAmount = isOverloaded ? round4(input.netWeight - input.payloadCapacity) : 0;
  const overagePercent = isOverloaded
    ? round4((overageAmount / input.payloadCapacity) * 100)
    : 0;

  return { isOverloaded, overageAmount, overagePercent };
}

/**
 * Aggregate weights from multiple loads into daysheet totals.
 */
export function aggregateLoadWeights(
  loads: Array<{ grossWeight?: number; tareWeight?: number; netWeight?: number; quantity?: number }>,
): { totalGross: number; totalTare: number; totalNet: number; totalQuantity: number; loadCount: number } {
  let totalGross = 0;
  let totalTare = 0;
  let totalNet = 0;
  let totalQuantity = 0;

  for (const load of loads) {
    totalGross += load.grossWeight ?? 0;
    totalTare += load.tareWeight ?? 0;
    totalNet += load.netWeight ?? 0;
    totalQuantity += load.quantity ?? 0;
  }

  return {
    totalGross: round4(totalGross),
    totalTare: round4(totalTare),
    totalNet: round4(totalNet),
    totalQuantity: round4(totalQuantity),
    loadCount: loads.length,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
