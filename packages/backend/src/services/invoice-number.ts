/**
 * Invoice number generator — formats sequential numbers with configurable prefix/suffix/padding.
 * Pure function, no database access.
 */

interface SequenceConfig {
  prefix: string | null;
  suffix: string | null;
  nextNumber: number;
  minDigits: number;
}

interface GeneratedNumber {
  formatted: string;
  nextValue: number;
}

/**
 * Generate the next formatted number from a sequence configuration.
 *
 * @example
 * generateNextNumber({ prefix: "INV-", suffix: null, nextNumber: 42, minDigits: 4 })
 * // => { formatted: "INV-0042", nextValue: 43 }
 */
export function generateNextNumber(config: SequenceConfig): GeneratedNumber {
  const padded = String(config.nextNumber).padStart(config.minDigits, "0");
  const prefix = config.prefix ?? "";
  const suffix = config.suffix ?? "";
  return {
    formatted: `${prefix}${padded}${suffix}`,
    nextValue: config.nextNumber + 1,
  };
}
