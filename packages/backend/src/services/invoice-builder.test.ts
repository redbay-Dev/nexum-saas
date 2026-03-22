import { describe, it, expect } from "vitest";
import {
  groupChargesForInvoicing,
  buildInvoiceLineItems,
  calculateInvoiceTotals,
  splitChargesByCustomer,
} from "./invoice-builder.js";

function makeCharge(overrides: Record<string, unknown> = {}): {
  id: string;
  jobId: string;
  partyId: string | null;
  partyName: string | null;
  category: string;
  description: string | null;
  rateType: string;
  quantity: string;
  unitRate: string;
  total: string;
  lineType: string;
  daysheetId: string;
} {
  return {
    id: "charge-1",
    jobId: "job-1",
    partyId: "cust-1",
    partyName: "Customer A",
    category: "cartage",
    description: "Cartage 100t",
    rateType: "per_tonne",
    quantity: "100",
    unitRate: "50",
    total: "5000",
    lineType: "revenue",
    daysheetId: "ds-1",
    ...overrides,
  };
}

function makeJob(overrides: Record<string, unknown> = {}): {
  id: string;
  jobNumber: string | null;
  poNumber: string | null;
  projectId: string | null;
  customerId: string;
} {
  return {
    id: "job-1",
    jobNumber: "J-001",
    poNumber: null,
    projectId: null,
    customerId: "cust-1",
    ...overrides,
  };
}

describe("groupChargesForInvoicing", () => {
  it("should group per_job by default", () => {
    const charges = [
      makeCharge({ id: "c1", jobId: "j1" }),
      makeCharge({ id: "c2", jobId: "j1" }),
      makeCharge({ id: "c3", jobId: "j2" }),
    ];
    const jobs = [makeJob({ id: "j1" }), makeJob({ id: "j2" })];
    const groups = groupChargesForInvoicing(charges, jobs, "per_job");
    expect(groups.size).toBe(2);
    expect(groups.get("j1")?.length).toBe(2);
    expect(groups.get("j2")?.length).toBe(1);
  });

  it("should group per_po", () => {
    const charges = [
      makeCharge({ id: "c1", jobId: "j1" }),
      makeCharge({ id: "c2", jobId: "j2" }),
      makeCharge({ id: "c3", jobId: "j3" }),
    ];
    const jobs = [
      makeJob({ id: "j1", poNumber: "PO-A" }),
      makeJob({ id: "j2", poNumber: "PO-A" }),
      makeJob({ id: "j3", poNumber: "PO-B" }),
    ];
    const groups = groupChargesForInvoicing(charges, jobs, "per_po");
    expect(groups.size).toBe(2);
    expect(groups.get("PO-A")?.length).toBe(2);
    expect(groups.get("PO-B")?.length).toBe(1);
  });

  it("should group per_project", () => {
    const charges = [
      makeCharge({ id: "c1", jobId: "j1" }),
      makeCharge({ id: "c2", jobId: "j2" }),
    ];
    const jobs = [
      makeJob({ id: "j1", projectId: "proj-A" }),
      makeJob({ id: "j2", projectId: "proj-A" }),
    ];
    const groups = groupChargesForInvoicing(charges, jobs, "per_project");
    expect(groups.size).toBe(1);
    expect(groups.get("proj-A")?.length).toBe(2);
  });

  it("should combine_all into single group", () => {
    const charges = [
      makeCharge({ id: "c1", jobId: "j1" }),
      makeCharge({ id: "c2", jobId: "j2" }),
      makeCharge({ id: "c3", jobId: "j3" }),
    ];
    const jobs = [makeJob({ id: "j1" }), makeJob({ id: "j2" }), makeJob({ id: "j3" })];
    const groups = groupChargesForInvoicing(charges, jobs, "combine_all");
    expect(groups.size).toBe(1);
    expect(groups.get("all")?.length).toBe(3);
  });

  it("should fall back to jobId when PO is null", () => {
    const charges = [makeCharge({ id: "c1", jobId: "j1" })];
    const jobs = [makeJob({ id: "j1", poNumber: null })];
    const groups = groupChargesForInvoicing(charges, jobs, "per_po");
    expect(groups.has("j1")).toBe(true);
  });
});

describe("buildInvoiceLineItems", () => {
  it("should build line items from charges", () => {
    const charges = [makeCharge()];
    const jobs = [makeJob()];
    const lines = buildInvoiceLineItems(charges, jobs);
    expect(lines.length).toBe(1);
    const line = lines[0]!;
    expect(line.description).toBe("Cartage 100t");
    expect(line.quantity).toBe(100);
    expect(line.unitPrice).toBe(50);
    expect(line.lineTotal).toBe(5000);
    expect(line.unitOfMeasure).toBe("tonne");
    expect(line.sourceJobNumber).toBe("J-001");
    expect(line.calculationMethod).toContain("100 tonne @ $50.00/tonne");
  });

  it("should use category/rateType as description when null", () => {
    const charges = [makeCharge({ description: null })];
    const jobs = [makeJob()];
    const lines = buildInvoiceLineItems(charges, jobs);
    expect(lines[0]!.description).toBe("cartage — per_tonne");
  });

  it("should handle flat rate calculation method", () => {
    const charges = [makeCharge({ rateType: "flat", quantity: "1", unitRate: "2500", total: "2500" })];
    const jobs = [makeJob()];
    const lines = buildInvoiceLineItems(charges, jobs);
    expect(lines[0]!.calculationMethod).toBe("Flat rate $2500.00");
  });

  it("should include pricing snapshot", () => {
    const charges = [makeCharge()];
    const jobs = [makeJob()];
    const lines = buildInvoiceLineItems(charges, jobs);
    const snapshot = lines[0]!.pricingSnapshot as Record<string, unknown>;
    expect(snapshot.chargeId).toBe("charge-1");
    expect(snapshot.category).toBe("cartage");
    expect(snapshot.originalTotal).toBe("5000");
  });

  it("should handle multiple charges", () => {
    const charges = [
      makeCharge({ id: "c1", total: "5000" }),
      makeCharge({ id: "c2", total: "3000", quantity: "60", description: "Material supply" }),
    ];
    const jobs = [makeJob()];
    const lines = buildInvoiceLineItems(charges, jobs);
    expect(lines.length).toBe(2);
    expect(lines[0]!.lineTotal).toBe(5000);
    expect(lines[1]!.lineTotal).toBe(3000);
  });
});

describe("calculateInvoiceTotals", () => {
  it("should sum line totals", () => {
    const lines = [
      { chargeId: "c1", jobId: "j1", description: "A", quantity: 100, unitOfMeasure: null, unitPrice: 50, lineTotal: 5000, calculationMethod: "", sourceJobNumber: null, pricingSnapshot: {} },
      { chargeId: "c2", jobId: "j1", description: "B", quantity: 10, unitOfMeasure: null, unitPrice: 200, lineTotal: 2000, calculationMethod: "", sourceJobNumber: null, pricingSnapshot: {} },
    ];
    const totals = calculateInvoiceTotals(lines);
    expect(totals.subtotal).toBe(7000);
    expect(totals.total).toBe(7000); // No tax in Nexum
  });

  it("should handle empty lines", () => {
    const totals = calculateInvoiceTotals([]);
    expect(totals.subtotal).toBe(0);
    expect(totals.total).toBe(0);
  });

  it("should round to 2 decimal places", () => {
    const lines = [
      { chargeId: "c1", jobId: "j1", description: "A", quantity: 1, unitOfMeasure: null, unitPrice: 33.33, lineTotal: 33.33, calculationMethod: "", sourceJobNumber: null, pricingSnapshot: {} },
      { chargeId: "c2", jobId: "j1", description: "B", quantity: 1, unitOfMeasure: null, unitPrice: 66.67, lineTotal: 66.67, calculationMethod: "", sourceJobNumber: null, pricingSnapshot: {} },
    ];
    const totals = calculateInvoiceTotals(lines);
    expect(totals.subtotal).toBe(100);
  });
});

describe("splitChargesByCustomer", () => {
  it("should split charges by partyId", () => {
    const charges = [
      makeCharge({ id: "c1", partyId: "cust-1" }),
      makeCharge({ id: "c2", partyId: "cust-2" }),
      makeCharge({ id: "c3", partyId: "cust-1" }),
    ];
    const groups = splitChargesByCustomer(charges);
    expect(groups.size).toBe(2);
    expect(groups.get("cust-1")?.length).toBe(2);
    expect(groups.get("cust-2")?.length).toBe(1);
  });

  it("should group null partyId as unassigned", () => {
    const charges = [
      makeCharge({ id: "c1", partyId: null }),
      makeCharge({ id: "c2", partyId: null }),
    ];
    const groups = splitChargesByCustomer(charges);
    expect(groups.size).toBe(1);
    expect(groups.get("unassigned")?.length).toBe(2);
  });
});
