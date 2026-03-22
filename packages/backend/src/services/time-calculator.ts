/**
 * Time calculation service for hourly work (doc 08).
 *
 * Handles:
 * - Hours worked from start/end times
 * - Overtime calculation (beyond configurable threshold)
 * - Break deductions
 * - Total billable hours
 */

interface TimeInput {
  /** HH:MM format */
  startTime: string;
  /** HH:MM format */
  endTime: string;
  /** Minutes of break to deduct */
  breakMinutes?: number;
  /** Hours after which overtime kicks in */
  overtimeThresholdHours?: number;
}

interface TimeResult {
  hoursWorked: number;
  overtimeHours: number;
  breakHours: number;
  totalBillableHours: number;
  standardHours: number;
}

/**
 * Parse HH:MM time string to decimal hours from midnight.
 */
export function parseTimeToHours(time: string): number {
  const parts = time.split(":");
  if (parts.length !== 2) return 0;
  const hours = parseInt(parts[0] ?? "0", 10);
  const minutes = parseInt(parts[1] ?? "0", 10);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours + minutes / 60;
}

/**
 * Calculate hours worked, overtime, and billable hours from time inputs.
 */
export function calculateTimeWorked(input: TimeInput): TimeResult {
  const startHours = parseTimeToHours(input.startTime);
  const endHours = parseTimeToHours(input.endTime);

  // Handle overnight shifts (end < start)
  let rawHours = endHours >= startHours
    ? endHours - startHours
    : (24 - startHours) + endHours;

  rawHours = round2(rawHours);

  const breakHours = round2((input.breakMinutes ?? 0) / 60);
  const hoursWorked = round2(Math.max(0, rawHours - breakHours));

  const threshold = input.overtimeThresholdHours ?? 0;
  let overtimeHours = 0;
  let standardHours = hoursWorked;

  if (threshold > 0 && hoursWorked > threshold) {
    overtimeHours = round2(hoursWorked - threshold);
    standardHours = threshold;
  }

  // Total billable = standard + overtime (overtime counts as worked)
  const totalBillableHours = hoursWorked;

  return {
    hoursWorked,
    overtimeHours,
    breakHours,
    totalBillableHours,
    standardHours,
  };
}

/**
 * Aggregate time entries from multiple sessions into day totals.
 */
export function aggregateTimeSessions(
  sessions: TimeResult[],
): { totalHoursWorked: number; totalOvertimeHours: number; totalBreakHours: number; totalBillableHours: number } {
  let totalHoursWorked = 0;
  let totalOvertimeHours = 0;
  let totalBreakHours = 0;
  let totalBillableHours = 0;

  for (const session of sessions) {
    totalHoursWorked += session.hoursWorked;
    totalOvertimeHours += session.overtimeHours;
    totalBreakHours += session.breakHours;
    totalBillableHours += session.totalBillableHours;
  }

  return {
    totalHoursWorked: round2(totalHoursWorked),
    totalOvertimeHours: round2(totalOvertimeHours),
    totalBreakHours: round2(totalBreakHours),
    totalBillableHours: round2(totalBillableHours),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
