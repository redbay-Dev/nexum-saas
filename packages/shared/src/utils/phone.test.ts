import { describe, it, expect } from "vitest";
import { formatPhoneDisplay, toE164 } from "./index.js";

describe("formatPhoneDisplay", () => {
  it("should format mobile numbers", () => {
    expect(formatPhoneDisplay("+61412345678")).toBe("0412 345 678");
  });

  it("should format landline numbers", () => {
    expect(formatPhoneDisplay("+61732101234")).toBe("(07) 3210 1234");
  });

  it("should return original if unrecognised format", () => {
    expect(formatPhoneDisplay("12345")).toBe("12345");
  });
});

describe("toE164", () => {
  it("should convert local mobile to E.164", () => {
    expect(toE164("0412 345 678")).toBe("+61412345678");
  });

  it("should pass through E.164 numbers", () => {
    expect(toE164("+61412345678")).toBe("+61412345678");
  });
});
