import { describe, it, expect } from "vitest";
import {
  calculateNetWeight,
  calculatePayableWeight,
  checkPayloadOverage,
  aggregateLoadWeights,
} from "./weight-calculator.js";

describe("weight-calculator", () => {
  describe("calculateNetWeight", () => {
    it("should calculate net weight as gross minus tare", () => {
      const result = calculateNetWeight({ grossWeight: 45.5, tareWeight: 22.0 });
      expect(result.netWeight).toBe(23.5);
      expect(result.grossWeight).toBe(45.5);
      expect(result.tareWeight).toBe(22.0);
    });

    it("should return 0 net weight when tare exceeds gross", () => {
      const result = calculateNetWeight({ grossWeight: 10, tareWeight: 15 });
      expect(result.netWeight).toBe(0);
    });

    it("should handle zero inputs", () => {
      const result = calculateNetWeight({ grossWeight: 0, tareWeight: 0 });
      expect(result.netWeight).toBe(0);
    });

    it("should handle precise decimal values", () => {
      const result = calculateNetWeight({ grossWeight: 45.1234, tareWeight: 22.5678 });
      expect(result.netWeight).toBe(22.5556);
    });
  });

  describe("calculatePayableWeight", () => {
    it("should return net weight when no contract limit", () => {
      const result = calculatePayableWeight({ netWeight: 25.5 });
      expect(result.payableWeight).toBe(25.5);
      expect(result.isCapped).toBe(false);
      expect(result.overageAmount).toBe(0);
    });

    it("should cap at contract limit when net weight exceeds it", () => {
      const result = calculatePayableWeight({ netWeight: 30, contractLimit: 25 });
      expect(result.payableWeight).toBe(25);
      expect(result.isCapped).toBe(true);
      expect(result.overageAmount).toBe(5);
    });

    it("should not cap when net weight is within limit", () => {
      const result = calculatePayableWeight({ netWeight: 20, contractLimit: 25 });
      expect(result.payableWeight).toBe(20);
      expect(result.isCapped).toBe(false);
      expect(result.overageAmount).toBe(0);
    });

    it("should handle zero contract limit", () => {
      const result = calculatePayableWeight({ netWeight: 25, contractLimit: 0 });
      expect(result.payableWeight).toBe(25);
      expect(result.isCapped).toBe(false);
    });
  });

  describe("checkPayloadOverage", () => {
    it("should detect overloading", () => {
      const result = checkPayloadOverage({ netWeight: 30, payloadCapacity: 25 });
      expect(result.isOverloaded).toBe(true);
      expect(result.overageAmount).toBe(5);
      expect(result.overagePercent).toBe(20);
    });

    it("should return no overload when within capacity", () => {
      const result = checkPayloadOverage({ netWeight: 20, payloadCapacity: 25 });
      expect(result.isOverloaded).toBe(false);
      expect(result.overageAmount).toBe(0);
      expect(result.overagePercent).toBe(0);
    });

    it("should handle zero capacity gracefully", () => {
      const result = checkPayloadOverage({ netWeight: 20, payloadCapacity: 0 });
      expect(result.isOverloaded).toBe(false);
    });

    it("should handle exact match (not overloaded)", () => {
      const result = checkPayloadOverage({ netWeight: 25, payloadCapacity: 25 });
      expect(result.isOverloaded).toBe(false);
    });
  });

  describe("aggregateLoadWeights", () => {
    it("should aggregate weights from multiple loads", () => {
      const result = aggregateLoadWeights([
        { grossWeight: 45, tareWeight: 22, netWeight: 23, quantity: 23 },
        { grossWeight: 43, tareWeight: 22, netWeight: 21, quantity: 21 },
        { grossWeight: 44, tareWeight: 22, netWeight: 22, quantity: 22 },
      ]);
      expect(result.totalGross).toBe(132);
      expect(result.totalTare).toBe(66);
      expect(result.totalNet).toBe(66);
      expect(result.totalQuantity).toBe(66);
      expect(result.loadCount).toBe(3);
    });

    it("should handle empty loads array", () => {
      const result = aggregateLoadWeights([]);
      expect(result.totalGross).toBe(0);
      expect(result.totalTare).toBe(0);
      expect(result.totalNet).toBe(0);
      expect(result.totalQuantity).toBe(0);
      expect(result.loadCount).toBe(0);
    });

    it("should handle loads with missing fields", () => {
      const result = aggregateLoadWeights([
        { grossWeight: 45 },
        { netWeight: 21, quantity: 21 },
      ]);
      expect(result.totalGross).toBe(45);
      expect(result.totalNet).toBe(21);
      expect(result.totalQuantity).toBe(21);
      expect(result.loadCount).toBe(2);
    });
  });
});
