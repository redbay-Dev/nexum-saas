import { describe, it, expect } from "vitest";
import { renderInvoiceHtml, renderRctiHtml } from "./pdf-generator.js";

describe("renderInvoiceHtml", () => {
  const baseData = {
    organisation: {
      companyName: "Test Transport Pty Ltd",
      tradingName: "Test Transport",
      abn: "12345678901",
      phone: "0400 000 000",
      email: "admin@test.com.au",
      bankBsb: "062-000",
      bankAccountNumber: "12345678",
      bankAccountName: "Test Transport",
    },
    invoice: {
      invoiceNumber: "INV-0042",
      issueDate: "2026-03-01",
      dueDate: "2026-03-31",
      subtotal: 1000,
      total: 1100,
      notes: "Payment within 30 days",
    },
    customer: {
      name: "Acme Corp",
      abn: "98765432100",
      email: "accounts@acme.com",
    },
    lineItems: [
      {
        description: "Excavator hire - 8hr day",
        quantity: 2,
        unitOfMeasure: "days",
        unitPrice: 500,
        lineTotal: 1000,
      },
    ],
    isDraft: false,
  };

  it("should contain the invoice number", () => {
    const html = renderInvoiceHtml(baseData);
    expect(html).toContain("INV-0042");
  });

  it("should contain the customer name", () => {
    const html = renderInvoiceHtml(baseData);
    expect(html).toContain("Acme Corp");
  });

  it("should contain line item descriptions", () => {
    const html = renderInvoiceHtml(baseData);
    expect(html).toContain("Excavator hire - 8hr day");
  });

  it("should contain the organisation name", () => {
    const html = renderInvoiceHtml(baseData);
    expect(html).toContain("Test Transport Pty Ltd");
  });

  it("should contain TAX INVOICE title", () => {
    const html = renderInvoiceHtml(baseData);
    expect(html).toContain("TAX INVOICE");
  });

  it("should show DRAFT watermark when isDraft is true", () => {
    const html = renderInvoiceHtml({ ...baseData, isDraft: true });
    expect(html).toContain("DRAFT");
    expect(html).toContain("watermark");
  });

  it("should not show DRAFT watermark when isDraft is false", () => {
    const html = renderInvoiceHtml(baseData);
    expect(html).not.toContain("watermark");
  });

  it("should contain payment details when bank info provided", () => {
    const html = renderInvoiceHtml(baseData);
    expect(html).toContain("062-000");
    expect(html).toContain("12345678");
  });

  it("should format dates as DD/MM/YYYY", () => {
    const html = renderInvoiceHtml(baseData);
    expect(html).toContain("01/03/2026");
    expect(html).toContain("31/03/2026");
  });

  it("should contain the ABN", () => {
    const html = renderInvoiceHtml(baseData);
    expect(html).toContain("12345678901");
  });
});

describe("renderRctiHtml", () => {
  const baseRctiData = {
    organisation: {
      companyName: "Test Transport Pty Ltd",
      abn: "12345678901",
      phone: "0400 000 000",
      email: "admin@test.com.au",
      bankBsb: "062-000",
      bankAccountNumber: "12345678",
      bankAccountName: "Test Transport",
    },
    rcti: {
      rctiNumber: "RCTI-0015",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-15",
      dueDate: "2026-03-22",
      subtotal: 5000,
      deductionsTotal: 200,
      total: 4800,
    },
    contractor: {
      name: "Jones Earthmoving",
      abn: "55566677788",
    },
    chargeItems: [
      {
        sourceJobNumber: "JOB-101",
        description: "20T excavator wet hire",
        assetRegistration: "EX-001",
        quantity: 5,
        unitPrice: 1000,
        lineTotal: 5000,
      },
    ],
    deductionItems: [
      {
        deductionCategory: "Fuel",
        description: "Diesel supplied on site",
        lineTotal: 200,
      },
    ],
  };

  it("should contain the RCTI number", () => {
    const html = renderRctiHtml(baseRctiData);
    expect(html).toContain("RCTI-0015");
  });

  it("should contain the contractor name", () => {
    const html = renderRctiHtml(baseRctiData);
    expect(html).toContain("Jones Earthmoving");
  });

  it("should contain REMITTANCE ADVICE title", () => {
    const html = renderRctiHtml(baseRctiData);
    expect(html).toContain("REMITTANCE ADVICE");
  });

  it("should contain period dates formatted as DD/MM/YYYY", () => {
    const html = renderRctiHtml(baseRctiData);
    expect(html).toContain("01/03/2026");
    expect(html).toContain("15/03/2026");
  });

  it("should contain charge item descriptions", () => {
    const html = renderRctiHtml(baseRctiData);
    expect(html).toContain("20T excavator wet hire");
    expect(html).toContain("JOB-101");
  });

  it("should contain deduction items", () => {
    const html = renderRctiHtml(baseRctiData);
    expect(html).toContain("Fuel");
    expect(html).toContain("Diesel supplied on site");
  });

  it("should contain Net Payable label", () => {
    const html = renderRctiHtml(baseRctiData);
    expect(html).toContain("Net Payable");
  });

  it("should contain the Recipient Created Tax Invoice footer text", () => {
    const html = renderRctiHtml(baseRctiData);
    expect(html).toContain("Recipient Created Tax Invoice");
  });
});
