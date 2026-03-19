# 08 — Dockets & Daysheets

## Overview

The docket and daysheet system is where operational work gets recorded and turned into financial data. It's the bridge between "the job happened" and "here's the invoice."

Two fundamentally different document types feed into this system:

- **Daysheets** — The driver's working record of what they did. One per job per day (sometimes more). This is the primary record of work performed. Company drivers also use daysheets as the basis for timesheets.
- **Dockets** — External documents from suppliers (weighbridge tickets, tip receipts, delivery receipts). These may or may not exist for a job. When they do, they serve as supporting evidence that gets reconciled against the daysheet.

Nexum mixes these together under one "docket" concept. The rebuild treats them as separate document types with their own workflows, but always linked to the same job.

## Daysheets — The Primary Work Record

### What a daysheet captures
A daysheet is the driver's record of work performed on a job:

- Job reference (which job this work belongs to)
- Driver and asset identification
- Date of work
- Load details: how many loads, material type, quantity per load, unit of measure
- For tonnage work: gross weight, tare weight, net weight (calculated)
- For hourly work: start time, end time, hours worked, overtime hours, break deductions
- Pickup and delivery locations visited
- Notes and special observations

### Daysheet submission
Daysheets can be submitted through multiple channels:

- **DriverX app** — The primary path for drivers with the mobile app. Pre-fills job details, captures load data per trip, records times automatically. Company drivers using DriverX get their timesheet data captured as part of the daysheet submission.
- **Portal upload** — Contractors submit daysheets via the portal. Photo of paper daysheet or digital submission.
- **Staff entry** — Office staff manually enter daysheets from paper records or phone calls. Essential for drivers without DriverX access.
- **Auto-generation** — For completed jobs with company-owned assets, the system can auto-generate a daysheet with estimated quantities from the job's material data. Staff then review and adjust.

### Daysheet as timesheet basis
For company drivers, the daysheet captures the time data that feeds into timesheets (doc 03). Start/end times, hours worked, overtime, and break deductions are all captured on the daysheet. This eliminates double-entry — the driver records their work once, and it flows into both the job's operational record and their timesheet.

DriverX will automate most of this capture, but manual entry and editing must always be supported.

## Dockets — External Supporting Documents

### What dockets are
Dockets are external documents obtained from third parties — primarily suppliers and disposal sites:

- **Weighbridge tickets** — Weight records from weighbridges at quarries, disposal sites, or public scales
- **Tip receipts** — Receipts from disposal sites confirming material accepted and tip fees
- **Delivery receipts** — Signed confirmation of material delivered to a customer site
- **Collection receipts** — Confirmation of material collected from a source

### When dockets exist
Not every job produces external dockets. A hire job (vehicle on-site for the day) may have no dockets at all — just a daysheet. A quarry-to-site delivery may produce weighbridge tickets at the quarry. A disposal job produces tip receipts at the disposal site.

### Docket-to-daysheet reconciliation
When dockets exist, they're matched against the daysheet for verification:

- Weighbridge ticket shows 22.5 tonnes loaded. Daysheet says 22.5 tonnes delivered. Match confirmed.
- Tip receipt shows 3 loads accepted. Daysheet records 3 loads tipped. Match confirmed.
- If quantities don't match, the discrepancy is flagged for review.

This reconciliation is where overages, shortfalls, and errors are caught.

## AI Docket Reading

### OCR and AI parsing
When a docket image (photo of weighbridge ticket, tip receipt, etc.) is uploaded, AI reads the document and pre-populates fields:

- Extract gross weight, tare weight, net weight from weighbridge tickets
- Extract material type, quantity, and date from tip receipts
- Extract load count, material, and customer details from delivery dockets
- Pre-fill the docket form — human reviews and confirms before processing

This uses the provider-flexible AI architecture (doc 06) — the same abstracted AI interface that handles job parsing. Different docket formats from different suppliers are handled through the AI's ability to interpret varied layouts.

### Confidence and manual fallback
AI extraction includes a confidence score per field. Low-confidence fields are highlighted for human attention. The system always requires human confirmation before processing — AI pre-fills, humans verify.

For dockets that AI can't read (poor quality images, unusual formats), full manual entry remains available.

## Processing Workflow

### Daysheet processing
The daysheet is the primary record that drives financial data:

1. **Submitted** — Daysheet data entered (via DriverX, portal, or staff entry)
2. **Review** — Staff reviews the daysheet data. Load quantities, times, materials confirmed.
3. **Reconciled** — If external dockets exist, they're matched against the daysheet. Discrepancies flagged.
4. **Processed** — Charge lines created from the daysheet data. Job actuals updated. RCTI created/updated for contractor assets.

### Docket processing
Dockets follow the daysheet — they're supporting evidence, not the primary record:

1. **Uploaded** — Docket image/document uploaded. AI extracts data where possible.
2. **Matched** — Docket matched to the relevant daysheet/job.
3. **Reconciled** — Quantities compared to the daysheet. Discrepancies flagged.
4. **Filed** — Docket stored as supporting evidence linked to the daysheet.

### Charge creation
When a daysheet is processed, the system creates charge lines:

- Reads the job's pricing template lines (from doc 09)
- Creates one charge per pricing line, using the daysheet's quantities
- **Revenue lines** — What the customer pays (cartage, material, tip fees)
- **Cost lines** — What the tenant pays out (subcontractor rates, material costs)
- Links each charge to its source pricing line for traceability
- Skips contractor cost lines for customer-supplied assets

Charge lines are editable after creation — staff can adjust quantities, rates, or parties before invoicing. Edited lines are flagged as overrides.

### RCTI auto-creation
For contractor-supplied assets, processing automatically creates or updates an RCTI (Recipient Created Tax Invoice — doc 10):

- Finds or creates an RCTI for the contractor for the current period
- Adds a line item with the contractor's rate × quantity
- Includes travel fees for hourly jobs
- Updates RCTI totals

### Job actuals update
Processing recalculates the job's actual totals: total tonnes/cubic metres delivered, total hours worked, total loads completed. These actuals update the job record and are visible in job reporting.

## Batch and Auto-Processing

### Auto-processing for clean data
Daysheets that match expected values within configurable tolerances auto-process without human intervention:

- Quantities within X% of the job's estimated quantities
- Weights within asset payload limits
- No overage flags
- All required fields present
- Dockets (if any) reconcile without discrepancy

Auto-processed daysheets are flagged as such — staff can review them after the fact but don't need to manually process each one.

### Batch processing for manual review
For daysheets that need human review, batch processing lets staff work through them efficiently:

- Select multiple daysheets and process them in one workflow
- Review exceptions only — auto-approved items are pre-checked
- Bulk approve or reject
- Process all selected daysheets with one action

### The goal: minimal human effort
Between DriverX automation, AI docket reading, and auto-processing, the majority of routine dockets should flow through with minimal human intervention. Staff focus on exceptions, discrepancies, and overages — not on typing numbers from paper into screens.

## Overage Detection and Approval

### What triggers an overage
An overage is flagged when actual quantities exceed limits:

- **Asset payload overage** — Net weight exceeds the asset's calculated payload capacity (from GVM/tare). This is a compliance and safety issue.
- **Asset volume overage** — Volume exceeds the asset's maximum volume capacity.
- **Contract limit overage** — Quantity exceeds the job's contracted maximum payload. This affects payment — the contract caps what's payable.

### Improved overage approval
The overage approval process needs improvement over Nexum in three areas:

**Streamlined approval process:**
- One-click approve/reject for simple overages
- Bulk overage approval for processing days with many flagged items
- Configurable approval routing — minor overages (within a secondary tolerance) auto-approve, significant overages route to appropriate personnel
- Clear distinction between "this needs approval" and "this needs investigation"

**Smarter capping logic:**
- Contract limits cap payable quantity (carry forward from Nexum)
- Configurable tolerance thresholds — a 0.5% overage on a 25-tonne load (125kg) shouldn't trigger the same workflow as a 10% overage
- Per-material or per-customer tolerance settings
- Automatic capping with notification vs. full approval workflow based on overage severity

**Pattern detection:**
- Track overages by driver, asset, route, customer, and material
- Identify systemic issues: a driver who consistently overloads, an asset with a potentially incorrect tare weight, a quarry whose weighbridge may be miscalibrated
- Dashboard showing overage trends over time
- Alerts for repeated overages that may indicate a compliance or safety issue
- Feed into the compliance system — repeated overloading is a chain of responsibility (CoR) issue

## Weight and Time Calculations

### Weight calculations
For tonnage work:
- Gross weight (loaded) entered from weighbridge ticket or daysheet
- Tare weight (empty) entered from known vehicle tare or weighbridge
- Net weight = gross - tare (auto-calculated)
- Payable weight = lesser of net weight and contract limit (if applicable)

### Time calculations
For hourly work:
- Start time and end time
- Hours worked (calculated from times)
- Overtime hours (beyond standard shift — classification from doc 03)
- Break deductions (automatic or manual — lunch, smoko, etc.)
- Total billable hours = hours worked + overtime - breaks

Time entries can be multiple per day (a driver might have a morning session and afternoon session). The system aggregates these into the daysheet's total.

## File Storage and Attachments

### Document storage
All uploaded files (docket images, daysheet scans, weighbridge tickets) are stored in cloud storage (S3 or equivalent):

- Organised by job number, asset registration, and document type
- Original filename, file size, and MIME type tracked
- Secure access via time-limited presigned URLs
- Supports PDF, JPEG, PNG, and other common formats

### Inline viewing
Documents can be viewed inline in the processing UI without downloading — the system fetches the file and displays it alongside the data entry form. This is essential for staff who are comparing a weighbridge ticket image to the numbers they're entering.

## What's Different from Nexum

| Aspect | Nexum | Rebuild |
|--------|-------|---------|
| Document types | Mixed "docket" concept | Separate daysheets (primary) and dockets (supporting evidence) |
| Daysheet as timesheet | Separate systems | Company driver daysheet feeds directly into timesheet |
| AI/OCR | None | AI reads docket images and pre-populates fields |
| Processing | One at a time, manual | Auto-processing for clean data + batch processing for exceptions |
| Overage approval | Cumbersome, no pattern detection | Streamlined (one-click, bulk), tolerance tiers, pattern detection |
| Overage → compliance | No link | Repeated overages feed into compliance system (CoR) |
| DriverX integration | Portal upload | DriverX primary submission with auto time capture |
| Reconciliation | Implicit | Explicit docket-to-daysheet reconciliation with discrepancy flagging |
| Charge creation | Per-docket | Per-daysheet (primary record), dockets are supporting evidence |

---

*Status: Approved — reviewed and approved by Ryan*
*Created: 2026-03-19 | Session 2*
