/**
 * PDF generation service using Puppeteer + Handlebars.
 * Generates invoice, RCTI, remittance advice, and statement PDFs.
 */

import Handlebars from "handlebars";

// ── Handlebars Helpers ──

Handlebars.registerHelper("formatCurrency", (amount: unknown) => {
  const num = typeof amount === "string" ? parseFloat(amount) : Number(amount);
  if (isNaN(num)) return "$0.00";
  return `$${num.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
});

Handlebars.registerHelper("formatDate", (dateStr: unknown) => {
  if (typeof dateStr !== "string" || !dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
});

Handlebars.registerHelper("formatNumber", (num: unknown) => {
  const n = typeof num === "string" ? parseFloat(num) : Number(num);
  if (isNaN(n)) return "0";
  return n.toLocaleString("en-AU", { maximumFractionDigits: 4 });
});

Handlebars.registerHelper("ifEquals", function (this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions) {
  return a === b ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper("lineNumber", (index: unknown) => {
  return Number(index) + 1;
});

// ── Invoice Template ──

const INVOICE_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; padding: 40px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .company-info { max-width: 50%; }
  .company-name { font-size: 18pt; font-weight: bold; color: #0f172a; }
  .company-details { font-size: 8pt; color: #64748b; margin-top: 4px; line-height: 1.6; }
  .invoice-info { text-align: right; }
  .invoice-title { font-size: 24pt; font-weight: bold; color: #0f172a; }
  .invoice-number { font-size: 11pt; color: #64748b; margin-top: 4px; }
  .invoice-meta { margin-top: 8px; font-size: 9pt; line-height: 1.8; }
  .invoice-meta span { color: #64748b; }
  .customer-section { background: #f8fafc; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
  .customer-label { font-size: 8pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .customer-name { font-size: 12pt; font-weight: 600; margin-top: 4px; }
  .customer-details { font-size: 9pt; color: #475569; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #0f172a; color: white; padding: 8px 12px; text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; }
  th:last-child { text-align: right; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 9pt; }
  td:last-child { text-align: right; }
  tr:nth-child(even) { background: #f8fafc; }
  .totals { float: right; width: 250px; }
  .totals table { margin-bottom: 0; }
  .totals td { border-bottom: 1px solid #e2e8f0; font-size: 9pt; }
  .totals .total-row { font-weight: bold; font-size: 12pt; background: #0f172a; color: white; }
  .totals .total-row td { border: none; padding: 10px 12px; }
  .notes { clear: both; margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; }
  .notes-label { font-size: 8pt; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
  .notes-text { font-size: 9pt; color: #475569; }
  .footer { position: fixed; bottom: 30px; left: 40px; right: 40px; text-align: center; font-size: 7pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  .payment-info { margin-top: 24px; background: #f0f9ff; padding: 12px; border-radius: 6px; font-size: 8pt; }
  .payment-info strong { color: #0f172a; }
  {{#if isDraft}}.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 120pt; color: rgba(0,0,0,0.05); font-weight: bold; z-index: -1; }{{/if}}
</style>
</head>
<body>
{{#if isDraft}}<div class="watermark">DRAFT</div>{{/if}}
<div class="header">
  <div class="company-info">
    <div class="company-name">{{organisation.companyName}}</div>
    <div class="company-details">
      {{#if organisation.tradingName}}Trading as: {{organisation.tradingName}}<br>{{/if}}
      {{#if organisation.abn}}ABN: {{organisation.abn}}<br>{{/if}}
      {{#if organisation.phone}}Ph: {{organisation.phone}}<br>{{/if}}
      {{#if organisation.email}}{{organisation.email}}{{/if}}
    </div>
  </div>
  <div class="invoice-info">
    <div class="invoice-title">TAX INVOICE</div>
    <div class="invoice-number">{{invoice.invoiceNumber}}</div>
    <div class="invoice-meta">
      <span>Issue Date:</span> {{formatDate invoice.issueDate}}<br>
      <span>Due Date:</span> {{formatDate invoice.dueDate}}<br>
      {{#if invoice.poNumber}}<span>PO:</span> {{invoice.poNumber}}{{/if}}
    </div>
  </div>
</div>
<div class="customer-section">
  <div class="customer-label">Bill To</div>
  <div class="customer-name">{{customer.name}}</div>
  <div class="customer-details">
    {{#if customer.abn}}ABN: {{customer.abn}}<br>{{/if}}
    {{#if customer.email}}{{customer.email}}{{/if}}
  </div>
</div>
<table>
  <thead>
    <tr>
      <th style="width: 40px">#</th>
      <th>Description</th>
      <th style="width: 60px">Qty</th>
      <th style="width: 50px">UOM</th>
      <th style="width: 80px; text-align: right">Unit Price</th>
      <th style="width: 90px; text-align: right">Amount</th>
    </tr>
  </thead>
  <tbody>
    {{#each lineItems}}
    <tr>
      <td>{{lineNumber @index}}</td>
      <td>{{this.description}}</td>
      <td>{{formatNumber this.quantity}}</td>
      <td>{{this.unitOfMeasure}}</td>
      <td style="text-align: right">{{formatCurrency this.unitPrice}}</td>
      <td style="text-align: right">{{formatCurrency this.lineTotal}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
<div class="totals">
  <table>
    <tr><td>Subtotal</td><td>{{formatCurrency invoice.subtotal}}</td></tr>
    <tr><td>GST (10%)</td><td>{{formatCurrency gstAmount}}</td></tr>
    <tr class="total-row"><td>Total (AUD)</td><td>{{formatCurrency invoice.total}}</td></tr>
    {{#if invoice.amountPaid}}<tr><td>Paid</td><td>{{formatCurrency invoice.amountPaid}}</td></tr>
    <tr><td><strong>Balance Due</strong></td><td><strong>{{formatCurrency balanceDue}}</strong></td></tr>{{/if}}
  </table>
</div>
{{#if invoice.notes}}
<div class="notes">
  <div class="notes-label">Notes</div>
  <div class="notes-text">{{invoice.notes}}</div>
</div>
{{/if}}
{{#if organisation.bankBsb}}
<div class="payment-info">
  <strong>Payment Details</strong><br>
  Bank: {{organisation.bankAccountName}}<br>
  BSB: {{organisation.bankBsb}} &nbsp; Account: {{organisation.bankAccountNumber}}<br>
  Reference: {{invoice.invoiceNumber}}
</div>
{{/if}}
<div class="footer">
  {{organisation.companyName}} {{#if organisation.abn}}| ABN {{organisation.abn}}{{/if}}
</div>
</body>
</html>`;

// ── RCTI / Remittance Template ──

const RCTI_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; padding: 40px; }
  .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
  .company-info { max-width: 50%; }
  .company-name { font-size: 18pt; font-weight: bold; color: #0f172a; }
  .company-details { font-size: 8pt; color: #64748b; margin-top: 4px; line-height: 1.6; }
  .rcti-info { text-align: right; }
  .rcti-title { font-size: 20pt; font-weight: bold; color: #0f172a; }
  .rcti-number { font-size: 11pt; color: #64748b; margin-top: 4px; }
  .rcti-meta { margin-top: 8px; font-size: 9pt; line-height: 1.8; }
  .rcti-meta span { color: #64748b; }
  .contractor-section { background: #f8fafc; padding: 16px; border-radius: 6px; margin-bottom: 24px; }
  .contractor-label { font-size: 8pt; color: #64748b; text-transform: uppercase; }
  .contractor-name { font-size: 12pt; font-weight: 600; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #0f172a; color: white; padding: 8px 12px; text-align: left; font-size: 8pt; text-transform: uppercase; }
  th:last-child { text-align: right; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 9pt; }
  td:last-child { text-align: right; }
  .deduction { color: #dc2626; }
  .section-header { font-size: 10pt; font-weight: 600; margin: 16px 0 8px; color: #0f172a; }
  .totals { float: right; width: 250px; }
  .totals table td { border-bottom: 1px solid #e2e8f0; }
  .totals .total-row { font-weight: bold; font-size: 12pt; background: #0f172a; color: white; }
  .totals .total-row td { border: none; padding: 10px 12px; }
  .payment-info { clear: both; margin-top: 40px; background: #f0f9ff; padding: 12px; border-radius: 6px; font-size: 8pt; }
  .footer { position: fixed; bottom: 30px; left: 40px; right: 40px; text-align: center; font-size: 7pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
</style>
</head>
<body>
<div class="header">
  <div class="company-info">
    <div class="company-name">{{organisation.companyName}}</div>
    <div class="company-details">
      {{#if organisation.abn}}ABN: {{organisation.abn}}<br>{{/if}}
      {{#if organisation.phone}}Ph: {{organisation.phone}}<br>{{/if}}
      {{#if organisation.email}}{{organisation.email}}{{/if}}
    </div>
  </div>
  <div class="rcti-info">
    <div class="rcti-title">REMITTANCE ADVICE</div>
    <div class="rcti-number">RCTI {{rcti.rctiNumber}}</div>
    <div class="rcti-meta">
      <span>Period:</span> {{formatDate rcti.periodStart}} — {{formatDate rcti.periodEnd}}<br>
      {{#if rcti.dueDate}}<span>Payment Due:</span> {{formatDate rcti.dueDate}}{{/if}}
    </div>
  </div>
</div>
<div class="contractor-section">
  <div class="contractor-label">Contractor</div>
  <div class="contractor-name">{{contractor.name}}</div>
  {{#if contractor.abn}}<div style="font-size: 9pt; color: #475569;">ABN: {{contractor.abn}}</div>{{/if}}
</div>
<div class="section-header">Work Items</div>
<table>
  <thead>
    <tr>
      <th>Job</th>
      <th>Description</th>
      <th style="width: 50px">Asset</th>
      <th style="width: 60px">Qty</th>
      <th style="width: 80px; text-align: right">Rate</th>
      <th style="width: 90px; text-align: right">Amount</th>
    </tr>
  </thead>
  <tbody>
    {{#each chargeItems}}
    <tr>
      <td>{{this.sourceJobNumber}}</td>
      <td>{{this.description}}</td>
      <td>{{this.assetRegistration}}</td>
      <td>{{formatNumber this.quantity}}</td>
      <td style="text-align: right">{{formatCurrency this.unitPrice}}</td>
      <td style="text-align: right">{{formatCurrency this.lineTotal}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
{{#if deductionItems.length}}
<div class="section-header">Deductions</div>
<table>
  <thead>
    <tr>
      <th>Category</th>
      <th>Details</th>
      <th style="width: 90px; text-align: right">Amount</th>
    </tr>
  </thead>
  <tbody>
    {{#each deductionItems}}
    <tr class="deduction">
      <td>{{this.deductionCategory}}</td>
      <td>{{this.description}}</td>
      <td style="text-align: right">-{{formatCurrency this.lineTotal}}</td>
    </tr>
    {{/each}}
  </tbody>
</table>
{{/if}}
<div class="totals">
  <table>
    <tr><td>Subtotal</td><td>{{formatCurrency rcti.subtotal}}</td></tr>
    {{#if rcti.deductionsTotal}}<tr><td>Deductions</td><td class="deduction">-{{formatCurrency rcti.deductionsTotal}}</td></tr>{{/if}}
    <tr class="total-row"><td>Net Payable</td><td>{{formatCurrency rcti.total}}</td></tr>
  </table>
</div>
{{#if organisation.bankBsb}}
<div class="payment-info">
  <strong>Payment will be made to your nominated bank account.</strong><br>
  If your bank details have changed, please contact us immediately.
</div>
{{/if}}
<div class="footer">
  This is a Recipient Created Tax Invoice (RCTI). {{organisation.companyName}} {{#if organisation.abn}}| ABN {{organisation.abn}}{{/if}}
</div>
</body>
</html>`;

// ── Compiled Templates ──

const compiledInvoiceTemplate = Handlebars.compile(INVOICE_TEMPLATE);
const compiledRctiTemplate = Handlebars.compile(RCTI_TEMPLATE);

// ── Template Data Interfaces ──

interface InvoicePdfData {
  organisation: {
    companyName: string;
    tradingName?: string | null;
    abn?: string | null;
    phone?: string | null;
    email?: string | null;
    bankBsb?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
  };
  invoice: {
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    poNumber?: string | null;
    subtotal: string | number;
    total: string | number;
    amountPaid?: string | number | null;
    notes?: string | null;
  };
  customer: {
    name: string;
    abn?: string | null;
    email?: string | null;
  };
  lineItems: Array<{
    description: string;
    quantity: string | number;
    unitOfMeasure?: string | null;
    unitPrice: string | number;
    lineTotal: string | number;
  }>;
  isDraft: boolean;
}

interface RctiPdfData {
  organisation: {
    companyName: string;
    abn?: string | null;
    phone?: string | null;
    email?: string | null;
    bankBsb?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
  };
  rcti: {
    rctiNumber: string;
    periodStart: string;
    periodEnd: string;
    dueDate?: string | null;
    subtotal: string | number;
    deductionsTotal?: string | number | null;
    total: string | number;
  };
  contractor: {
    name: string;
    abn?: string | null;
  };
  chargeItems: Array<{
    sourceJobNumber?: string | null;
    description: string;
    assetRegistration?: string | null;
    quantity: string | number;
    unitPrice: string | number;
    lineTotal: string | number;
  }>;
  deductionItems: Array<{
    deductionCategory?: string | null;
    description: string;
    lineTotal: string | number;
  }>;
}

// ── HTML Rendering ──

export function renderInvoiceHtml(data: InvoicePdfData): string {
  const subtotal = Number(data.invoice.subtotal);
  const total = Number(data.invoice.total);
  const amountPaid = Number(data.invoice.amountPaid ?? 0);

  return compiledInvoiceTemplate({
    ...data,
    gstAmount: (total - subtotal).toFixed(2),
    balanceDue: (total - amountPaid).toFixed(2),
  });
}

export function renderRctiHtml(data: RctiPdfData): string {
  return compiledRctiTemplate(data);
}

/**
 * Render HTML to PDF using Puppeteer.
 * Returns the PDF as a Buffer.
 */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "20mm", left: "10mm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Generate invoice PDF and return as Buffer.
 */
export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  const html = renderInvoiceHtml(data);
  return htmlToPdf(html);
}

/**
 * Generate RCTI/remittance advice PDF and return as Buffer.
 */
export async function generateRctiPdf(data: RctiPdfData): Promise<Buffer> {
  const html = renderRctiHtml(data);
  return htmlToPdf(html);
}
