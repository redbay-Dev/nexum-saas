import { describe, it, expect } from "vitest";
import { buildRctiLineItems, calculateRctiTotals } from "./rcti-builder.js";

function makeCharge(overrides: Record<string, unknown> = {}): {
  id: string;
  jobId: string;
  daysheetId: string;
  partyId: string | null;
  partyName: string | null;
  category: string;
  description: string | null;
  rateType: string;
  quantity: string;
  unitRate: string;
  total: string;
} {
  return {
    id: "charge-1",
    jobId: "job-1",
    daysheetId: "ds-1",
    partyId: "contractor-1",
    partyName: "Contractor A",
    category: "hire",
    description: "Truck hire",
    rateType: "per_hour",
    quantity: "8",
    unitRate: "120",
    total: "960",
    ...overrides,
  };
}

describe("buildRctiLineItems", () => {
  it("should build line items from cost charges", () => {
    const charges = [makeCharge()];
    const jobs = [{ id: "job-1", jobNumber: "J-001" }];
    const daysheets = [{ id: "ds-1", assetId: "a-1", assetRegistration: "ABC-123" }];

    const lines = buildRctiLineItems(charges, jobs, daysheets);
    expect(lines.length).toBe(1);
    const line = lines[0]!;
    expect(line.description).toBe("Truck hire");
    expect(line.quantity).toBe(8);
    expect(line.unitPrice).toBe(120);
    expect(line.lineTotal).toBe(960);
    expect(line.unitOfMeasure).toBe("hour");
    expect(line.sourceJobNumber).toBe("J-001");
    expect(line.assetRegistration).toBe("ABC-123");
    expect(line.lineType).toBe("charge");
  });

  it("should use category/rateType when description is null", () => {
    const charges = [makeCharge({ description: null })];
    const lines = buildRctiLineItems(charges, [], []);
    expect(lines[0]!.description).toBe("hire — per_hour");
  });

  it("should handle multiple charges", () => {
    const charges = [
      makeCharge({ id: "c1", total: "960" }),
      makeCharge({ id: "c2", total: "500", rateType: "per_tonne", quantity: "50", unitRate: "10", description: "Cartage" }),
    ];
    const lines = buildRctiLineItems(charges, [], []);
    expect(lines.length).toBe(2);
    expect(lines[0]!.lineTotal).toBe(960);
    expect(lines[1]!.lineTotal).toBe(500);
  });

  it("should handle missing job/daysheet gracefully", () => {
    const charges = [makeCharge()];
    const lines = buildRctiLineItems(charges, [], []);
    expect(lines[0]!.sourceJobNumber).toBeNull();
    expect(lines[0]!.assetRegistration).toBeNull();
  });
});

describe("calculateRctiTotals", () => {
  it("should sum charge lines as subtotal", () => {
    const lines = [
      { chargeId: "c1", jobId: "j1", daysheetId: "ds1", lineType: "charge" as const, description: "A", quantity: 8, unitOfMeasure: null, unitPrice: 120, lineTotal: 960, deductionCategory: null, deductionDetails: null, assetRegistration: null, materialName: null, sourceJobNumber: null },
      { chargeId: "c2", jobId: "j1", daysheetId: "ds1", lineType: "charge" as const, description: "B", quantity: 10, unitOfMeasure: null, unitPrice: 50, lineTotal: 500, deductionCategory: null, deductionDetails: null, assetRegistration: null, materialName: null, sourceJobNumber: null },
    ];
    const totals = calculateRctiTotals(lines);
    expect(totals.subtotal).toBe(1460);
    expect(totals.deductionsTotal).toBe(0);
    expect(totals.total).toBe(1460);
  });

  it("should subtract deductions from total", () => {
    const lines = [
      { chargeId: "c1", jobId: "j1", daysheetId: "ds1", lineType: "charge" as const, description: "Work", quantity: 8, unitOfMeasure: null, unitPrice: 120, lineTotal: 960, deductionCategory: null, deductionDetails: null, assetRegistration: null, materialName: null, sourceJobNumber: null },
      { chargeId: null, jobId: null, daysheetId: null, lineType: "deduction" as const, description: "Fuel", quantity: 1, unitOfMeasure: null, unitPrice: 200, lineTotal: 200, deductionCategory: "fuel_usage", deductionDetails: "200L diesel", assetRegistration: null, materialName: null, sourceJobNumber: null },
    ];
    const totals = calculateRctiTotals(lines);
    expect(totals.subtotal).toBe(960);
    expect(totals.deductionsTotal).toBe(200);
    expect(totals.total).toBe(760);
  });

  it("should handle empty lines", () => {
    const totals = calculateRctiTotals([]);
    expect(totals.subtotal).toBe(0);
    expect(totals.deductionsTotal).toBe(0);
    expect(totals.total).toBe(0);
  });

  it("should round to 2 decimal places", () => {
    const lines = [
      { chargeId: "c1", jobId: "j1", daysheetId: "ds1", lineType: "charge" as const, description: "A", quantity: 1, unitOfMeasure: null, unitPrice: 33.33, lineTotal: 33.33, deductionCategory: null, deductionDetails: null, assetRegistration: null, materialName: null, sourceJobNumber: null },
      { chargeId: "c2", jobId: "j1", daysheetId: "ds1", lineType: "charge" as const, description: "B", quantity: 1, unitOfMeasure: null, unitPrice: 66.67, lineTotal: 66.67, deductionCategory: null, deductionDetails: null, assetRegistration: null, materialName: null, sourceJobNumber: null },
    ];
    const totals = calculateRctiTotals(lines);
    expect(totals.subtotal).toBe(100);
  });
});
