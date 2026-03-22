/**
 * RCTI period calculation — computes period boundaries for weekly/bi-monthly/monthly frequencies.
 * Pure functions, no database access.
 */

interface PeriodBounds {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

interface BiMonthlyConfig {
  paymentDay1: number; // e.g. 15
  paymentDay2: number; // e.g. 28 (or last day of month)
}

/**
 * Calculate the period boundaries for a given date and frequency.
 */
export function calculatePeriodBounds(
  frequency: string,
  referenceDate: string,
  biMonthlyConfig?: BiMonthlyConfig,
): PeriodBounds {
  const date = new Date(referenceDate);

  switch (frequency) {
    case "weekly":
      return calculateWeeklyPeriod(date);
    case "bi_monthly":
      return calculateBiMonthlyPeriod(date, biMonthlyConfig);
    case "monthly":
      return calculateMonthlyPeriod(date);
    default:
      return calculateWeeklyPeriod(date);
  }
}

function calculateWeeklyPeriod(date: Date): PeriodBounds {
  // Week runs Monday to Sunday
  const dayOfWeek = date.getUTCDay(); // 0=Sun, 1=Mon, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return {
    start: formatDate(monday),
    end: formatDate(sunday),
  };
}

function calculateBiMonthlyPeriod(
  date: Date,
  config?: BiMonthlyConfig,
): PeriodBounds {
  const day1 = config?.paymentDay1 ?? 15;
  const day2 = config?.paymentDay2 ?? 28;
  const dayOfMonth = date.getUTCDate();
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  if (dayOfMonth <= day1) {
    // First half: 1st to day1
    return {
      start: formatDate(new Date(Date.UTC(year, month, 1))),
      end: formatDate(new Date(Date.UTC(year, month, day1))),
    };
  } else {
    // Second half: day1+1 to day2 (or end of month)
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const endDay = Math.min(day2, lastDay);
    return {
      start: formatDate(new Date(Date.UTC(year, month, day1 + 1))),
      end: formatDate(new Date(Date.UTC(year, month, endDay))),
    };
  }
}

function calculateMonthlyPeriod(date: Date): PeriodBounds {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return {
    start: formatDate(new Date(Date.UTC(year, month, 1))),
    end: formatDate(new Date(Date.UTC(year, month, lastDay))),
  };
}

/**
 * Check if a period has closed (current time is after the period end + cutoff time).
 */
export function isPeriodClosed(
  periodEnd: string,
  cutoffTime: string,
): boolean {
  const [hours, minutes] = cutoffTime.split(":").map(Number);
  const endDate = new Date(periodEnd);
  endDate.setUTCHours(hours ?? 17, minutes ?? 0, 0, 0);

  return new Date() > endDate;
}

/**
 * Calculate the payment due date from the period end.
 */
export function calculateDueDate(
  periodEnd: string,
  paymentTermsDays: number,
): string {
  const date = new Date(periodEnd);
  date.setUTCDate(date.getUTCDate() + paymentTermsDays);
  return formatDate(date);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
