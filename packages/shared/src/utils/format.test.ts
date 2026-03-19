import { describe, it, expect } from "vitest";
import { formatDateAu, formatCurrencyAud } from "./index.js";

describe("formatDateAu", () => {
  it("should format date as DD/MM/YYYY", () => {
    const date = new Date("2026-03-19T00:00:00Z");
    expect(formatDateAu(date)).toBe("19/03/2026");
  });

  it("should pad single-digit days and months", () => {
    const date = new Date("2026-01-05T00:00:00Z");
    expect(formatDateAu(date)).toBe("05/01/2026");
  });
});

describe("formatCurrencyAud", () => {
  it("should format with $ prefix and 2 decimals", () => {
    expect(formatCurrencyAud(1234.5)).toBe("$1,234.50");
  });

  it("should handle zero", () => {
    expect(formatCurrencyAud(0)).toBe("$0.00");
  });

  it("should handle negative numbers", () => {
    expect(formatCurrencyAud(-99.99)).toBe("$-99.99");
  });
});
