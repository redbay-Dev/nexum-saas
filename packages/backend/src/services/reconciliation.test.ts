import { describe, it, expect } from "vitest";
import {
  reconcileDocketWithDaysheet,
  isEligibleForAutoProcessing,
} from "./reconciliation.js";

describe("reconciliation", () => {
  describe("reconcileDocketWithDaysheet", () => {
    it("should reconcile matching values without discrepancy", () => {
      const result = reconcileDocketWithDaysheet(
        { totalGrossWeight: 45.5, totalTareWeight: 22.0, totalNetWeight: 23.5 },
        { grossWeight: 45.5, tareWeight: 22.0, netWeight: 23.5 },
      );
      expect(result.isReconciled).toBe(true);
      expect(result.hasDiscrepancy).toBe(false);
      expect(result.items.length).toBe(3);
      expect(result.items.every((i) => i.isWithinTolerance)).toBe(true);
    });

    it("should detect discrepancy when values differ beyond tolerance", () => {
      const result = reconcileDocketWithDaysheet(
        { totalNetWeight: 23.5 },
        { netWeight: 25.0 },
        1, // 1% tolerance
      );
      expect(result.hasDiscrepancy).toBe(true);
      expect(result.discrepancyNotes).toContain("netWeight");
    });

    it("should allow values within tolerance", () => {
      const result = reconcileDocketWithDaysheet(
        { totalNetWeight: 23.5 },
        { netWeight: 23.6 }, // 0.42% difference, within 1%
        1,
      );
      expect(result.hasDiscrepancy).toBe(false);
    });

    it("should handle missing values (only compare available fields)", () => {
      const result = reconcileDocketWithDaysheet(
        { totalNetWeight: 23.5 },
        { grossWeight: 45.5 }, // No netWeight on docket, gross only
      );
      // Should only compare grossWeight (but daysheet has no totalGrossWeight)
      // grossWeight > 0 so comparison happens with daysheet's 0
      expect(result.items.length).toBe(1);
    });

    it("should skip comparison when docket value is zero", () => {
      const result = reconcileDocketWithDaysheet(
        { totalNetWeight: 23.5 },
        { netWeight: 0 },
      );
      expect(result.items.length).toBe(0);
      expect(result.hasDiscrepancy).toBe(false);
    });

    it("should use custom tolerance percentage", () => {
      const result = reconcileDocketWithDaysheet(
        { totalNetWeight: 100 },
        { netWeight: 104 },
        5, // 5% tolerance
      );
      expect(result.hasDiscrepancy).toBe(false); // 4% within 5% tolerance
    });
  });

  describe("isEligibleForAutoProcessing", () => {
    it("should be eligible with clean data and no issues", () => {
      const result = isEligibleForAutoProcessing({
        loadCount: 3,
        totalNetWeight: 66,
        hasOverages: false,
        hasDocketDiscrepancies: false,
      });
      expect(result.eligible).toBe(true);
      expect(result.reasons.length).toBe(0);
    });

    it("should not be eligible with pending overages", () => {
      const result = isEligibleForAutoProcessing({
        loadCount: 3,
        totalNetWeight: 66,
        hasOverages: true,
        hasDocketDiscrepancies: false,
      });
      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain("Has pending overages requiring approval");
    });

    it("should not be eligible with docket discrepancies", () => {
      const result = isEligibleForAutoProcessing({
        loadCount: 3,
        totalNetWeight: 66,
        hasOverages: false,
        hasDocketDiscrepancies: true,
      });
      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain("Has docket discrepancies requiring review");
    });

    it("should not be eligible without quantity data", () => {
      const result = isEligibleForAutoProcessing({
        hasOverages: false,
        hasDocketDiscrepancies: false,
      });
      expect(result.eligible).toBe(false);
      expect(result.reasons.some((r) => r.includes("No quantity data"))).toBe(true);
    });

    it("should not be eligible when quantity deviates from estimate", () => {
      const result = isEligibleForAutoProcessing(
        {
          loadCount: 3,
          totalNetWeight: 80,
          hasOverages: false,
          hasDocketDiscrepancies: false,
        },
        { estimatedQuantity: 66, tolerancePercent: 5 },
      );
      expect(result.eligible).toBe(false);
      expect(result.reasons.some((r) => r.includes("deviates"))).toBe(true);
    });

    it("should be eligible when quantity is within estimate tolerance", () => {
      const result = isEligibleForAutoProcessing(
        {
          loadCount: 3,
          totalNetWeight: 68,
          hasOverages: false,
          hasDocketDiscrepancies: false,
        },
        { estimatedQuantity: 66, tolerancePercent: 5 },
      );
      expect(result.eligible).toBe(true);
    });

    it("should handle multiple failure reasons", () => {
      const result = isEligibleForAutoProcessing({
        hasOverages: true,
        hasDocketDiscrepancies: true,
      });
      expect(result.eligible).toBe(false);
      expect(result.reasons.length).toBe(3); // no quantity + overages + discrepancies
    });
  });
});
