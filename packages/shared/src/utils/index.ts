/**
 * Validate an Australian Business Number (ABN) using the official check digit algorithm.
 * @see https://abr.business.gov.au/Help/AbnFormat
 */
export function validateAbn(abn: string): boolean {
  const cleaned = abn.replace(/\s/g, "");
  if (!/^\d{11}$/.test(cleaned)) return false;

  const weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
  const digits = cleaned.split("").map(Number);

  // Subtract 1 from the first digit
  digits[0] = (digits[0] ?? 0) - 1;

  const sum = digits.reduce((acc, digit, i) => {
    const weight = weights[i];
    if (weight === undefined) return acc;
    return acc + digit * weight;
  }, 0);

  return sum % 89 === 0;
}

/**
 * Format an ABN for display: XX XXX XXX XXX
 */
export function formatAbn(abn: string): string {
  const cleaned = abn.replace(/\s/g, "");
  if (cleaned.length !== 11) return abn;
  return `${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8, 11)}`;
}

/**
 * Format an Australian phone number for display.
 * E.164 input (+61412345678) → display (0412 345 678)
 */
export function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/\s/g, "");

  // Mobile: +614XXXXXXXX → 04XX XXX XXX
  if (/^\+614\d{8}$/.test(cleaned)) {
    const local = `0${cleaned.slice(3)}`;
    return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
  }

  // Landline: +61XXXXXXXXX → (0X) XXXX XXXX
  if (/^\+61[2-9]\d{8}$/.test(cleaned)) {
    const local = `0${cleaned.slice(3)}`;
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)} ${local.slice(6)}`;
  }

  return phone;
}

/**
 * Convert an Australian phone number to E.164 format.
 * Input: 0412 345 678 → +61412345678
 */
export function toE164(phone: string): string {
  const cleaned = phone.replace(/[\s()-]/g, "");

  if (cleaned.startsWith("+61")) return cleaned;
  if (cleaned.startsWith("0")) return `+61${cleaned.slice(1)}`;

  return cleaned;
}

/**
 * Format a date as DD/MM/YYYY for Australian display.
 */
export function formatDateAu(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Format a date as DD/MM/YYYY HH:MM for Australian display.
 */
export function formatDateTimeAu(date: Date): string {
  const dateStr = formatDateAu(date);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${dateStr} ${hours}:${minutes}`;
}

/**
 * Format currency as AUD with $ prefix and 2 decimal places.
 */
export function formatCurrencyAud(amount: number): string {
  return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

/**
 * Generate a UUID v4.
 */
export function generateId(): string {
  return crypto.randomUUID();
}
