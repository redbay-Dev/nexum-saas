# 10 — Invoicing & RCTI

> How customer invoices and contractor RCTIs are generated, approved, sent, paid, and reconciled.

---

## Overview

Nexum's financial output has two sides: **invoices** (customer charges — accounts receivable) and **RCTIs** (contractor payments — accounts payable). Both flow from the same job pricing lines documented in doc 09, diverging by line type: revenue lines become invoices, cost lines become RCTIs.

The invoicing system carries forward from Nexum with one key completion: **split invoicing for multi-customer jobs** is properly finished. Everything else — scheduling, grouping, RCTI periods, deductions, credit management, remittance — is proven and carries forward.

RCTI progression is approval-driven, not automatic (DEC-067). RCTIs don't advance until the corresponding invoice is generated, paid, or approved by designated staff.

---

## Customer Invoicing

### Invoice Creation

Invoices are created from processed job pricing lines. The invoice builder pulls revenue lines where daysheets have been processed and actuals are confirmed. An invoice can contain lines from **multiple jobs** — the builder groups jobs based on customer invoice settings.

### AR Approval

Before a job's pricing lines can flow into an invoice, the job must pass **AR approval**. This is the quality gate between operations and finance:

- AR reviewer checks that dockets are processed, quantities are correct, pricing is accurate
- Jobs can be approved individually or in batch
- Rejected jobs return to operations with notes for correction
- Permission-controlled: requires `accounts.ar.approve`

### Invoice Scheduling

Each customer has configurable invoice timing:

- **On completion** — Invoice generated as soon as the job is AR-approved
- **Daily** — Jobs batched and invoiced daily
- **Weekly** — Jobs batched and invoiced weekly (configurable day)
- **Fortnightly** — Jobs batched and invoiced every two weeks
- **Monthly** — Jobs batched and invoiced monthly (configurable date)

The system calculates when each customer is due for invoicing and surfaces a queue of ready-to-invoice customers.

### Invoice Grouping

Within a scheduled invoice run, jobs can be grouped in different ways per customer:

- **Per job** — One invoice per job (simplest, most transparent)
- **Per PO** — Jobs sharing a purchase order number grouped onto one invoice
- **Per project** — Jobs under the same project grouped together
- **Per site** — Jobs at the same location grouped together
- **Combine all** — All jobs in the period on a single invoice

Grouping is a customer-level setting. The builder suggests groups based on the configuration, the user confirms or adjusts before generating.

### Split Invoicing (Multi-Customer Jobs)

Jobs with multiple customers (DEC-045) generate separate invoices for each customer. This is properly completed in the rebuild:

- Each pricing line's `party_id` determines which customer receives that charge
- The builder filters lines per customer and generates separate invoices
- Each invoice only shows that customer's lines and totals
- Configuration per job: how to split (by allocation amount or percentage), whether to combine materials, whether tip fees are separate, tax handling per customer
- Split invoices are linked via a group reference for tracking

### Invoice Line Items

Each invoice line captures:

- Line number, description, quantity, unit of measure, unit price, line total, account code
- Source reference: which job, which pricing line, which docket
- **Pricing snapshot** — JSON capturing the exact rates, material, tax, and quantities at the time of invoicing
- **Snapshot timestamp** — When the snapshot was taken
- **Calculation method** — Human-readable description of how the total was derived (e.g. "100t @ $50/t = $5,000")

Snapshots ensure the invoice is a permanent record. Even if rates change later, the invoice shows exactly what was billed and how.

### Invoice Status Flow

**Draft** → **Verified** → **Sent** → **Paid**

With branches:

- Draft → Rejected (returns to operations for correction)
- Sent → Partial (partial payment received)
- Sent → Overdue (payment due date passed)
- Any pre-sent status → Cancelled

**Verification** is a finance review step: the verifier checks line items, attaches supporting documents (weighbridge tickets, daysheets), sets document preferences (which attachments to include), and marks the invoice as ready to send. Verification records who verified, when, and any notes.

### Invoice Numbering

Configurable per tenant via invoice sequences:

- **Prefix** and **suffix** — e.g. "INV-", "-FTG"
- **Next number** — Auto-incrementing
- **Minimum digits** — Zero-padded (e.g. 4 digits → INV-0001)
- **Sequence type** — Separate sequences for invoices and RCTIs

---

## RCTI System (Recipient Created Tax Invoices)

### What RCTIs Are

RCTIs are invoices that the tenant creates **on behalf of** contractors for work performed. Instead of the contractor sending an invoice, the tenant generates one from the processed daysheet data. This is standard practice in Australian transport — the tenant knows the quantities and rates, so they create the tax invoice.

### Period-Based Generation

RCTIs are generated for defined payment periods, not per job. A contractor's RCTI covers all work across all jobs within the period.

**Payment frequency options** (tenant-configurable):

- **Weekly** — One RCTI per week per contractor
- **Bi-monthly** — Two periods per month (e.g. 1st–15th and 16th–end)
- **Monthly** — One RCTI per month per contractor

**Period configuration:**

- Payment days (for bi-monthly: which days of the month mark period boundaries)
- Cutoff time — Work completed before this time falls into the current period; after goes into the next
- Payment terms — Days after period end until payment is due (default 7)

### RCTI Status Flow

**Draft** → **Accumulating** → **Ready** → **Pending Approval** → **Approved** → **Sent** → **Paid**

With branches:

- Any pre-approved status → Cancelled
- Sent → Partial (partial payment)
- Sent → Disputed (contractor disputes the RCTI)

Each status serves a purpose:

- **Draft** — RCTI created, period open, items may still be added
- **Accumulating** — Period active, daysheets still being processed for this period
- **Ready** — Period closed, all dockets processed, RCTI complete and ready for review
- **Pending Approval** — Submitted for manager approval (if approval required)
- **Approved** — Approved by designated staff, ready for payment/sending
- **Sent** — Sent to Xero as a bill and/or remittance emailed to contractor
- **Paid** — Payment confirmed (from Xero sync or manual entry)

### RCTI Item Population

RCTI line items are populated from processed daysheets:

- All daysheets for the contractor within the period
- Quantities and rates from the corresponding job pricing cost lines
- Each line references: job, docket, asset, material, unit of measure
- Line totals calculated from actual quantities × contracted rates

### Deduction Management

Deductions are charges against the contractor that reduce their RCTI amount. They're added as line items with `line_type = 'deduction'` and negative amounts.

**Deduction categories:**

- **Yard parking** — Charges for using tenant's yard
- **Fuel usage** — Fuel supplied by tenant
- **Overload penalty** — Penalty for exceeding mass limits
- **Tip fee adjustment** — Adjustment to disposal charges
- **Driver error** — Costs incurred due to contractor driver errors
- **Other** — Miscellaneous with required description

Each deduction requires: category, details/reason, and the creating user. Deductions are visible to the contractor on the remittance advice for transparency.

### Batch RCTI Generation

At period close, the system generates RCTIs for all contractors with work in that period. This is a batch operation:

- Generates one RCTI per contractor
- Groups all RCTIs into a batch for tracking (batch number, contractor count, total amount)
- Auto-generation available if configured — triggered when the period closes
- Batch can be reviewed before individual RCTIs are approved

### RCTI Approval Workflow

RCTI progression gates on invoice status and staff approval (DEC-067):

1. **Period closes** → RCTIs generated (auto or manual batch)
2. **Review** — Finance reviews each RCTI: check quantities, rates, deductions
3. **Approval gate** — RCTI doesn't progress until the corresponding customer invoice is generated/paid/approved by designated staff (tenant-configurable which gate)
4. **Manager approval** — If `require_approval` is enabled, designated staff must approve
5. **Preserved date reached** — Once the RCTI reaches its payment due date, user can batch-send remittances

This ensures contractors aren't paid for work that hasn't been invoiced to the customer, maintaining cash flow alignment.

---

## RCTI Configuration

Tenant-level settings controlling the entire RCTI workflow:

### Payment Settings
- **Payment frequency** — Weekly, bi-monthly, or monthly
- **Payment days** — Day-of-month markers for bi-monthly periods
- **Cutoff time** — Hour cutoff for period inclusion (default 17:00)
- **Payment terms** — Days until payment due after period end

### Automation Settings
- **Auto-generate** — Automatically create RCTIs when period closes
- **Require approval** — Whether manager approval is needed before sending
- **GST inclusive** — Whether contractor rates include GST

### Remittance Settings
- **Auto-email on approval** — Send remittance immediately after approval
- **Include docket images** — Attach docket images to remittance PDF
- **Email stagger** — Seconds between emails to avoid rate limits
- **Subject template** — Customisable email subject (supports placeholders: {rcti_number}, {company_name}, {period})
- **Body template** — Customisable email body (HTML with placeholders)

---

## Remittance Advice

### What Gets Sent

When an RCTI is approved and ready for payment, a remittance advice is generated and sent to the contractor:

- **PDF document** containing: RCTI number, period dates, contractor details, line items with job references, deductions, totals, payment due date, bank details
- **Docket images** — Optionally included as proof of work (weighbridge tickets, daysheets)
- **Email delivery** — Sent to the contractor's nominated email address

### Email Delivery

Remittance emails go through the email queue with retry logic:

- Queued with status tracking (pending → sent → failed)
- Retry on failure (configurable max retries, default 3)
- Staggered sending to avoid rate limits
- Delivery tracking: sent timestamp, error messages if failed
- Batch sending: all approved RCTIs for a period can be emailed at once

### Auto-Email Flow

If `auto_email_on_approval` is enabled:
1. RCTI approved → remittance PDF generated
2. Email queued with stagger delay
3. Email sent → `remittance_emailed_at` recorded
4. Contractor receives PDF with all supporting documentation

---

## Payment Tracking

### Recording Payments

Payments are recorded against invoices or RCTIs:

- **Payment date** — When the payment was made
- **Amount** — Payment amount
- **Payment method** — EFT, cheque, etc.
- **Reference number** — Bank reference for reconciliation
- **Xero payment ID** — If synced from Xero

### Partial Payments

Multiple payments can be recorded against a single invoice or RCTI:

- Each payment is a separate record
- Running total tracked on the invoice/RCTI (`amount_paid`)
- Status updates automatically: Sent → Partial (some paid), Partial → Paid (fully paid)
- Outstanding amount = total - amount_paid

### Overdue Detection

Invoices that pass their payment due date without full payment are flagged as overdue. This feeds into the credit monitoring system and customer account management.

---

## Credit Management

### Credit Limit System

Carries forward from Nexum — the credit system tracks customer exposure in real-time:

- **Credit limit** — Set per customer
- **Credit used** — Calculated from: outstanding invoices + estimated cost of open jobs - unallocated payments
- **Credit available** — Limit minus used
- **Warning threshold** — Default 80% utilisation, configurable per customer
- **Credit stop** — Manual block preventing new jobs for this customer

### Automatic Transaction Recording

Credit usage updates automatically on financial events:

- Invoice created → charge recorded (increases credit used)
- Payment received → payment recorded (decreases credit used)
- Job completed → estimated amount removed (adjusts credit used)
- Job cancelled → estimated amount removed

### Over-Limit Approvals

When a job would push a customer over their credit limit:

1. User without `credit.override` permission is blocked
2. System creates an approval request with: customer details, estimated amount, current credit status
3. User with `credit.approve` permission reviews and decides
4. Approved → job proceeds. Rejected → job blocked with reason.
5. Decision recorded: who, when, why (audit trail)

### Credit Monitoring Dashboard

Real-time view of all customers' credit positions:

- Credit limit, used, available, percentage
- Outstanding invoice count and amount
- Open jobs amount (estimated future invoicing)
- Last payment date
- Credit stop status
- Sortable and filterable for quick identification of at-risk accounts

---

## Contractor Payment Summary

Finance needs visibility into contractor payments beyond individual RCTIs:

- **Per contractor**: Period total, year-to-date (Australian financial year July–June), all-time total
- **GST totals** — Separate GST tracking for BAS reporting
- **Outstanding amount** — Unpaid RCTIs
- **Last payment date** — When the contractor was last paid
- **RCTI count** — Number of RCTIs in each period
- **Drill-down** — From summary to individual RCTI detail

---

## Document Attachments & Public Links

### Supporting Documents on Invoices

Invoices can include supporting documentation:

- **Weighbridge tickets** — Weight evidence for tonnage-based billing
- **Daysheets** — Driver work records
- **Supporting documents** — Any other relevant attachments

Document inclusion is configurable per invoice via document preferences. The verifier chooses which attachments to include before sending.

### Public Document Links

For document sharing (email attachments, portal access), the system generates public links:

- URL-safe unique ID (no authentication required to view)
- Access tracking: view count, last accessed timestamp
- Document type classification (weighbridge, supporting, daysheet, invoice)
- Links attached to invoices for customer self-service access

---

## Financial Immutability

### What's Protected

Once an invoice is **sent** (to Xero or directly) or an RCTI is **approved**, the financial record becomes immutable:

- Line items cannot be modified
- Amounts cannot be recalculated
- Only status transitions are allowed (sent → paid, approved → sent)
- Enforced at the database level, not just the application

### Correction Mechanism

If an error is found after sending:

- **Credit note** — Issue a credit note against the original invoice for the incorrect amount
- **New invoice** — Generate a corrected invoice
- The original invoice remains in the system as-is for audit purposes

### 7-Year Retention

Australian tax law requires 7-year record retention. Financial records (invoices, RCTIs, payments, credit transactions) are retained for the full period. Archived data can be moved to cold storage while remaining accessible for audit.

### Audit Trail

Every financial action is logged:

- Invoice creation, verification, rejection, sending, payment
- RCTI generation, approval, sending, payment
- Credit limit changes, credit stop actions, over-limit approvals
- Who performed the action, when, what changed (old values → new values)

---

## Permissions

Financial operations are permission-controlled:

### Accounts Receivable
- `accounts.invoices.view` — View invoices
- `accounts.invoices.verify` — Verify and reject invoices
- `accounts.invoices.send_xero` — Send invoices to Xero
- `accounts.ar.approve` — Approve jobs for invoicing

### Accounts Payable
- `accounts.rcti.view` — View RCTIs
- `accounts.rcti.approve` — Approve RCTIs
- `accounts.rcti.regenerate` — Regenerate RCTI items
- `accounts.ap.review` — Review supplier invoices

### Credit Management
- `credit.view` — View credit monitoring dashboard
- `credit.manage` — Set and modify credit limits
- `credit.approve` — Approve over-limit jobs
- `credit.override` — Bypass credit limits (use with caution)

---

## Supplier Invoices (AP Beyond RCTI)

Not all accounts payable is contractor RCTIs. Tenants also receive invoices from external suppliers that need to be recorded and reconciled against job costs.

### Supplier Invoice Types

- **Tip fee invoices** — Disposal sites invoice the tenant for tipping charges
- **Material purchase invoices** — Quarries and suppliers invoice for materials bought
- **Hire charges** — Third-party equipment hire invoices
- **Fuel invoices** — Bulk fuel supplier invoices

### Recording & Matching

Supplier invoices are entered into the system (manually or via document upload with AI extraction per doc 08 principles) and matched against job cost lines:

- Each supplier invoice line is matched to the corresponding job pricing cost line
- The system highlights discrepancies: supplier invoiced $32/t but job cost line shows $30/t
- Matched invoices update the job actuals with confirmed supplier costs
- Unmatched lines are flagged for review — they may indicate missing job entries or incorrect pricing

### AP Review Workflow

Supplier invoices go through AP review before being approved for payment:

- Upload/enter the supplier invoice
- System suggests matches against pending job cost lines
- Reviewer confirms matches, resolves discrepancies
- Approved invoices sync to Xero as bills
- Permission-controlled: requires `accounts.ap.review`

### Missing Supplier Invoice Detection

The system tracks which job cost lines have corresponding supplier invoices and which don't. At period close, finance can see a report of expected but missing supplier invoices — useful for chasing suppliers and ensuring all costs are captured before closing a period.

---

## Customer & Contractor Statements

### Customer Statements

Formal account statements sent to customers showing their financial position:

- **Statement period** — Configurable (monthly, on-demand)
- **Content** — All invoices, payments, credits, and adjustments within the period
- **Running balance** — Opening balance + charges - payments = closing balance
- **Ageing** — Outstanding amounts broken down by age (current, 30 days, 60 days, 90+ days)
- **PDF generation** — Branded statement document
- **Batch sending** — Generate and email statements for all customers (or filtered set) in one operation

Statements support debt collection: the ageing breakdown shows at a glance which customers have overdue balances and how long they've been outstanding.

### Contractor Statements

Similar statements for contractors showing their RCTI and payment history:

- All RCTIs, payments, deductions, and adjustments within the period
- Running balance showing what's been paid and what's outstanding
- Supports contractor account transparency (doc 02 requirement)

---

## Invoice Dispute Handling

### Customer Disputes

When a customer queries an invoice, the system tracks the dispute:

- **Dispute flag** — Invoice marked as disputed with reason
- **Dispute notes** — Running log of communications and investigation
- **Resolution tracking** — What action was taken (credit note, adjustment, explanation accepted)
- **Resolution status** — Open, investigating, resolved, closed
- **Dispute age** — Days since dispute raised, for SLA tracking

Disputes don't change the invoice status (it remains "sent") but add a dispute overlay that's visible in invoice lists and dashboards. This prevents disputes from getting lost in email threads.

### Dispute Resolution Actions

- **Explanation accepted** — Customer accepts the invoice as-is after explanation
- **Credit note issued** — Partial or full credit note against the disputed amount
- **Invoice replaced** — Original cancelled, new corrected invoice issued
- **Adjustment applied** — Credit or adjustment on the next invoice

Each resolution is recorded with who resolved it, when, and what action was taken.

---

## Batch Invoice Generation

### Scheduled Billing Runs

For customers on periodic invoicing (weekly, fortnightly, monthly), the system supports batch invoice generation:

- **Billing run queue** — Shows all customers due for invoicing in the current period, with job counts and estimated totals
- **Preview before generating** — Review the proposed invoices (which jobs, which grouping, estimated totals) before committing
- **Batch generate** — Create all invoices in one operation
- **Batch verify** — Review and verify multiple invoices in sequence
- **Batch send** — Send all verified invoices to Xero and/or email in one operation

This replaces generating invoices one customer at a time. A monthly billing run for 50 customers should be a single workflow, not 50 individual operations.

### Billing Run Report

After a batch run, a summary report shows:

- Invoices generated (count and total value)
- Invoices skipped (no AR-approved jobs, or below minimum threshold)
- Errors or exceptions requiring attention
- Comparison to previous period (trend)

---

## Invoice PDF Preview

### Preview Before Sending

Before an invoice is finalised and sent, finance can preview exactly what the customer will receive:

- **Formatted PDF** — The actual invoice document as it will appear, with branding, line items, totals, and tax
- **Attached documents** — Preview which supporting documents (weighbridge tickets, daysheets) are included
- **Email preview** — See the email body and subject line as the customer will receive it

Preview is available at the verification stage. The verifier can adjust document preferences, reorder attachments, and confirm the final output before marking as verified.

### Draft Watermark

Previewed invoices show a "DRAFT" watermark to prevent confusion if printed or screenshot before finalisation. The watermark is removed when the invoice status moves to "sent".

---

## Key Decisions for This Document

| Decision | Summary |
|----------|---------|
| DEC-067 | RCTI progression gates on invoice status and staff approval |
| DEC-079 | All invoice scheduling and grouping options carry forward, split invoicing properly completed |
| DEC-080 | Full RCTI status flow and deduction management carry forward |
| DEC-081 | AR approval and credit limit system carry forward as-is |
| DEC-082 | Remittance advice with PDF, docket images, auto-email, staggered sending all essential |
| DEC-083 | Supplier invoice recording with job cost matching and AP review workflow |
| DEC-084 | Formal customer and contractor statements with ageing and batch sending |
| DEC-085 | Invoice dispute tracking with resolution workflow on the AR side |
| DEC-086 | Batch invoice generation for scheduled billing runs with preview and reporting |
| DEC-087 | Invoice PDF preview at verification stage before sending |
