# 09 — Pricing Engine

> How rates, costs, revenue, margins, and financial calculations work across the system.

---

## Overview

The pricing engine is the financial backbone of Nexum. Every job has pricing lines that define what the customer pays (revenue) and what it costs the tenant (cost). The difference is margin. All pricing is stored immutably once finalised — what's recorded is final, no recalculation on read.

The engine carries forward Nexum's proven architecture: a single `job_pricing` table as the source of truth for all job financials, behaviour-driven auto-generation from materials, and snapshot-based immutability for compliance and audit.

---

## Core Concepts

### Pricing Lines

Every financial item on a job is a **pricing line** with a type:

- **Revenue** — What the customer is charged. Links to a customer (party).
- **Cost** — What the tenant pays. Links to a contractor, supplier, or the tenant itself.

Each line has: description, pricing category, rate type, quantity, unit rate, total amount, tax rate, tax amount, and party reference. Lines can be auto-generated from materials or manually added.

### Pricing Categories

Lines are categorised for reporting and invoicing:

- **Materials** — Material supply, purchase, resale
- **Transport** — Cartage and delivery charges
- **Disposal** — Tip fees and environmental levies
- **Subcontractor** — Contractor payment lines
- **Equipment** — Plant and equipment hire
- **Labour** — Labour charges
- **Tip Fee** — Disposal site charges (linked to job locations)
- **Other** — Miscellaneous charges

### Pricing Methods

Six methods define how a line is calculated. All carry forward:

- **Hourly** — Hours × hourly rate. Supports minimum hours and overtime rate.
- **Tonnage** — Tonnes × rate per tonne. Supports minimum tonnage.
- **Volume** — Volume (m³) × rate per unit. Supports minimum volume.
- **Distance** — Kilometres × rate per km. Supports separate loaded/unloaded rates.
- **Unit** — Units × unit price. Configurable unit description (loads, trips, etc.).
- **Fixed** — Flat amount regardless of quantity.

The method defines which fields are relevant on the pricing line. The UI adapts based on the selected method.

---

## Pricing Behaviours

When materials are added to a job, the system auto-generates pricing lines based on the material's **pricing behaviour**. This is the core automation that saves manual line creation.

### Transport Revenue
The default. Customer is charged for transport/cartage. One revenue line created.

**Example:** Delivering gravel from quarry to site — customer pays for the cartage.

### Material Cost
Tenant buys material from a supplier and delivers it. Two lines: one cost (purchase from supplier) and one revenue (delivery charge to customer).

**Example:** Buying sand from a supplier at $25/t and delivering to the customer's site.

### Material Resale
Buy from supplier, resell to customer at markup. Two lines: cost (supplier purchase price) and revenue (customer sale price).

**Example:** Buying topsoil at $30/t, selling to customer at $45/t.

### Buyback
The receiving site pays the tenant for the material. One revenue line.

**Example:** Delivering recycled concrete to a site that pays for incoming material.

### Tracking Only
Track quantities without generating pricing lines. Used for materials that need volume tracking but aren't billed separately (included in a fixed price, or for reporting only).

### Behaviour Inference

When adding materials, the system infers the behaviour from context:

1. Destination company + destination price → **Buyback**
2. Supplier with purchase price → **Material Cost**
3. Supplier without purchase price → **Material Cost** (prompts for price)
4. No supplier, no destination pricing → **Transport Revenue**

Users can override the inferred behaviour.

---

## Subcontractor Rates

Subcontractor rates are always a **fixed value** per unit (DEC-041). When a material or job has a subcontractor rate, the system creates an additional cost line alongside the revenue line.

### How Rates Work

- **Hourly jobs** — Subcontractor rate per hour (typically ~10% less than the customer hourly rate)
- **Material-based jobs** — Subcontractor rate per unit of material (typically ~10% less than the material rate)
- **Transport rate** — Separate cartage rate with sub-rate calculated as transport_rate × 0.9

The sub-rate is set when the job is configured. It's a fixed dollar amount, not a percentage calculation — the "~10% less" is a business convention, not a system rule.

### Auto-Generation

When a material is added with `has_subcontractor_rate = true`:
1. Revenue line created (customer charge)
2. Cost line created at the subcontractor rate (contractor payment)

Both lines reference the same material and quantity. The difference is the tenant's margin.

---

## Rate Lookup & Customer Rate Cards

### Standard Rates

Default rates are configured in administration per material type, per supplier, and per disposal site. These are the baseline prices used when no customer-specific rate exists.

### Customer Rate Cards

Key customers can have negotiated rate cards — a custom price list per material or service that overrides standard rates. Rate cards support:

- Per-material rates (specific material at a specific price)
- Per-service rates (transport, disposal, etc.)
- Effective date ranges (rate valid from/to)
- Multiple rate cards per customer (e.g. different rates per project or region)

### Rate Lookup Order

When a job is created and materials/services are added, the system looks up rates in this order:

1. **Customer rate card** — If the customer has a rate card with a matching entry, use it
2. **Standard rate** — Fall back to the default rate for that material/service
3. **Manual entry** — If no rate found, prompt the user to enter one

Customer rate card prices are **auto-applied** when they exist. The user can override any line. Lines where a customer rate was applied are flagged so it's visible that negotiated pricing is in use (carries forward from Nexum's `used_customer_pricing` flag).

### Per-Job Overrides

Regardless of rate cards, every pricing line can be overridden on the job. Rate cards set the starting point; the user has final say. Overrides are tracked for reporting (how often do we deviate from agreed rates?).

---

## Markup Rules

Markup rules automate margin addition on cost items. They carry forward from Nexum with improved UX.

### Rule Structure

Each rule defines:
- **Type** — What kind of markup (percentage or fixed amount)
- **Markup percentage** — e.g. 15% on top of cost
- **Markup fixed amount** — e.g. $5/t on top of cost
- **Applies to** — Material type, supplier, or both (filters)
- **Priority** — Lower number = higher priority. Most specific rule wins.
- **Active** — Toggle on/off without deleting

### How Rules Apply

When a cost line is created (e.g. material purchase from supplier), the system checks markup rules in priority order. The first matching rule applies its markup to generate the corresponding revenue line.

**Example:** Supplier ABC, material "Clean Fill" — markup rule says 20%. Cost line: $30/t → Revenue line auto-generated at $36/t.

### UX Improvement

Nexum's markup configuration was noted as confusing (doc 05 discussion). The rebuild improves this with:
- Clear rule preview showing what the markup will produce
- Test mode — enter a scenario and see which rule fires and what the result is
- Visual priority ordering (drag to reorder)
- Conflict detection — warns when multiple rules could apply to the same scenario

---

## Margin Tracking & Controls

### Multi-Level Thresholds

Margin warnings are configurable at multiple levels, most specific wins:

1. **Global default** — Applies to everything (e.g. warn below 15%)
2. **Per pricing category** — Different thresholds per category (e.g. materials at 12%, transport at 20%)
3. **Per customer** — Some customers have naturally tighter margins (e.g. large-volume customers at 8%)
4. **Per material type** — Some materials have thinner margins by nature

When a pricing line's margin falls below the applicable threshold, the system:
- Displays a visual warning (colour-coded by severity)
- Requires a reason before saving (who approved, why)
- Records the override for audit (user, timestamp, reason)

### Margin Calculation

Margin is calculated per line and per job:

- **Line margin** = (revenue - cost) / revenue × 100
- **Job margin** = (total revenue - total cost) / total revenue × 100

Both planned and actual margins are tracked. Variance between planned and actual is surfaced on job completion.

### Margin Reporting

Margin data feeds into reporting (doc 17):
- Margin by customer, by material, by job type
- Margin trend over time
- Low-margin job frequency
- Override patterns (which users, which customers, how often)

---

## Tip Fees & Disposal Pricing

Disposal site pricing has its own structure due to the dual nature of disposal sites (DEC-037):

### Disposal Charges (Accepting Material)
- **Tip fee** — Per-unit charge for accepting material
- **Environmental levy** — Government-mandated levy (separate line for reporting)
- **Minimum charge** — Minimum per load regardless of quantity

### Supply Pricing (Selling Material)
- **Sale price** — Per-unit price when the disposal site supplies material (buyback mode)

### Auto-Generation

When a job location is a disposal site, the system auto-creates tip fee pricing lines linked to that location. Environmental levies are separate lines for GST and reporting purposes. If the disposal site is in supply mode, buyback pricing applies instead.

---

## Hourly Rates & Minimums

Hourly pricing supports:

- **Job-level hourly rate** — Base rate per hour for the job
- **Minimum hours** — Ensures a minimum charge even for short jobs
- **Overtime rate** — Applied after threshold hours (configurable)
- **Subcontractor hourly rate** — Fixed amount per hour paid to contractor

Minimum charge enforcement: if actual hours × rate < minimum hours × rate, the minimum applies. This is calculated at daysheet processing time.

---

## Price History & Versioning

### Material Price History

All price changes are tracked with:
- **Effective date** — When the new price takes effect
- **Previous price** — What it was before
- **Change source** — Manual edit, bulk update, or CSV import
- **Changed by** — User who made the change
- **Bulk update ID** — Groups changes from the same batch operation

### Bulk Price Updates

Support for updating prices in bulk:
- **CSV import** — Upload a spreadsheet of new prices with effective dates
- **Bulk edit** — Select multiple materials, apply a percentage increase/decrease
- **Supplier price update** — Update all materials from a specific supplier at once

### Effective Date Pricing

When looking up a material price, the system uses the price effective as of the job date (not today's price). This ensures jobs priced weeks in advance use the rates that were current at the time.

---

## Quote Pricing

Quotes interact with the pricing engine as defined in doc 06. The key pricing-specific behaviour:

### Rate Lock — Tenant Configurable

Tenants choose how quote pricing works:

- **Lock at quote time** — Rates are snapshotted when the quote is created. If the customer accepts weeks later, those are the rates that apply. This is the "we quoted you $X, that's the price" approach.
- **Update on acceptance** — The quote shows rates at creation time, but when accepted, the system re-prices with current rates. The customer sees the updated pricing before confirming acceptance.

This is a tenant-level setting, not per-quote. Whichever approach the tenant uses applies to all their quotes.

### Quote-to-Job Pricing Flow

1. Quote created → pricing lines generated using current rates (and customer rate card if applicable)
2. Quote sent to customer
3. Customer accepts → if lock mode, pricing lines carry as-is; if update mode, rates refresh
4. Job created from accepted quote with final pricing

---

## Pricing Snapshots & Immutability

### When Snapshots Are Taken

Pricing data is snapshotted at key lifecycle points:

- **Material added to job** — Current rates captured at time of addition (DEC-039)
- **Job confirmed** — Full pricing snapshot for the confirmed job state
- **Invoice generated** — Pricing lines locked into invoice items with snapshot timestamp
- **RCTI generated** — Contractor rates locked into RCTI items with rate and quantity snapshots

### What's Immutable

Once a pricing line is included in a **sent invoice** or **approved RCTI**, it cannot be modified. This is enforced at the database level, not just the application level. Allowed changes after finalisation: status transitions only (sent → paid).

### Variation Handling

If pricing changes after confirmation (mid-job edits per DEC-047), the system creates **variation lines** flagged with `is_variation = true`. These maintain a clear audit trail: original pricing + variations = final pricing.

---

## Job Financial Summary

Every job surfaces a financial summary calculated from its pricing lines:

- **Total Revenue** — Sum of all revenue lines
- **Total Cost** — Sum of all cost lines
- **Profit** — Revenue minus cost
- **Profit Margin** — Profit / revenue × 100
- **Tax Amount** — Sum of tax across all lines
- **Planned vs Actual** — Comparison once actuals are processed from daysheets

### Planned vs Actual Tracking

The `job_actuals` structure tracks:
- Planned hours, tonnes, loads, cost, revenue
- Actual hours, tonnes, loads (from daysheet processing), itemised costs, calculated revenue
- Variance on each metric (generated/computed)
- Variance approval (who approved, when, notes)

This enables real-time visibility into whether a job is tracking to plan or deviating.

---

## Pricing Allocations

For multi-customer jobs (DEC-045), pricing lines can be split across multiple customers:

- **Allocation amount** — Dollar amount per customer
- **Allocation percentage** — Percentage split per customer
- **Invoice grouping** — Each customer's allocation generates their own invoice lines

This supports jobs where multiple customers share a site or service and each pays a portion.

---

## Rate Review Workflow

Material and service rates change regularly — fuel cost fluctuations, supplier annual reviews, CPI adjustments, new customer negotiations. The system supports structured rate reviews rather than ad-hoc edits.

### Stale Rate Detection

The system flags rates that haven't been updated within a configurable period (e.g. 6 months, 12 months). This surfaces in administration as a review queue: materials and services grouped by supplier or customer, showing last update date, current rate, and price history trend.

### Bulk Adjustments

Beyond individual edits, the rate review workflow supports:

- **Percentage adjustment** — "Increase all rates from Supplier X by 3.5%" with preview before applying
- **CPI/index-based adjustment** — Apply a published index increase across a category
- **Supplier rate sheet import** — Upload the supplier's new rate sheet (CSV), system matches materials and shows proposed changes for review before applying

All bulk adjustments create price history entries with the change source recorded. Effective dates can be set in the future (e.g. new rates take effect 1st of next month).

### Review Audit

Rate reviews are tracked: who reviewed, when, what changed, what was the justification. This supports supplier negotiations ("your rates have increased 12% in 2 years") and customer rate card renewals.

---

## Fuel Surcharges & Ad-Hoc Levies

Australian transport commonly applies fuel levies and other surcharges that fluctuate independently of base rates.

### Surcharge Configuration

Surcharges are configured at the tenant level:

- **Name** — e.g. "Fuel Levy", "Environmental Surcharge"
- **Type** — Percentage of base rate, or fixed amount per unit
- **Value** — The current surcharge amount or percentage
- **Applies to** — Which pricing categories (transport, materials, all)
- **Auto-apply** — Whether the surcharge is automatically added to new jobs
- **Effective date** — When the surcharge takes effect (supports future-dated changes)

### How Surcharges Work

When auto-apply is enabled, new pricing lines on matching jobs get an additional surcharge line created automatically. Surcharges are **separate line items** on invoices — not baked into the base rate. This provides transparency to customers and makes it easy to adjust when fuel prices change without touching every rate in the system.

### Surcharge History

Surcharge values are tracked over time. When the fuel levy changes (e.g. quarterly review), updating the surcharge configuration applies to new jobs going forward. Existing jobs retain the surcharge that was current when they were created.

---

## Credits & Negative Pricing Lines

The pricing model supports negative amounts for credits, adjustments, and goodwill — tying into the customer account management described in doc 02.

### Credit Types

- **Overpayment credit** — Customer paid more than invoiced, credit applied to next job
- **Goodwill adjustment** — Discount or credit for service issues
- **Rate correction** — Retroactive rate adjustment (e.g. wrong rate applied, corrected after the fact)
- **Reversal** — Full or partial reversal of a pricing line

### How Credits Work

Credits are negative pricing lines (negative total_amount) on the revenue side. They reduce the customer's invoice total. Each credit line has a reason and links to the original line it adjusts (if applicable). Credits can be applied to a specific job or held on the customer's account for application to future invoices.

For contractors, the same mechanism works on the cost side — negative cost lines reduce RCTI amounts. This covers contractor account items like parking charge reversals or adjustment credits (doc 02).

---

## Pricing Templates & Job Type Defaults

Since job types are tenant-configurable and drive form behaviour (DEC-043), they also carry default pricing structures.

### Job Type Pricing Defaults

Each job type can define:

- **Default pricing lines** — Pre-loaded when a job of that type is created (e.g. a "Disposal" job type auto-adds a transport revenue line and a tip fee line)
- **Default pricing method** — The expected billing method for that job type (e.g. "Hire" defaults to Hourly)
- **Required pricing categories** — Which categories must be present before the job can be confirmed
- **Excluded categories** — Categories hidden from the form for that job type (reduces clutter)

### Reusable Pricing Templates

Beyond job type defaults, users can save and apply pricing templates for recurring scenarios:

- **Template name** — e.g. "Standard Quarry Run - Smith Quarry"
- **Pricing lines** — Pre-configured lines with rates, categories, and parties
- **Apply to job** — One click to load the template onto any job, then adjust as needed

Templates save time on recurring work without the rigidity of job type defaults. They're especially useful for jobs that don't fit neatly into a single job type pattern.

---

## Daysheet-to-Pricing Flow

Doc 08 covers daysheet processing in detail. Here's how it connects to pricing:

### Processing Flow

1. **Daysheet submitted** — Driver records actual quantities (tonnes, hours, loads), times, and materials via DriverX, portal, or manual entry
2. **Quantities flow to pricing** — Actual quantities update the `actual_quantity` field on matching pricing lines
3. **Actual totals recalculated** — `actual_total` = actual_quantity × unit_rate (or actual_unit_rate if rates changed)
4. **Variance surfaced** — Planned vs actual comparison visible on the job financial summary
5. **Overage handling** — If actuals exceed planned quantities beyond tolerance, the overage workflow triggers (doc 08)

### Charge Creation

For some pricing categories, daysheet processing **creates** charge lines rather than updating existing ones. This happens when:

- A daysheet records work on a material not in the original job pricing (ad-hoc work)
- Docket charges override the planned pricing (e.g. actual tip fee different from quoted)
- Additional charges arise during the job (waiting time, extra loads)

These are flagged as docket-originated charges for review and approval before they flow into invoicing.

---

## Key Decisions for This Document

| Decision | Summary |
|----------|---------|
| DEC-041 | Subcontractor rates always fixed value, never percentage |
| DEC-039 | Immutable pricing snapshots at material addition and invoicing |
| DEC-067 | RCTI progression gates on invoice status and staff approval |
| DEC-068 | All 6 pricing methods and 5 pricing behaviours carry forward |
| DEC-069 | Markup rules and margin warnings carry forward with improved UX |
| DEC-070 | Margin thresholds configurable at global, per-customer, per-material-type, per-pricing-category levels |
| DEC-071 | Price history with effective dates is essential — keep and improve with better UI and bulk update tools |
| DEC-072 | Customer rate cards with auto-apply and per-job override capability |
| DEC-073 | Quote pricing lock vs update is tenant-configurable |
| DEC-074 | Structured rate review workflow with stale rate detection and bulk adjustments |
| DEC-075 | Fuel surcharges and ad-hoc levies as separate auto-applied line items |
| DEC-076 | Negative pricing lines for credits, adjustments, goodwill, and reversals |
| DEC-077 | Job type pricing defaults and reusable pricing templates |
| DEC-078 | Daysheet processing updates actual quantities on pricing lines and can create new charge lines |
