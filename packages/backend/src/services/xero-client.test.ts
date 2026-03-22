import { describe, it, expect } from "vitest";
import {
  encryptToken,
  decryptToken,
  validateWebhookSignature,
} from "./xero-client.js";
import { createHmac, randomBytes } from "node:crypto";

describe("encryptToken / decryptToken", () => {
  it("should roundtrip a simple string", () => {
    const original = "my-access-token-12345";
    const encrypted = encryptToken(original);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(original);
  });

  it("should roundtrip a long token", () => {
    const original = "a".repeat(500);
    const encrypted = encryptToken(original);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(original);
  });

  it("should produce different ciphertext for different inputs", () => {
    const encrypted1 = encryptToken("token-alpha");
    const encrypted2 = encryptToken("token-beta");
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("should produce different ciphertext for same input (random IV)", () => {
    const encrypted1 = encryptToken("same-token");
    const encrypted2 = encryptToken("same-token");
    expect(encrypted1).not.toBe(encrypted2);
  });

  it("should produce output in iv:authTag:ciphertext format", () => {
    const encrypted = encryptToken("test");
    const parts = encrypted.split(":");
    expect(parts).toHaveLength(3);
    // IV is 16 bytes = 32 hex chars
    expect(parts[0]).toHaveLength(32);
    // Auth tag is 16 bytes = 32 hex chars
    expect(parts[1]).toHaveLength(32);
    // Ciphertext is non-empty
    expect(parts[2]!.length).toBeGreaterThan(0);
  });

  it("should throw on invalid encrypted format", () => {
    expect(() => decryptToken("not-valid-format")).toThrow("Invalid encrypted token format");
  });

  it("should roundtrip special characters and unicode", () => {
    const original = '{"refresh_token":"abc/def+ghi=","scope":"openid"}';
    const encrypted = encryptToken(original);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(original);
  });
});

describe("validateWebhookSignature", () => {
  function generateTestKey(): string {
    return randomBytes(32).toString("hex");
  }

  function computeSignature(payload: string, key: string): string {
    return createHmac("sha256", key).update(payload).digest("base64");
  }

  it("should return true for a valid signature", () => {
    const key = generateTestKey();
    const payload = '{"events":[{"resourceId":"abc"}]}';
    const validSignature = computeSignature(payload, key);

    expect(validateWebhookSignature(payload, validSignature, key)).toBe(true);
  });

  it("should return false for an invalid signature", () => {
    const key = generateTestKey();
    const payload = '{"events":[{"resourceId":"abc"}]}';
    expect(validateWebhookSignature(payload, "invalid-signature", key)).toBe(false);
  });

  it("should return false when payload is tampered", () => {
    const key = generateTestKey();
    const originalPayload = '{"events":[{"resourceId":"abc"}]}';
    const signature = computeSignature(originalPayload, key);

    const tamperedPayload = '{"events":[{"resourceId":"xyz"}]}';
    expect(validateWebhookSignature(tamperedPayload, signature, key)).toBe(false);
  });

  it("should return false with wrong webhook key", () => {
    const key = generateTestKey();
    const wrongKey = generateTestKey();
    const payload = '{"events":[]}';
    const signature = computeSignature(payload, key);

    expect(validateWebhookSignature(payload, signature, wrongKey)).toBe(false);
  });
});
