import { describe, it, expect } from "vitest";
import { validateAbn, formatAbn } from "./index.js";

describe("validateAbn", () => {
  it("should validate a correct ABN", () => {
    // Australian Taxation Office ABN
    expect(validateAbn("51824753556")).toBe(true);
  });

  it("should reject an invalid ABN", () => {
    expect(validateAbn("12345678901")).toBe(false);
  });

  it("should reject non-numeric strings", () => {
    expect(validateAbn("abcdefghijk")).toBe(false);
  });

  it("should reject wrong length", () => {
    expect(validateAbn("1234567890")).toBe(false);
    expect(validateAbn("123456789012")).toBe(false);
  });

  it("should handle ABN with spaces", () => {
    expect(validateAbn("51 824 753 556")).toBe(true);
  });
});

describe("formatAbn", () => {
  it("should format ABN as XX XXX XXX XXX", () => {
    expect(formatAbn("51824753556")).toBe("51 824 753 556");
  });

  it("should return original if wrong length", () => {
    expect(formatAbn("12345")).toBe("12345");
  });
});
