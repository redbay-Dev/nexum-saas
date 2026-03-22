/**
 * Overage detection service (doc 08).
 *
 * Detects three types of overages:
 * 1. Payload overage — net weight exceeds asset's calculated payload capacity
 * 2. Volume overage — volume exceeds asset's maximum volume capacity
 * 3. Contract limit overage — quantity exceeds job's contracted maximum
 *
 * Severity tiers:
 * - minor: within secondary tolerance (auto-approve eligible)
 * - significant: above minor threshold, needs human review
 * - critical: way above limits, needs investigation
 */

import type { OverageType, OverageSeverity } from "@nexum/shared";

interface OverageCheckInput {
  actualValue: number;
  limitValue: number;
  overageType: OverageType;
  /** Percentage tolerance below which overage is "minor" (default 2%) */
  minorThresholdPercent?: number;
  /** Percentage above which overage is "critical" (default 10%) */
  criticalThresholdPercent?: number;
}

export interface DetectedOverage {
  overageType: OverageType;
  severity: OverageSeverity;
  actualValue: number;
  limitValue: number;
  overageAmount: number;
  overagePercent: number;
}

/**
 * Check if a value exceeds a limit and classify the severity.
 * Returns null if no overage.
 */
export function checkOverage(input: OverageCheckInput): DetectedOverage | null {
  if (input.limitValue <= 0 || input.actualValue <= input.limitValue) {
    return null;
  }

  const overageAmount = round4(input.actualValue - input.limitValue);
  const overagePercent = round4((overageAmount / input.limitValue) * 100);

  const minorThreshold = input.minorThresholdPercent ?? 2;
  const criticalThreshold = input.criticalThresholdPercent ?? 10;

  let severity: OverageSeverity;
  if (overagePercent <= minorThreshold) {
    severity = "minor";
  } else if (overagePercent >= criticalThreshold) {
    severity = "critical";
  } else {
    severity = "significant";
  }

  return {
    overageType: input.overageType,
    severity,
    actualValue: input.actualValue,
    limitValue: input.limitValue,
    overageAmount,
    overagePercent,
  };
}

interface PayloadOverageInput {
  netWeight: number;
  /** Asset GVM */
  gvm?: number;
  /** Asset tare weight */
  assetTareWeight?: number;
  minorThresholdPercent?: number;
  criticalThresholdPercent?: number;
}

/**
 * Check payload overage: net weight vs (GVM - tare).
 */
export function checkPayloadOverage(input: PayloadOverageInput): DetectedOverage | null {
  if (!input.gvm || !input.assetTareWeight) return null;

  const payloadCapacity = input.gvm - input.assetTareWeight;
  if (payloadCapacity <= 0) return null;

  return checkOverage({
    actualValue: input.netWeight,
    limitValue: payloadCapacity,
    overageType: "payload",
    minorThresholdPercent: input.minorThresholdPercent,
    criticalThresholdPercent: input.criticalThresholdPercent,
  });
}

interface VolumeOverageInput {
  actualVolume: number;
  /** Asset max volume capacity */
  maxVolume?: number;
  minorThresholdPercent?: number;
  criticalThresholdPercent?: number;
}

/**
 * Check volume overage: actual volume vs asset max volume.
 */
export function checkVolumeOverage(input: VolumeOverageInput): DetectedOverage | null {
  if (!input.maxVolume || input.maxVolume <= 0) return null;

  return checkOverage({
    actualValue: input.actualVolume,
    limitValue: input.maxVolume,
    overageType: "volume",
    minorThresholdPercent: input.minorThresholdPercent,
    criticalThresholdPercent: input.criticalThresholdPercent,
  });
}

interface ContractOverageInput {
  actualQuantity: number;
  /** Job's contracted max quantity */
  contractLimit?: number;
  minorThresholdPercent?: number;
  criticalThresholdPercent?: number;
}

/**
 * Check contract limit overage: actual quantity vs job's max payload.
 */
export function checkContractOverage(input: ContractOverageInput): DetectedOverage | null {
  if (!input.contractLimit || input.contractLimit <= 0) return null;

  return checkOverage({
    actualValue: input.actualQuantity,
    limitValue: input.contractLimit,
    overageType: "contract_limit",
    minorThresholdPercent: input.minorThresholdPercent,
    criticalThresholdPercent: input.criticalThresholdPercent,
  });
}

/**
 * Run all overage checks for a daysheet load against asset and job limits.
 */
export function detectAllOverages(input: {
  netWeight: number;
  quantity: number;
  volume?: number;
  assetGvm?: number;
  assetTareWeight?: number;
  assetMaxVolume?: number;
  contractLimit?: number;
  minorThresholdPercent?: number;
  criticalThresholdPercent?: number;
}): DetectedOverage[] {
  const overages: DetectedOverage[] = [];

  const payload = checkPayloadOverage({
    netWeight: input.netWeight,
    gvm: input.assetGvm,
    assetTareWeight: input.assetTareWeight,
    minorThresholdPercent: input.minorThresholdPercent,
    criticalThresholdPercent: input.criticalThresholdPercent,
  });
  if (payload) overages.push(payload);

  const volume = checkVolumeOverage({
    actualVolume: input.volume ?? 0,
    maxVolume: input.assetMaxVolume,
    minorThresholdPercent: input.minorThresholdPercent,
    criticalThresholdPercent: input.criticalThresholdPercent,
  });
  if (volume) overages.push(volume);

  const contract = checkContractOverage({
    actualQuantity: input.quantity,
    contractLimit: input.contractLimit,
    minorThresholdPercent: input.minorThresholdPercent,
    criticalThresholdPercent: input.criticalThresholdPercent,
  });
  if (contract) overages.push(contract);

  return overages;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
