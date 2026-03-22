import { describe, it, expect } from "vitest";
import {
  checkOverage,
  checkPayloadOverage,
  checkVolumeOverage,
  checkContractOverage,
  detectAllOverages,
} from "./overage-detector.js";

describe("overage-detector", () => {
  describe("checkOverage", () => {
    it("should return null when within limits", () => {
      const result = checkOverage({
        actualValue: 20,
        limitValue: 25,
        overageType: "payload",
      });
      expect(result).toBeNull();
    });

    it("should return null when at exact limit", () => {
      const result = checkOverage({
        actualValue: 25,
        limitValue: 25,
        overageType: "payload",
      });
      expect(result).toBeNull();
    });

    it("should classify minor overage (within 2%)", () => {
      const result = checkOverage({
        actualValue: 25.4,
        limitValue: 25,
        overageType: "payload",
      });
      expect(result).not.toBeNull();
      expect(result?.severity).toBe("minor");
      expect(result?.overageAmount).toBeCloseTo(0.4, 2);
      expect(result?.overagePercent).toBeCloseTo(1.6, 1);
    });

    it("should classify significant overage (between 2% and 10%)", () => {
      const result = checkOverage({
        actualValue: 26.5,
        limitValue: 25,
        overageType: "payload",
      });
      expect(result).not.toBeNull();
      expect(result?.severity).toBe("significant");
      expect(result?.overagePercent).toBeCloseTo(6, 0);
    });

    it("should classify critical overage (above 10%)", () => {
      const result = checkOverage({
        actualValue: 30,
        limitValue: 25,
        overageType: "payload",
      });
      expect(result).not.toBeNull();
      expect(result?.severity).toBe("critical");
      expect(result?.overagePercent).toBe(20);
    });

    it("should respect custom thresholds", () => {
      const result = checkOverage({
        actualValue: 26,
        limitValue: 25,
        overageType: "payload",
        minorThresholdPercent: 5,
        criticalThresholdPercent: 20,
      });
      expect(result).not.toBeNull();
      expect(result?.severity).toBe("minor"); // 4% is within 5% minor threshold
    });

    it("should handle zero limit", () => {
      const result = checkOverage({
        actualValue: 25,
        limitValue: 0,
        overageType: "payload",
      });
      expect(result).toBeNull();
    });
  });

  describe("checkPayloadOverage", () => {
    it("should detect payload overage from GVM and tare", () => {
      // GVM 42t, tare 17t = 25t payload capacity. Net weight 27t = overage
      const result = checkPayloadOverage({
        netWeight: 27,
        gvm: 42,
        assetTareWeight: 17,
      });
      expect(result).not.toBeNull();
      expect(result?.overageType).toBe("payload");
      expect(result?.overageAmount).toBe(2);
    });

    it("should return null when no GVM data", () => {
      const result = checkPayloadOverage({ netWeight: 27 });
      expect(result).toBeNull();
    });

    it("should return null when within capacity", () => {
      const result = checkPayloadOverage({
        netWeight: 24,
        gvm: 42,
        assetTareWeight: 17,
      });
      expect(result).toBeNull();
    });
  });

  describe("checkVolumeOverage", () => {
    it("should detect volume overage", () => {
      const result = checkVolumeOverage({
        actualVolume: 15,
        maxVolume: 12,
      });
      expect(result).not.toBeNull();
      expect(result?.overageType).toBe("volume");
    });

    it("should return null when no max volume", () => {
      const result = checkVolumeOverage({ actualVolume: 15 });
      expect(result).toBeNull();
    });
  });

  describe("checkContractOverage", () => {
    it("should detect contract limit overage", () => {
      const result = checkContractOverage({
        actualQuantity: 110,
        contractLimit: 100,
      });
      expect(result).not.toBeNull();
      expect(result?.overageType).toBe("contract_limit");
      expect(result?.overagePercent).toBe(10);
    });

    it("should return null when within contract", () => {
      const result = checkContractOverage({
        actualQuantity: 90,
        contractLimit: 100,
      });
      expect(result).toBeNull();
    });
  });

  describe("detectAllOverages", () => {
    it("should detect multiple overage types at once", () => {
      const results = detectAllOverages({
        netWeight: 27,
        quantity: 110,
        volume: 15,
        assetGvm: 42,
        assetTareWeight: 17,
        assetMaxVolume: 12,
        contractLimit: 100,
      });

      expect(results.length).toBe(3);
      const types = results.map((r) => r.overageType);
      expect(types).toContain("payload");
      expect(types).toContain("volume");
      expect(types).toContain("contract_limit");
    });

    it("should return empty array when no overages", () => {
      const results = detectAllOverages({
        netWeight: 20,
        quantity: 80,
        assetGvm: 42,
        assetTareWeight: 17,
        contractLimit: 100,
      });
      expect(results.length).toBe(0);
    });

    it("should work with minimal inputs", () => {
      const results = detectAllOverages({
        netWeight: 20,
        quantity: 20,
      });
      expect(results.length).toBe(0);
    });
  });
});
