# 11 — Xero Integration

> How Nexum connects to Xero for accounting, invoicing, payments, and financial reporting.

---

## Overview

Nexum's Xero integration is rebuilt as a **complete, bidirectional accounting bridge**. The current Nexum integration is primarily one-way (Nexum → Xero) with payment polling as the only return path. The rebuild addresses every gap: credit note sync, dynamic account mapping, tracking categories, proper tax handling, webhooks, and full bidirectional data flow.

Xero remains the source of truth for accounting. Nexum is the source of truth for operations. The integration keeps both systems in sync without requiring double-entry.

---

## Authentication & Connection

### OAuth2 with PKCE

Connection to Xero uses OAuth2 with PKCE (Proof Key for Code Exchange):

1. Admin initiates connection from Settings → Integrations → Xero
2. Browser window opens to Xero's authorisation page
3. User grants permissions (transactions, contacts, organisation, offline access)
4. Xero redirects with authorisation code
5. Code exchanged for access token + refresh token
6. Tokens stored encrypted per tenant

### Token Management

- **Access token** — 30-minute expiry, auto-refreshed 5 minutes before expiry
- **Refresh token** — 60-day expiry, refreshed on each use
- **Automatic reconnection** — If refresh fails, admin is notified to re-authorise
- **Tenant mapping** — Each Nexum tenant connects to one Xero organisation via the Xero tenant ID

### Multi-Organisation Support

A single Nexum tenant connects to one Xero organisation. If a tenant operates multiple Xero organisations (rare), this is handled at the Nexum tenant level — each Nexum tenant maps to its own Xero org.

---

## Contact Sync

### Bidirectional Contact Management

Contacts sync between Nexum business companies and Xero contacts:

**Nexum → Xero:**
- New companies auto-create Xero contacts (configurable per tenant)
- Company updates push to Xero (name, ABN, email, phone, payment terms)
- Role mapping: `is_customer` → Xero customer, `is_contractor`/`is_supplier` → Xero supplier
- Companies with both customer and supplier roles sync as both in Xero

**Xero → Nexum:**
- Payment terms pulled from Xero when linking contacts
- Payment status updates flow back (via payment sync)
- New contacts created in Xero can be imported into Nexum (manual trigger)

### Contact Linking

- **Auto-link** — New Nexum companies auto-create and link Xero contacts
- **Manual link** — Existing Nexum companies can be linked to existing Xero contacts via dropdown
- **Unlink** — Remove the Xero association without deleting either record
- **Duplicate detection** — When auto-creating, check for existing Xero contact with same name/ABN to avoid duplicates

### Field Mapping

| Nexum | Xero |
|-------|------|
| Company name | Name |
| Trading name | FirstName (if different from name) |
| ABN | TaxNumber |
| Primary email | EmailAddress |
| Primary phone | Phones[DEFAULT] |
| Payment terms | PaymentTerms (sales/bills) |
| Is customer | IsCustomer |
| Is contractor/supplier | IsSupplier |

### Payment Terms Mapping

Nexum payment terms map to Xero's payment term types:

- COD → Days After Bill Date (0 days)
- Net 7/14/30/45 → Days After Bill Date (N days)
- EOM → Of Following Month (0 days)
- EOM+30/45/60 → Of Following Month (N days)

Bidirectional — pulling terms from Xero converts back to Nexum's format.

---

## Invoice Sync (Accounts Receivable)

### Nexum → Xero (ACCREC)

Verified invoices push to Xero as sales invoices:

**Process:**
1. Invoice verified in Nexum (doc 10 verification workflow)
2. User sends to Xero (individual or batch)
3. System validates: customer has Xero contact ID, all line items have account codes
4. Invoice created in Xero as ACCREC with status AUTHORISED
5. Xero returns invoice ID → stored on Nexum invoice
6. Invoice becomes immutable in Nexum
7. Sync logged to audit trail

**Line Item Mapping:**
- Description: "{Job Number} - {Line Description}"
- Quantity, unit price, line total from pricing snapshot
- Account code from dynamic mapping (see Account Codes section)
- Tax type from tax mapping (see Tax Handling section)

**Attachments:**
- Supporting documents (weighbridge tickets, daysheets) attached to Xero invoice
- Documents downloaded from storage and uploaded as Xero attachments
- Public document link added to invoice reference for customer self-service

**Batch Processing:**
- Send multiple invoices in one operation
- Xero API limit: 50 invoices per API call
- Throttling: 1-second delay between batch requests
- Per-item result tracking: success, failed, or skipped (already synced)
- Failed items don't block successful ones

### Xero → Nexum (Invoice Updates)

- Status changes pulled from Xero (AUTHORISED → PAID, VOIDED)
- Amount paid updates flow back to Nexum
- Voided invoices in Xero update Nexum status to cancelled
- Online invoice views tracked (if Xero provides view data)

---

## Credit Note Sync

### Nexum → Xero

Credit notes created in Nexum (doc 10 correction mechanism) sync to Xero:

- Credit note pushed as Xero credit note (ACCECCREDIT) against the original invoice
- Line items map the same way as invoices
- Credit note allocation: system specifies which invoice the credit applies to
- Xero tracks the credit balance on the customer's account

### Application

- Full credit notes cancel the entire invoice amount
- Partial credit notes reduce the outstanding balance
- Unallocated credits remain on the customer's Xero account for future application
- Credit note amounts update Nexum's credit tracking system

---

## RCTI/Bill Sync (Accounts Payable)

### Nexum → Xero (ACCPAY)

Approved RCTIs push to Xero as bills:

**Process:**
1. RCTI approved in Nexum (doc 10 approval workflow)
2. System validates: contractor has Xero contact ID (auto-creates if missing)
3. Bill created in Xero as ACCPAY with status AUTHORISED
4. Xero returns bill ID → stored on Nexum RCTI
5. RCTI becomes immutable in Nexum
6. Sync logged to audit trail

**Line Item Mapping:**
- Description includes job references and period information
- Account code from dynamic mapping
- Deductions sync as negative line items
- Reference: "RCTI {number} - Period {start} to {end}"

**Batch Processing:**
- Pre-fetch existing Xero suppliers in batch
- Auto-create missing supplier contacts in batch (up to 50)
- Send bills in batches of 50
- Per-item success/failure tracking

### Supplier Invoice Sync

Supplier invoices entered in Nexum (doc 10 AP beyond RCTI) also sync to Xero:

- Approved supplier invoices push as ACCPAY bills
- Supplier contact used (or auto-created)
- Job reference included for traceability

---

## Payment Sync

### Webhooks (Primary)

The rebuild uses Xero webhooks for real-time payment notifications:

- **Webhook endpoint** — Nexum registers a webhook URL with Xero
- **Event types** — Invoice payment, bill payment, credit note allocation
- **Signature validation** — HMAC-SHA256 verification of webhook payload
- **Processing** — On receipt: validate signature, identify resource, update Nexum records
- **Idempotency** — Webhook events processed exactly once (deduplication by event ID)

When a payment webhook arrives:
1. Validate the webhook signature
2. Fetch the full invoice/bill details from Xero (webhook payload is minimal)
3. Update Nexum: amount_paid, payment reference, status
4. Update credit tracking for customer payments
5. Fire internal notifications (credit.payment_received, rcti.payment_received)

### Polling Fallback

Polling runs as a safety net alongside webhooks:

- **Frequency** — Every 15 minutes (configurable)
- **Scope** — All invoices and RCTIs with status 'sent' or 'partial' that have Xero IDs
- **Batch size** — 10 per API call to respect rate limits
- **Tolerance** — Only updates if amount difference > $0.01
- **Purpose** — Catches any payments missed by webhooks (network issues, webhook downtime)

### Payment Status Mapping

| Xero Status | Nexum Status |
|-------------|--------------|
| AUTHORISED, amountPaid = 0 | Sent |
| AUTHORISED, amountPaid > 0 | Partial |
| PAID | Paid |
| VOIDED | Cancelled |

---

## Dynamic Account Code Mapping

### Chart of Accounts Sync

The rebuild pulls the chart of accounts from Xero and makes it available for mapping:

- **Initial sync** — On connection, fetch all active accounts from Xero
- **Periodic refresh** — Re-sync account list on a schedule (daily) or manual trigger
- **Account details** — Code, name, type (revenue, expense, asset, etc.), tax type, status

### Category-to-Account Mapping

Tenants map Nexum pricing categories to Xero account codes in administration:

| Nexum Category | Default Xero Account | Configurable |
|----------------|---------------------|--------------|
| Transport revenue | 200 (Sales) | Yes |
| Material revenue | 200 (Sales) | Yes |
| Disposal revenue | 200 (Sales) | Yes |
| Subcontractor cost | 310 (Contractor Payments) | Yes |
| Material cost | 300 (Cost of Sales) | Yes |
| Tip fee cost | 300 (Cost of Sales) | Yes |
| Equipment | 200 (Sales) | Yes |
| Labour | 200 (Sales) | Yes |

### Mapping Levels

Account codes resolve in this order (most specific wins):

1. **Per line item** — Override on the invoice/RCTI line itself
2. **Per customer/contractor** — Specific account for a specific party
3. **Per pricing category** — Category-level mapping (the main configuration)
4. **Default** — Fallback defaults (200 for revenue, 310 for expenses)

### Validation

Before sending to Xero, the system validates that all account codes exist in the synced chart of accounts. Invalid codes are flagged for correction before sync.

---

## Tax Handling

### Dynamic Tax Rates

The rebuild replaces hardcoded 10% GST with proper tax handling:

- **Tax rate sync** — Pull available tax rates from Xero (GST, GST Free, BAS Excluded, etc.)
- **Tax type mapping** — Each pricing category maps to a Xero tax type
- **Per-line tax** — Tax type can be overridden per line item
- **GST default** — Australian standard rate (10%) remains the default but is no longer hardcoded

### Tax Types

Common Australian tax types supported:

- **OUTPUT** — GST on income (10%)
- **INPUT** — GST on expenses (10%)
- **EXEMPTOUTPUT** — GST-free income
- **EXEMPTINPUT** — GST-free expenses
- **BASEXCLUDED** — BAS excluded items
- **GSTONIMPORTS** — GST on imported goods

### BAS Reporting

Proper tax type mapping ensures Xero's BAS (Business Activity Statement) reports are accurate. Each line item carries the correct tax type for GST reporting.

---

## Tracking Categories

### Purpose

Xero tracking categories enable financial reporting by dimensions (e.g. by region, by department, by project). The rebuild integrates these:

- **Sync tracking categories** — Pull available categories and options from Xero
- **Auto-assign** — Map Nexum data to tracking categories automatically:
  - **Region** — From job location or customer region
  - **Job type** — From the tenant-configurable job type
  - **Department** — If the tenant uses departmental structure
- **Per-line assignment** — Tracking categories attached to each invoice/bill line item
- **Manual override** — Users can change tracking category assignment before sending

### Configuration

Tenants configure tracking category mapping in administration:

- Which Xero tracking categories to use
- How to auto-populate them from Nexum data
- Default values for each category
- Override rules for specific scenarios

---

## Reconciliation

### Automated Reconciliation

The system continuously reconciles Nexum and Xero:

- **Invoice reconciliation** — Compare all synced invoices: amounts, statuses, payment totals
- **Bill reconciliation** — Compare all synced RCTIs/bills: amounts, statuses, payment totals
- **Contact reconciliation** — Verify linked contacts still exist and match in Xero

### Reconciliation Dashboard

Visual overview of sync health:

- **Matched** — Records that match in both systems (amount and status)
- **Mismatched** — Records where amounts or statuses differ (requires investigation)
- **Missing from Xero** — Nexum records that should be in Xero but aren't (sync failures)
- **Extra in Xero** — Xero records with Nexum references that don't exist locally (orphaned)
- **Colour-coded** — Green (healthy), amber (review needed), red (action required)

### Resolution Actions

- **Re-sync** — Push the Nexum record to Xero again (clears Xero ID and re-sends)
- **Force match** — Mark a mismatch as intentionally different (with reason)
- **Investigate** — Flag for manual investigation with notes

### Sync Health Monitoring

- Last sync timestamp per resource type
- Error count and trend (are failures increasing?)
- Rate limit usage (how close to Xero's 60/min, 5000/day limits)
- Connection health (is the OAuth token valid?)

---

## Error Handling & Resilience

### Error Categories

- **Authentication errors** — Token expired, refresh failed → notify admin to re-authorise
- **Rate limit errors** — Too many requests → back off and retry with exponential delay
- **Validation errors** — Invalid data (bad account code, missing contact) → flag for user correction
- **Network errors** — Connection timeout → retry with backoff
- **Xero errors** — API errors (duplicate invoice number, etc.) → capture error detail, surface to user

### Retry Strategy

- **Automatic retry** — Network and rate limit errors retry up to 3 times with exponential backoff
- **Manual retry** — Validation and Xero errors require user correction then manual re-send
- **Batch resilience** — Failed items in a batch don't block successful ones

### Audit Trail

Every sync operation is logged:

- Sync type (invoice, bill, contact, payment, credit_note)
- Direction (push to Xero, pull from Xero)
- Resource IDs (Nexum ID + Xero ID)
- Status (success, failed)
- Error message (if failed)
- Timestamp and user who triggered it

---

## Configuration & Administration

### Connection Settings

- Xero Client ID and Client Secret (encrypted storage)
- OAuth tokens (encrypted, auto-managed)
- Connected Xero organisation name and tenant ID
- Connection status indicator

### Sync Settings

- **Auto-create contacts** — Toggle: automatically create Xero contacts when companies are added
- **Auto-sync payments** — Toggle: enable webhook + polling for payment updates
- **Sync frequency** — Polling interval for payment fallback (default 15 minutes)
- **Batch size** — Maximum items per sync batch

### Account Mapping

- Category-to-account code mapping (see Dynamic Account Code Mapping)
- Tax type mapping per category
- Tracking category configuration
- Default account codes for unmapped items

### Permissions

- `accounts.xero.configure` — Set up connection, manage credentials
- `accounts.xero.sync` — Send invoices, RCTIs, credit notes to Xero
- `accounts.xero.reconcile` — Run reconciliation, resolve mismatches
- `integrations.manage` — Manage API integration credentials

---

## Sync Scope Summary

| Data | Direction | Trigger |
|------|-----------|---------|
| Contacts | Nexum → Xero | Auto on company create, manual link |
| Contacts | Xero → Nexum | Manual import, payment terms pull |
| Invoices (ACCREC) | Nexum → Xero | Manual send (individual/batch) |
| Credit Notes | Nexum → Xero | On credit note creation |
| Bills (ACCPAY) | Nexum → Xero | On RCTI/supplier invoice approval |
| Payments | Xero → Nexum | Webhooks (real-time) + polling (fallback) |
| Chart of Accounts | Xero → Nexum | On connection + daily refresh |
| Tax Rates | Xero → Nexum | On connection + periodic refresh |
| Tracking Categories | Xero → Nexum | On connection + periodic refresh |

---

## Key Decisions for This Document

| Decision | Summary |
|----------|---------|
| DEC-088 | Complete Xero integration overhaul — bidirectional with full feature coverage |
| DEC-089 | Dynamic account code mapping — pull chart of accounts from Xero, tenant-configurable category mapping |
| DEC-090 | Webhooks for real-time payment sync with polling as fallback |
| DEC-091 | Credit note sync to Xero (ACCECCREDIT) |
| DEC-092 | Dynamic tax rate handling — pull rates from Xero, no hardcoded GST |
| DEC-093 | Tracking category integration for dimensional financial reporting |
