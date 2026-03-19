# 04 — Assets & Fleet

## Overview

Assets are the physical resources that perform transport work: trucks, trailers, equipment, and tools. The asset system tracks what the tenant owns (or has access to via contractors), what it weighs, who's driving it, and whether it's available for work.

Nexum's asset system is one of the most complete areas of the application. The rebuild carries forward the core model — categories with per-category feature toggles, subcategories linked to vehicle configurations, default pairings, availability management, documentation, and performance tracking. Key changes: drop the legacy inline trailer fields, expand beyond 3 custom fields per category, remove mass management and compliance from Nexum entirely (consumed from an external compliance system), enhance performance analytics, and enforce strict compliance gating on all allocations.

## Asset Types and Categories

### Category hierarchy
Assets are organised in a two-level hierarchy:

- **Categories** — The broad type of asset (Truck, Trailer, Equipment, Tool). Fully tenant-configurable: the system ships sensible defaults, but tenants can add, rename, reorder, or disable categories.
- **Subcategories** — More specific types within a category (e.g., under Truck: Prime Mover, Rigid, Tipper). Subcategories link to vehicle configurations for mass limit lookups and can carry default volume limits.

### Per-category feature toggles (existing in Nexum)
Nexum already provides extensive configuration per category. Each category has toggles that control which form sections and fields appear for assets in that category:

- `enableSpecifications` — Show/hide the specs form
- `enableWeightSpecs` — Show/hide tare weight, GVM, GCM fields
- `enableMassScheme` — Show/hide mass scheme assignment
- `enableEngineHours` — Show/hide engine hours tracking
- `enableCapacityFields` — Show/hide volume/capacity fields
- `enableRegistration` — Show/hide registration fields
- Industry type classification (transport, construction, general)

These carry forward as-is — they work well and allow tenants to keep the UI clean for categories that don't need heavy vehicle fields (e.g., Tools don't need mass schemes).

### Custom fields — improvement over Nexum
Nexum supports 3 custom fields per category with configurable labels (`customField1Label`, `customField2Label`, `customField3Label`). This is functional but limited. The rebuild expands this to a configurable field set per category where tenants define: field name, field type (text, number, date, dropdown), and whether it's required. This handles tenants with diverse asset types who need to track category-specific attributes without being limited to three free-text slots.

### Default categories
The system ships with four defaults:

- **Trucks** — Prime movers, rigid trucks, heavy vehicles. Weight specs and mass scheme enabled by default.
- **Trailers** — Semi-trailers, dog trailers, flat-tops, tippers. Weight specs and mass scheme enabled. Always separate asset records (see trailer section below).
- **Equipment** — Excavators, loaders, rollers, compactors. Engine hours and capacity enabled by default. May need registration and compliance depending on type.
- **Tools** — Hand tools, power tools, smaller items. Basic specs only. Lighter tracking requirements.

## Asset Records

Every asset gets a record containing:

### Core identification
- Asset number (auto-generated YYYY format or custom)
- Registration number (normalised for duplicate detection), state, expiry
- Make, model, year, serial number / VIN
- Category and subcategory

### Specifications (shown/hidden by category toggles)
- Tare weight, manufacturer GVM, manufacturer GCM
- Vehicle configuration (for mass limit lookups)
- Mass scheme assignment (consumed from compliance system — see mass management section)
- Body configuration: material, side height, body type
- Equipment fitted: scales, mud locks, fire extinguisher, first aid, UHF radio, GPS tracking, isolation switch
- Capacity values (supports multiple dimensions for equipment)
- Engine hours tracking with last reading date
- Odometer tracking with last reading date

### Ownership
- **Tenant-owned** — The tenant's own fleet. No owning company reference.
- **Contractor-supplied** — Owned by a contractor operating in the tenant's system. Links to the contractor's company record.

The scheduler and job system treat both the same operationally — they care about availability, compliance status, and capability, not ownership. Ownership matters for financial tracking (revenue vs cost) and for who manages the asset's documentation.

## Trailer and Combination Management

### Independent assets with default pairings
Every piece of rolling stock is its own asset record — a truck is an asset, a trailer is an asset, a dog trailer is an asset. This allows independent compliance tracking, independent maintenance scheduling, and flexible reassignment between jobs.

The legacy inline trailer fields from Nexum (trailer_registration, trailer_tare_weight, etc. stored directly on the truck record) are dropped entirely. Trailers are always separate asset records. This eliminates data duplication and the confusion of having trailer data in two places.

### Default pairings
Many fleets run the same truck-trailer combination most of the time. The system supports default pairings to reduce dispatcher effort:

- A trailer can have a **default prime mover** assignment (the common pairing)
- When a job is created with that truck, the paired trailer is pre-selected
- The dispatcher can override and select a different trailer at job level
- The dispatcher can **remove the trailer entirely** — not all jobs require a trailer (e.g., a rigid truck on a standalone run, or site conditions change making the trailer unnecessary)
- Combinations can be changed mid-job if operational needs change (trailer swap at depot, site access changes, project stage changes)

### Trailer removal
Removing a trailer from a job — either at creation or during the job — is a first-class operation. Reasons this happens:

- The job doesn't require a trailer (body truck / rigid work)
- Site access changes make the trailer impractical
- Weather or project stage means a different configuration is needed
- The trailer is needed elsewhere urgently

When a trailer is removed mid-job, the mass calculations recalculate for the remaining vehicle only, and the trailer becomes available for other allocations.

### Combination mass calculations
When a truck and trailer are combined for a job, the system calculates combination mass limits based on data from the compliance system:

- Combined GCM for the pairing
- Combined payload across the combination
- Per-unit limits (each asset retains its individual GVM/tare)

The vehicle configuration determines which mass rules apply — a truck-and-dog combination has different limits than a B-double, even with the same prime mover.

## Mass Management

Mass management is critical for Australian heavy vehicle operations and is a compliance obligation under the NHVL. **However, the mass management framework is changing with the introduction of the new Safety Management System (SMS) later in 2026.** Because of this, Nexum does not own or manage mass rules, schemes, or compliance calculations. Instead, Nexum consumes this data from the external compliance system (SafeSpec or equivalent).

### What Nexum stores locally
- The asset's physical specifications: tare weight, manufacturer GVM, manufacturer GCM
- Vehicle configuration assignment (which type of combination this asset operates as)
- The current mass scheme assignment (what scheme the compliance system says this asset operates under)

### What comes from the compliance system
- Mass scheme definitions (GML, CML, HML, PBS, and any new schemes under the SMS framework)
- Mass limit rules (the matrix of vehicle configuration × mass scheme → legal limits)
- Legal limit calculations (factoring in steer axle allowances, PBS levels, any SMS-specific rules)
- Accreditation and approval status (NHVAS, PBS approvals)
- Changes to the regulatory framework as the SMS is introduced

### Why this separation matters
The current NHVL mass scheme framework (GML/CML/HML/PBS) is well-established, but the incoming SMS introduces changes to how mass compliance is assessed and managed. By keeping mass rules and calculations in the compliance system:

- Nexum doesn't need to be updated when regulations change — the compliance system handles that
- There's a single source of truth for mass compliance across both Nexum and SafeSpec
- The SMS transition is handled once, in one place, rather than duplicated across systems

### What Nexum does with the data
Nexum uses the compliance system's mass data for operational purposes:

- Display legal limits on the asset record (fetched/synced from compliance system)
- Calculate available payload for job planning (legal GVM minus tare)
- Enforce mass limits during scheduling and docket processing
- Show warnings when approaching or exceeding limits
- Feed mass data into performance analytics

### Volume override
Some jobs require loading beyond the standard volume capacity of an asset (e.g., lightweight materials that fill the body before reaching mass limits). The volume override system allows:

- Setting a custom maximum volume (m³) per asset
- Mandatory reason for the override
- Approval workflow with permission gating
- Audit trail — who requested, who approved, when
- Override history visible on the asset record

This carries forward with improvements: multi-level approval for larger overrides (e.g., overrides beyond a threshold require a second approver).

## Allocation Compliance Gates

**An asset is only available for scheduling and job allocation if all compliance requirements are met.** This is not optional — it's a hard gate that prevents non-compliant resources from being assigned to work.

### Compliance status from external system
The compliance system (SafeSpec or equivalent) provides a compliance status for each asset. Nexum checks this status before any allocation. The compliance system is the authority on whether an asset meets its regulatory obligations — Nexum does not duplicate this logic.

### Document-based gates (configurable per tenant)
Nexum tracks asset documents locally (registration, insurance, roadworthy, etc.) with expiry dates. Tenants configure which document types enforce allocation lockout:

- **Registration** — Always checked. Expired rego = cannot allocate.
- **CTP insurance** — Configurable lockout with grace period.
- **Comprehensive insurance** — Configurable lockout with grace period.
- **Roadworthy/inspection** — Configurable lockout.
- **PBS approval** — Checked for PBS-scheme assets.

Each lockout rule has tenant-configurable thresholds: alert level (info → warning → critical), days before expiry, notification channels (email, SMS, in-app), enforcement toggle, and grace period (0–30 days after expiry before hard lockout).

### Operational gates
- Asset operational status must be "available" (not maintenance, repairs, grounded, inspection, or retired)
- No open critical defects (immediate grounding)
- No open major defects older than 24 hours
- Overdue maintenance schedules (configurable lockout)

### Contractor-specific gates
For contractor-supplied assets, additional gates apply:

- Contractor onboarding must be complete (all required onboarding items satisfied — see doc 02)
- Active contractor agreement required
- Public liability at or above required minimum per agreement
- NHVAS accreditation current (if required per agreement)
- Contractor driver induction complete (if the driver is also a contractor employee)

### Pre-start gate
Configurable per tenant with three enforcement levels:

- **Off** — No pre-start enforcement
- **Warn** — Missing pre-start shows a warning but allows allocation
- **Block** — Missing pre-start today prevents allocation

### Override mechanism
For exceptional circumstances, authorised users can create compliance overrides:

- Time-limited override (valid until a specific date)
- Requires appropriate permission
- Errors downgrade to warnings while override is active
- Full audit trail of who overrode what and why

### Key principle
If an asset (or its owning contractor) fails any enforced compliance gate, the asset does not appear as available in the scheduler. The dispatcher sees why it's blocked and what needs to be resolved. No shortcuts, no silent failures.

## Asset Status and Availability

### Operational status
Every asset has a status:

- **Available** — Ready for scheduling (subject to compliance gates above)
- **In use** — Currently assigned to an active job
- **Maintenance** — Undergoing scheduled or unscheduled maintenance
- **Inspection** — Under inspection (annual, roadworthy, etc.)
- **Repairs** — Being repaired (distinct from scheduled maintenance)
- **Grounded** — Taken out of service. Could be compliance, safety, or operational reasons.
- **Retired** — End of life. Preserved for history, hidden from scheduling.

### Availability periods
When an asset is marked unavailable (maintenance, inspection, repairs, grounded), the system tracks the status reason, start and end time, and who set it.

### Auto-deallocation
When an asset is marked unavailable, the system automatically deallocates it from all active job allocations and schedule assignments. This prevents dispatchers from unknowingly scheduling an asset that's in the workshop. The allocation records are preserved (marked as deallocated with timestamp and reason) for audit purposes.

### Contractor asset availability
Contractor-owned assets follow the same availability model. Contractors can update their asset availability via the portal (see doc 02 for contractor self-service). The tenant can also manage contractor asset availability directly, overriding the contractor if needed.

## Asset Documentation

Every asset carries documents with expiry tracking:

### Document types
Registration certificate, CTP insurance, comprehensive insurance, roadworthy/inspection certificate, weight certificate, PBS approval documents, service records, photos, and tenant-defined types.

### Document management
- Upload with metadata (issue date, expiry date, document type)
- Verification workflow — documents can be marked as verified by authorised staff
- Version history — previous versions retained when a document is replaced
- Expiry tracking feeds into the compliance alert system and allocation gates

### Compliance status sync
Key compliance dates (rego expiry, CTP expiry, comprehensive expiry, roadworthy expiry) are synced from documents to the asset record for quick visibility without needing to open each document. These dates drive the allocation compliance gates described above.

## Maintenance and Defects

Maintenance and defect management may ultimately live in the external compliance system. Regardless of where it lives, the functional requirements are the same. Nexum needs to either manage this directly or consume it from the compliance system — the interface to the rest of the application (scheduling gates, performance analytics, asset status) stays the same either way.

### Maintenance schedules
Per-asset recurring service definitions:

- **Trigger types:** Distance-based (every X km), time-based (every X days), hours-based (every X engine hours), or combined (whichever comes first)
- **Service types:** Minor service, major service, annual inspection
- **Tracking:** Last service date/odometer/hours, next due date/odometer/hours
- **Task checklists:** Each schedule defines what tasks need to be completed during that service

### Maintenance records
Completed service records including: service type, date, odometer/hours at service, provider (internal or external), tasks completed with notes, parts replaced with costs, inspection results for annual inspections, supporting documents, and approval workflow.

### Service providers
Register of workshops and mechanics with contact details, qualifications with expiry tracking, approved service types, and NHVAS Maintenance Standard 8 competence tracking where applicable.

### Defect management
Defect lifecycle from detection to resolution:

- **Sources:** Pre-start check, scheduled inspection, roadside inspection, maintenance finding, driver report, NHVR/NHVL notice
- **Categories:** Brakes, steering, tyres, lights, engine, body, coupling, electrical, hydraulic, other
- **Severity:** Critical (immediate grounding — blocks allocation), major (within 24 hours — blocks after 24h), minor (within 7 days — warning)
- **Workflow:** Reported → assigned to mechanic/workshop → repaired (with cost, parts, notes) → cleared by authorised person
- **Deferral:** Minor defects can be deferred with reason, approver, and deferral date
- **Maintenance linkage:** Junction between maintenance records and defects provides audit trail of which service resolved which defect

### Pre-start checklists
Daily driver inspections before operating a vehicle:

- Structured checklist covering external checks, under-hood, in-cab, and operational items
- Boolean pass/fail per item
- Failed items auto-create defects with appropriate severity and category mapping
- Odometer reading captured at pre-start
- Driver confirmation/sign-off
- **Primarily via DriverX** — the standard path for drivers with the mobile app
- **Paper/manual entry supported** — for drivers without DriverX access, pre-starts can be completed on paper and entered into the system by office staff, or completed via a web form. The system must accommodate both digital and manual pre-start submission.

Nexum currently has 26 hardcoded pre-start check items in fixed groups. The rebuild should make checklist items configurable per tenant (and potentially per vehicle category) — different vehicle types may have different inspection requirements, and tenants may need to add items for specific equipment or regulatory requirements.

## Performance and Utilisation

### Current metrics (carried forward)
Total jobs, total dockets, total tonnes moved, total cubic metres, total hours worked, total loads, revenue generated (tenant assets) or cost incurred (contractor assets), average tonnes per hour/day, utilisation rate (days worked vs days in period), unique drivers assigned, and date range tracking.

### Enhanced metrics (new)
- **Fuel tracking:** Fuel consumption per asset, litres per 100km, cost per kilometre. Fuel captured from dockets, manual entry, or fuel card integration.
- **Downtime analysis:** Time spent in each non-available status (maintenance, repairs, grounded, inspection) vs total time. Identifies problem assets that spend disproportionate time off the road.
- **Cost per kilometre:** Total operating cost (fuel + maintenance + repairs + insurance) divided by distance travelled. Identifies assets becoming expensive to run.
- **Maintenance cost tracking:** Total spend on maintenance per asset over time. Trend analysis to spot escalating maintenance costs.
- **Revenue per kilometre:** For tenant assets — revenue generated relative to distance, identifying the most profitable routes/asset combinations.
- **Driver efficiency by asset:** How different drivers perform with the same asset — tonnes moved, fuel consumption, time per load.

### Ownership-aware analytics
Performance views automatically differentiate:

- **Tenant assets** — Revenue focus: total revenue, GST collected, revenue per tonne, revenue per hour.
- **Contractor assets** — Cost focus: total paid (via RCTI), GST paid, cost per tonne, cost per hour.
- **Combined view** — All assets with ownership indicator, switching metrics as appropriate.

## Driver Assignment

Assets track their current driver assignment and assignment history:

- **Current driver:** Which driver is currently assigned to this asset
- **Assignment history:** Full history of who drove what, when, and why assignments changed
- **Assignment types:** Primary (regular driver), temporary, relief
- **Vehicle qualifications gate:** Only drivers qualified for the asset's vehicle type can be assigned (links to driver vehicle qualifications from doc 03)
- **Compliance gate:** Driver must also pass compliance checks (licence, medical, fitness-for-duty) before assignment

## What's Different from Nexum

| Aspect | Nexum | Rebuild |
|--------|-------|---------|
| Trailer model | Dual approach (inline fields + linked assets) | Linked assets only, with default pairings and trailer removal |
| Custom fields | 3 fields with configurable labels | Configurable field sets per category (name, type, required) |
| Category config | Per-category feature toggles (carries forward) | Same toggles, enhanced custom fields |
| Mass management | Full system managed in Nexum | Consumed from external compliance system — Nexum stores physical specs only |
| Mass schemes | GML/CML/HML/PBS managed locally | Comes from compliance system (future-proof for SMS changes) |
| Compliance | All in Nexum (NHVR, defects, maintenance, prestarts) | External compliance system is the authority; Nexum consumes status |
| Allocation gates | 24+ compliance checks in Nexum | Same rigour, compliance status from external system + local document expiry |
| Contractor gates | Basic compliance check | Full onboarding completion + agreement + insurance + accreditation required |
| Pre-starts | DriverX only, 26 hardcoded items | DriverX primary + paper/manual entry, configurable checklist items |
| Performance | Basic metrics (jobs, tonnes, revenue) | Enhanced: fuel, downtime, cost/km, maintenance cost trends |
| Volume override | Single-level approval | Multi-level approval for larger overrides |

---

*Status: Approved — reviewed and approved by Ryan*
*Created: 2026-03-19 | Session 2*
