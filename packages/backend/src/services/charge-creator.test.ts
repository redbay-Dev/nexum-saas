import { describe, it, expect } from "vitest";
import {
  generateChargesFromPricingLines,
  summariseCharges,
} from "./charge-creator.js";

describe("charge-creator", () => {
  const basePricingLine = {
    id: "line-1",
    lineType: "revenue",
    partyId: "cust-1",
    partyName: "Customer A",
    category: "cartage",
    description: "Cartage per tonne",
    rateType: "per_tonne",
    quantity: "0",
    unitRate: "15.50",
    total: "0",
    isLocked: false,
  };

  const baseQuantities = {
    totalNetWeight: 66,
    totalQuantity: 50,
    totalBillableHours: 8,
    loadCount: 3,
    overtimeHours: 0,
  };

  describe("generateChargesFromPricingLines", () => {
    it("should generate charge for per_tonne rate using totalNetWeight", () => {
      const charges = generateChargesFromPricingLines(
        [basePricingLine],
        baseQuantities,
      );
      expect(charges.length).toBe(1);
      expect(charges[0]?.quantity).toBe(66);
      expect(charges[0]?.unitRate).toBe(15.5);
      expect(charges[0]?.total).toBe(1023);
    });

    it("should generate charge for per_hour rate using totalBillableHours", () => {
      const charges = generateChargesFromPricingLines(
        [{ ...basePricingLine, rateType: "per_hour", unitRate: "85.00" }],
        baseQuantities,
      );
      expect(charges[0]?.quantity).toBe(8);
      expect(charges[0]?.total).toBe(680);
    });

    it("should generate charge for per_load rate using loadCount", () => {
      const charges = generateChargesFromPricingLines(
        [{ ...basePricingLine, rateType: "per_load", unitRate: "200.00" }],
        baseQuantities,
      );
      expect(charges[0]?.quantity).toBe(3);
      expect(charges[0]?.total).toBe(600);
    });

    it("should generate charge for per_cubic_metre rate using totalQuantity", () => {
      const charges = generateChargesFromPricingLines(
        [{ ...basePricingLine, rateType: "per_cubic_metre", unitRate: "25.00" }],
        baseQuantities,
      );
      expect(charges[0]?.quantity).toBe(50);
      expect(charges[0]?.total).toBe(1250);
    });

    it("should use quantity 1 for flat rate", () => {
      const charges = generateChargesFromPricingLines(
        [{ ...basePricingLine, rateType: "flat", unitRate: "500.00" }],
        baseQuantities,
      );
      expect(charges[0]?.quantity).toBe(1);
      expect(charges[0]?.total).toBe(500);
    });

    it("should use planned quantity for per_km rate", () => {
      const charges = generateChargesFromPricingLines(
        [{ ...basePricingLine, rateType: "per_km", unitRate: "2.50", quantity: "120" }],
        baseQuantities,
      );
      expect(charges[0]?.quantity).toBe(120);
      expect(charges[0]?.total).toBe(300);
    });

    it("should generate multiple charges from multiple pricing lines", () => {
      const charges = generateChargesFromPricingLines(
        [
          { ...basePricingLine, id: "rev-1", lineType: "revenue", rateType: "per_tonne", unitRate: "15.00" },
          { ...basePricingLine, id: "cost-1", lineType: "cost", rateType: "per_tonne", unitRate: "10.00", category: "subcontractor" },
        ],
        baseQuantities,
      );
      expect(charges.length).toBe(2);
      expect(charges[0]?.lineType).toBe("revenue");
      expect(charges[1]?.lineType).toBe("cost");
    });

    it("should skip contractor cost lines when customer-supplied asset", () => {
      const charges = generateChargesFromPricingLines(
        [
          { ...basePricingLine, id: "rev-1", lineType: "revenue" },
          { ...basePricingLine, id: "cost-1", lineType: "cost", category: "subcontractor" },
        ],
        baseQuantities,
        { isCustomerSuppliedAsset: true },
      );
      expect(charges.length).toBe(1);
      expect(charges[0]?.lineType).toBe("revenue");
    });

    it("should link charges to pricing line IDs", () => {
      const charges = generateChargesFromPricingLines(
        [{ ...basePricingLine, id: "pricing-123" }],
        baseQuantities,
      );
      expect(charges[0]?.pricingLineId).toBe("pricing-123");
    });
  });

  describe("summariseCharges", () => {
    it("should calculate revenue, cost, and profit", () => {
      const summary = summariseCharges([
        { pricingLineId: "1", lineType: "revenue", partyId: null, partyName: null, category: "cartage", description: null, rateType: "per_tonne", quantity: 66, unitRate: 15, total: 990 },
        { pricingLineId: "2", lineType: "cost", partyId: null, partyName: null, category: "subcontractor", description: null, rateType: "per_tonne", quantity: 66, unitRate: 10, total: 660 },
      ]);
      expect(summary.totalRevenue).toBe(990);
      expect(summary.totalCost).toBe(660);
      expect(summary.grossProfit).toBe(330);
      expect(summary.marginPercent).toBeCloseTo(33.33, 1);
    });

    it("should handle revenue-only charges", () => {
      const summary = summariseCharges([
        { pricingLineId: "1", lineType: "revenue", partyId: null, partyName: null, category: "hire", description: null, rateType: "flat", quantity: 1, unitRate: 500, total: 500 },
      ]);
      expect(summary.totalRevenue).toBe(500);
      expect(summary.totalCost).toBe(0);
      expect(summary.grossProfit).toBe(500);
      expect(summary.marginPercent).toBe(100);
    });

    it("should return null margin when no revenue", () => {
      const summary = summariseCharges([
        { pricingLineId: "1", lineType: "cost", partyId: null, partyName: null, category: "subcontractor", description: null, rateType: "flat", quantity: 1, unitRate: 300, total: 300 },
      ]);
      expect(summary.totalRevenue).toBe(0);
      expect(summary.marginPercent).toBeNull();
    });

    it("should handle empty charges", () => {
      const summary = summariseCharges([]);
      expect(summary.totalRevenue).toBe(0);
      expect(summary.totalCost).toBe(0);
      expect(summary.grossProfit).toBe(0);
      expect(summary.marginPercent).toBeNull();
    });
  });
});
