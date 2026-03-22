import { describe, it, expect } from "vitest";
import { generateNextNumber } from "./invoice-number.js";

describe("generateNextNumber", () => {
  it("should format with prefix and padding", () => {
    const result = generateNextNumber({
      prefix: "INV-",
      suffix: null,
      nextNumber: 1,
      minDigits: 4,
    });
    expect(result.formatted).toBe("INV-0001");
    expect(result.nextValue).toBe(2);
  });

  it("should format with prefix and suffix", () => {
    const result = generateNextNumber({
      prefix: "INV-",
      suffix: "-FTG",
      nextNumber: 42,
      minDigits: 4,
    });
    expect(result.formatted).toBe("INV-0042-FTG");
    expect(result.nextValue).toBe(43);
  });

  it("should handle no prefix or suffix", () => {
    const result = generateNextNumber({
      prefix: null,
      suffix: null,
      nextNumber: 7,
      minDigits: 3,
    });
    expect(result.formatted).toBe("007");
    expect(result.nextValue).toBe(8);
  });

  it("should not pad if number exceeds minDigits", () => {
    const result = generateNextNumber({
      prefix: "RCTI-",
      suffix: null,
      nextNumber: 12345,
      minDigits: 4,
    });
    expect(result.formatted).toBe("RCTI-12345");
    expect(result.nextValue).toBe(12346);
  });

  it("should handle minDigits of 1", () => {
    const result = generateNextNumber({
      prefix: "CN-",
      suffix: null,
      nextNumber: 5,
      minDigits: 1,
    });
    expect(result.formatted).toBe("CN-5");
    expect(result.nextValue).toBe(6);
  });

  it("should handle large numbers", () => {
    const result = generateNextNumber({
      prefix: "INV-",
      suffix: null,
      nextNumber: 999999,
      minDigits: 4,
    });
    expect(result.formatted).toBe("INV-999999");
    expect(result.nextValue).toBe(1000000);
  });
});
