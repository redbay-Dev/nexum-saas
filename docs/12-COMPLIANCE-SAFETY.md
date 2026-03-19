# 12 — Compliance & Safety

> Nexum operates independently. When a tenant subscribes to SafeSpec, compliance features light up. SafeSpec is the compliance product — it has all the data and Nexum consumes what it needs.

---

## Overview

**SafeSpec** is a dedicated, multi-tenant compliance and WHS management system. It's a separate SaaS product that manages everything compliance: NHVAS, WHS, mass management, fatigue, maintenance, defects, pre-starts, drug testing, CoR, document tracking, and auditing. SafeSpec is the authority on compliance — it has all the data, all the rules, all the assessments.

**Nexum** is an operations platform. It does not manage compliance internally. There is no internal compliance engine and no fallback compliance system. Nexum's job is scheduling, pricing, invoicing, and dockets — not compliance.

**The relationship is optional.** Not all Nexum tenants will subscribe to SafeSpec. Nexum must be a fully functional operations platform on its own. When a tenant subscribes to SafeSpec, Nexum gains compliance awareness by consuming data that SafeSpec already has.

---

## Two Modes of Operation

### Without SafeSpec (Default)

Nexum operates as a pure operations platform:

- All drivers, assets, and contractors are available for allocation — no compliance gates
- No compliance badges or status indicators on entities
- No compliance dashboard
- Pre-starts can still be captured locally (DriverX, portal, manual) but aren't processed for compliance
- The tenant handles compliance outside of Nexum entirely — spreadsheets, paper, another system, or not at all

This is the baseline. Nexum is fully functional without SafeSpec.

### With SafeSpec (Subscription Active)

When a tenant subscribes to SafeSpec and connects it to Nexum, compliance features appear:

- **Compliance badges** on all entities (green/amber/red)
- **Compliance gates** — non-compliant entities blocked from allocation
- **Pre-start flow** — submissions sent to SafeSpec for processing and defect management
- **Operational data sharing** — hours, loads, distances flow to SafeSpec so it can do its compliance assessments
- **Compliance dashboard** — lightweight operational view of compliance health
- **Scheduler awareness** — compliance warnings factor into recommendation scoring

Toggling the connection on/off is clean — no data loss, features simply appear or disappear.

---

## What SafeSpec Has (That Nexum Can Use)

SafeSpec is a complete compliance system. It already manages all of this for its tenants:

- **NHVAS** — Accreditation, module enrollment, standard tracking, quarterly statements
- **Mass management** — Schemes (GML, CML, HML, PBS), mass rules, NHVL SMS
- **Maintenance management** — Schedules, service records, inspections, defect lifecycle
- **Fatigue management** — Work/rest rules, BFM/AFM standards, breach detection
- **WHS** — Incidents, hazards, SWMS, toolbox talks, training, emergency plans, workers comp, PPE, health monitoring
- **CoR** — Risk assessments, evidence tracking, due diligence documentation
- **Drug & alcohol testing** — Test records, results, follow-up actions
- **Pre-start processing** — Checklist definitions, completion evaluation, defect creation
- **Document management** — Licence expiry, registration, insurance, certificates, qualifications
- **Compliance alerts** — Expiry warnings, escalation, notification
- **Audit** — CAR/NCR, internal reviews, audit preparation
- **NHVR integration** — Vehicle verification, registration data

All of this data exists in SafeSpec. The question for Nexum is simply: what subset of this data does Nexum need to operate effectively?

---

## What Nexum Consumes from SafeSpec

Nexum doesn't need all of SafeSpec's data. It needs just enough to make operational decisions.

### Compliance Status (The Core)

The primary data point: "Is this entity compliant for operations?"

For each driver, asset, and contractor, SafeSpec provides:

- **Status** — Compliant / Non-compliant / Warning
- **Summary** — Human-readable position (e.g. "Licence expires in 5 days", "Overdue for service")
- **Blockers** — Specific issues preventing compliance (if non-compliant)
- **Warnings** — Approaching issues (if warning status)

This is all Nexum needs to enforce compliance gates and show badges. Nexum doesn't need to know the compliance rules, the assessment logic, or the full compliance record — just the verdict.

### Bulk Status (For the Scheduler)

The scheduler displays 50–300+ resources. Nexum needs to check compliance status for all of them efficiently — a single batch request returning status for multiple entities.

### Summary Data (For Display)

For entity profiles in Nexum, SafeSpec provides cached summary data:

- **Drivers** — Licence class, expiry, medical status, fatigue hours remaining, qualifications
- **Assets** — Registration status/expiry, next service due, open defect count, mass scheme
- **Contractors** — Insurance status/expiry, NHVAS accreditation, agreement expiry, onboarding %

This is display-only data. Users click through to SafeSpec for full detail and management.

### Pre-Start Checklist Definitions

When DriverX needs to render a pre-start checklist, Nexum fetches the checklist definition from SafeSpec — which items to check, what type of check (pass/fail, measurement, photo), and severity if failed. Cached locally since definitions don't change often.

---

## What Nexum Shares with SafeSpec

SafeSpec benefits from operational data that Nexum captures during daily operations. This data helps SafeSpec do better compliance assessments.

### Operational Data

| Data | Source in Nexum | How SafeSpec Uses It |
|------|----------------|---------------------|
| Hours worked per driver | Daysheets, timesheets | Fatigue management — work/rest calculations, breach detection |
| Loads per asset | Job actuals | Mass compliance — tracking against scheme limits |
| Distances per asset | Job data | Maintenance — triggering distance-based service schedules |
| Weights (gross, tare, net) | Docket processing | Mass compliance — load weight verification |
| Driver-asset assignments | Scheduler allocations | Work diary — who drove what, when |

### Pre-Start Submissions

Pre-starts captured in Nexum's ecosystem (DriverX, portal, manual entry) are forwarded to SafeSpec for processing:

1. Driver completes pre-start via DriverX
2. Nexum forwards submission to SafeSpec
3. SafeSpec evaluates results, creates defects if needed, updates compliance status
4. Updated status available for Nexum to consume

### Incident Reports

If an operational incident occurs, the initial report can be submitted from Nexum to SafeSpec for full WHS investigation and management.

### Push Timing

- **Real-time** — Hours worked, shift start/end (critical for fatigue)
- **At processing** — Loads, distances, weights (at daysheet/docket processing time)
- **End of day** — Summary data as a daily batch

### Failure Handling

If SafeSpec is unreachable when sharing data:
- Data queued locally with retry logic and exponential backoff
- No data loss — operational facts always persisted in Nexum's job records
- Alert if queue grows beyond threshold

---

## Compliance Gates (When Connected)

### What Gets Blocked

When SafeSpec is connected and reports an entity as non-compliant:

- **Non-compliant driver** — Cannot be allocated to any job. Shown as unavailable in scheduler with reason.
- **Non-compliant asset** — Cannot be allocated. Shown as unavailable with reason.
- **Non-compliant contractor** — Cannot receive job allocations. Warning on contractor profile.
- **Non-compliant combination** — Even if individually compliant, the pairing may not be (e.g. driver not qualified for that asset type)

### Warning Status

Entities approaching non-compliance show a warning:

- Amber badge everywhere the entity appears
- Tooltip showing what's approaching and when
- Still allocatable — warnings inform, they don't block
- Recommendation score reduced in scheduler (doc 07)

### No Override in Nexum

When SafeSpec says non-compliant, Nexum blocks. There is no override in Nexum — the resolution path is to fix the issue in SafeSpec. Compliance bypasses create legal liability under Chain of Responsibility. Any override mechanism (if needed) belongs in SafeSpec where the compliance context and audit trail exist.

---

## Compliance Display (When Connected)

### Entity Badges

- **Green** — Fully compliant
- **Amber** — Compliant but warnings
- **Red** — Non-compliant, blocked
- **Grey** — No compliance data (SafeSpec not connected)

Visible everywhere: lists, profiles, scheduler, allocation dropdowns, job assignments.

### Compliance Dashboard

A lightweight operational view (not a compliance management tool):

- Counts of compliant/warning/non-compliant entities by type
- Entities approaching non-compliance sorted by urgency
- Currently blocked entities with blocker summaries
- Link to SafeSpec for full compliance management

This serves dispatchers and operations managers. Compliance managers use SafeSpec directly.

---

## Integration Architecture

### Connection Setup

Per-tenant configuration in Nexum's admin:

- **SafeSpec URL** — The SafeSpec instance to connect to
- **API credentials** — Authentication between the two systems
- **Enabled/disabled toggle** — Clean on/off
- **Tenant mapping** — Links Nexum tenant to corresponding SafeSpec tenant

### Shared Identity

Both products use Better Auth and the same tenant model:

- Shared UUIDs for entities (drivers, assets, contractors)
- SSO across both products — users move seamlessly between them
- Shared compliance package in the monorepo for types, schemas, and validation

### Caching Strategy

- **Short TTL** — 15 minutes for active operations, 1 hour for display
- **Webhook invalidation** — SafeSpec pushes events when status changes, Nexum invalidates cache immediately
- **Stale handling** — If cache expired and SafeSpec unreachable, show last known status with "stale" indicator
- **Batch pre-fetch** — Scheduler pre-fetches all visible resource statuses on load

---

## What Nexum Does NOT Manage

For clarity — these features exist in the current Nexum but are removed in the rebuild. For tenants who subscribe to SafeSpec, these capabilities are available through SafeSpec:

- NHVAS module management and quarterly statements
- Work/rest record management and fatigue breach detection
- Maintenance schedule management and service record tracking
- Asset defect lifecycle management
- Pre-start checklist definition and processing
- Compliance document storage and expiry tracking
- WHS incident investigation and management
- Hazard register and risk assessments
- SWMS management and worker acknowledgments
- Toolbox talks and training records
- Emergency plans, drills, and equipment tracking
- Workers comp, PPE, health monitoring
- Drug and alcohol test management
- CoR risk assessment management
- CAR/NCR and internal audit management
- NHVR API integration
- Compliance alert configuration

Tenants without SafeSpec don't have these features in Nexum. They manage compliance externally or not at all.

---

## Key Decisions for This Document

| Decision | Summary |
|----------|---------|
| DEC-094 | SafeSpec owns ALL compliance management — it's a dedicated product with all the data |
| DEC-095 | WHS is entirely SafeSpec's domain |
| DEC-096 | Nexum's role: consume compliance status, enforce gates, share operational data, display summaries |
| DEC-097 | No compliance override in Nexum — resolve in SafeSpec where audit trail exists |
| DEC-098 | Compliance status cached locally, invalidated by SafeSpec webhooks |
| DEC-099 | Pre-starts captured in Nexum ecosystem, forwarded to SafeSpec for processing |
| DEC-100 | Operational data shared from Nexum to SafeSpec for compliance assessment |
| DEC-101 | SafeSpec is optional — Nexum functions fully without it |
| DEC-102 | "No fallback" means no internal compliance engine, not that Nexum requires SafeSpec |
