import { describe, it, expect } from "vitest";
import { formatDateAu, formatDateTimeAu, formatCurrencyAud } from "./index.js";

describe("formatDateTimeAu", () => {
  it("should format date and time as DD/MM/YYYY HH:MM", () => {
    const date = new Date("2026-03-19T14:30:00Z");
    const result = formatDateTimeAu(date);
    // Time portion depends on timezone; just check format pattern
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });

  it("should include the date portion from formatDateAu", () => {
    const date = new Date("2026-03-19T08:05:00Z");
    const dateOnly = formatDateAu(date);
    const dateTime = formatDateTimeAu(date);
    expect(dateTime.startsWith(dateOnly)).toBe(true);
  });
});

describe("formatCurrencyAud edge cases", () => {
  it("should format large numbers with commas", () => {
    expect(formatCurrencyAud(1234567.89)).toBe("$1,234,567.89");
  });

  it("should format small decimals correctly", () => {
    expect(formatCurrencyAud(0.01)).toBe("$0.01");
  });

  it("should format whole numbers with .00", () => {
    expect(formatCurrencyAud(100)).toBe("$100.00");
  });
});
