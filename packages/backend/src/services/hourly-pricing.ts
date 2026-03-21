export interface HourlyChargeResult {
  chargeableHours: number;
  baseCharge: number;
  overtimeCharge: number;
  totalCharge: number;
  minimumApplied: boolean;
  overtimeApplied: boolean;
}

/**
 * Calculate hourly charge with minimum hours and overtime support.
 *
 * Per doc 09:
 * - If actual < minimum, charge minimum
 * - If actual > overtime threshold, apply overtime rate to hours beyond threshold
 */
export function calculateHourlyCharge(
  actualHours: number,
  hourlyRate: number,
  minimumChargeHours: number = 0,
  overtimeRate?: number,
  overtimeThresholdHours?: number,
): HourlyChargeResult {
  let chargeableHours = actualHours;
  let minimumApplied = false;
  let overtimeApplied = false;
  let baseCharge: number;
  let overtimeCharge = 0;

  // Minimum hours enforcement
  if (minimumChargeHours > 0 && actualHours < minimumChargeHours) {
    chargeableHours = minimumChargeHours;
    minimumApplied = true;
  }

  // Overtime calculation
  if (overtimeRate && overtimeThresholdHours && actualHours > overtimeThresholdHours) {
    const regularHours = Math.max(overtimeThresholdHours, minimumChargeHours);
    const overtimeHours = actualHours - overtimeThresholdHours;

    baseCharge = Math.round(regularHours * hourlyRate * 100) / 100;
    overtimeCharge = Math.round(overtimeHours * overtimeRate * 100) / 100;
    chargeableHours = regularHours + overtimeHours;
    overtimeApplied = true;
  } else {
    baseCharge = Math.round(chargeableHours * hourlyRate * 100) / 100;
  }

  return {
    chargeableHours,
    baseCharge,
    overtimeCharge,
    totalCharge: Math.round((baseCharge + overtimeCharge) * 100) / 100,
    minimumApplied,
    overtimeApplied,
  };
}
