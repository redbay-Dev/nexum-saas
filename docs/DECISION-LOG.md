# Decision Log

Every architectural, product, and workflow decision is recorded here with rationale. Agents must add to this log whenever a decision is made during Q&A sessions with Ryan.

---

## Format

```
### DEC-XXX: [Short title]
**Date:** YYYY-MM-DD
**Context:** Why this decision was needed
**Decision:** What was decided
**Rationale:** Why this option was chosen
**Alternatives considered:** What else was considered and why it was rejected
```

---

### DEC-001: Greenfield rebuild, not migration
**Date:** 2026-03-19
**Context:** Nexum is a working Electron app at v0.49.0 but has become monolithic and difficult to maintain. Ryan considered migrating vs rebuilding.
**Decision:** Build the new system from scratch, informed by Nexum's domain knowledge but not constrained by its architecture.
**Rationale:** The Electron coupling, monolithic handler files (5,000+ lines), lack of tests, and IPC-based architecture make incremental migration impractical. A clean start allows proper architecture from day one.
**Alternatives considered:** Phased migration (rejected — too much legacy baggage), feature parity roadmap (rejected — delays shipping usable features).

### DEC-002: Follow SafeSpec architecture patterns
**Date:** 2026-03-19
**Context:** Ryan has started SafeSpec (a WHS/HVA compliance SaaS) with a modern architecture and wants Nexum to follow the same patterns.
**Decision:** Use SafeSpec's monorepo structure (pnpm + Turborepo), tech stack (Fastify, Drizzle, React + shadcn/ui), and documentation conventions.
**Rationale:** Consistency across projects means skills transfer between them. SafeSpec's architecture addresses all of Nexum's current pain points (testability, web deployment, file size limits, proper API layer).
**Alternatives considered:** Next.js (rejected — Ryan prefers separate backend/frontend packages), Remix (rejected — less ecosystem familiarity).

### DEC-003: Documentation-first approach
**Date:** 2026-03-19
**Context:** Starting development without thorough documentation led to Nexum's current state. Ryan wants to get the plan right before writing code.
**Decision:** Create numbered documentation for every system area through Q&A discussion before any code is written. No database schemas or implementation details — just what the system should do.
**Rationale:** Nexum was developed haphazardly and became monolithic. Proper documentation prevents repeating the same mistakes. Q&A ensures Ryan's experience and vision are captured, not just what the code currently does.
**Alternatives considered:** Jump into code (rejected — repeats Nexum's mistakes), hire an architect (rejected — Ryan knows the domain better than any external architect).

### DEC-004: Modular product with core + add-ons
**Date:** 2026-03-19
**Context:** Should the new Nexum be a single monolithic product, modular, or split into separate apps like SafeSpec?
**Decision:** Core product (Jobs, Entities, Scheduling, Dashboard) with optional modules tenants enable as needed (Invoicing, RCTI, Compliance, SMS, Xero, etc.)
**Rationale:** Small operators shouldn't be overwhelmed by features they don't use. Modules can be priced separately. Independent development teams can work on modules in parallel. Most importantly, the compliance module needs to be a standalone package shared with SafeSpec.
**Alternatives considered:** Single unified product (rejected — leads to the same overwhelm problem current Nexum has), separate apps (rejected — too much overhead for features that share data heavily).

### DEC-005: Compliance as a shared package between Nexum and SafeSpec
**Date:** 2026-03-19
**Context:** SafeSpec focuses on WHS/HVA compliance. Nexum includes compliance as one module. Both need the same compliance logic.
**Decision:** Build compliance as a standalone package (`@redbay/compliance-shared`) that both products import. Compliance schemas, services, and UI components live in their own package with their own test suite. Scoped under `@redbay` because it belongs to neither product — it's shared infrastructure owned by Redbay Development.
**Rationale:** Legislation updates, form template changes, and regulatory requirements should be maintained once and flow to both products. Avoids duplicate compliance code that drifts apart over time.
**Alternatives considered:** Build compliance separately in each product (rejected — maintenance nightmare), make SafeSpec a module of Nexum (rejected — different target markets).

### DEC-006: Target market is 50+ truck fleets, both single and multi-depot
**Date:** 2026-03-19
**Context:** Needed to define who Nexum is for to make product decisions.
**Decision:** Primary target is operators with 50+ trucks. System must handle both single-depot large fleets and multi-depot, multi-region operations without assuming either.
**Rationale:** Larger fleets have the operational complexity that justifies a dedicated management system. Smaller operators can use it but shouldn't drive architectural decisions.
**Alternatives considered:** Focus on small operators (rejected — they can get by with simpler tools), focus only on multi-depot (rejected — many large fleets operate from a single base).

### DEC-008: Driver access via DriverX native mobile app, not web portal
**Date:** 2026-03-19
**Context:** Current Nexum has a web portal for both drivers and contractors. Ryan has a separate native mobile app (DriverX) in development for drivers.
**Decision:** Drivers access the system through DriverX (native mobile app), not through the web portal. The contractor portal remains web-based (same Nexum frontend with role-based views). Nexum's API must be designed to serve DriverX as a first-class consumer.
**Rationale:** Drivers are in trucks — they need a native mobile experience, not a responsive web app. A native app can handle offline docket capture, GPS tracking, push notifications, and camera access far better than a web app. Contractors are typically in offices and a web portal suits them fine.
**Alternatives considered:** Single web portal for all external users (rejected — drivers need native mobile capabilities), build driver features into Nexum web as responsive (rejected — DriverX already in development, native is the right choice for this use case).

### DEC-007: Core = Jobs + Entities + Scheduling
**Date:** 2026-03-19
**Context:** In a modular product, what constitutes the core that every tenant gets?
**Decision:** Core includes Jobs, Business Entities (customers, contractors, suppliers, contacts, addresses), Scheduling (resource allocation), and Dashboard. Invoicing is a module, not core — some operators handle invoicing entirely through Xero.
**Rationale:** You can't run a transport operation without jobs, knowing who your customers and contractors are, and scheduling resources. But how you get paid (direct invoicing vs Xero vs third-party accounting) varies by operator.
**Alternatives considered:** Including invoicing in core (rejected — some operators don't use Nexum for invoicing), including compliance in core (rejected — some operators manage compliance separately).

### DEC-009: Tenant is the owner, never a participant
**Date:** 2026-03-19
**Context:** Nexum's dual-table problem put the tenant into `business_companies` alongside customers/contractors/suppliers because invoicing needed a `party_id` FK. This caused constant confusion.
**Decision:** The tenant never appears in the companies table. Their business identity (ABN, logo, addresses, bank details) lives in a dedicated `organisation` profile within their tenant schema. Invoices and RCTI pull "from" details from the organisation profile.
**Rationale:** A tenant is the company using the system, not a participant within it. The Nexum approach was a database shortcut that created an ongoing source of bugs and developer confusion.
**Alternatives considered:** Keeping tenant in companies table with a flag (rejected — repeats Nexum's mistake), putting billing details in public schema only (rejected — operational details like logo and addresses belong in the tenant schema).

### DEC-010: Unified companies table with role tags, not separate entity tables
**Date:** 2026-03-19
**Context:** Should customers, contractors, and suppliers be separate tables or one table with roles?
**Decision:** Single `companies` table with role flags. A company can be customer AND supplier AND contractor simultaneously. UI shows tabbed sections per active role.
**Rationale:** Dual roles happen often in practice (disposal sites both accept and supply materials, some contractors are also customers). Separate tables would mean duplicate records for the same real-world entity.
**Alternatives considered:** Separate tables per type (rejected — forces duplication when entities have multiple roles), separate tables with linking (rejected — added complexity for a common scenario).

### DEC-011: Contacts belong to company OR address (or both)
**Date:** 2026-03-19
**Context:** Should contacts always belong to a company, or can they be tied to physical locations?
**Decision:** Contacts have a parent relationship to a company, an address, or both. No orphan contacts. Supports site contacts (e.g., weighbridge operator at a quarry) who aren't tied to any specific company record.
**Rationale:** In transport, site contacts are important — the person at the pickup or delivery location may not be an employee of the customer company. Requiring a company parent would force creating fake company records.
**Alternatives considered:** Always tied to company only (rejected — doesn't handle site contacts), fully independent contacts (rejected — orphan contacts create data quality issues).

### DEC-012: Regions are geographic areas, separate from depots
**Date:** 2026-03-19
**Context:** How should regions and depots relate? Are they the same thing?
**Decision:** Regions are geographic zones for scheduling (e.g., "North Metro", "Western Districts"). Depots are physical addresses where assets are based. A depot sits within a region. They're separate concepts — a region can have multiple depots or none.
**Rationale:** Some operators use geographic zones that don't map 1:1 to depot locations. Conflating them limits scheduling flexibility.
**Alternatives considered:** Regions = depots (rejected — too rigid for operators with geographic service areas that don't match depot boundaries).

### DEC-013: Addresses are first-class entities with entry points, shared across companies
**Date:** 2026-03-19
**Context:** Addresses in transport are far more complex than a typical CRM. Companies have many addresses, addresses serve multiple roles, and large sites have multiple access points.
**Decision:** Addresses are independent first-class entities that can be shared across companies and roles. A quarry can simultaneously be a supplier site, a customer delivery point, and a disposal site. Each address has many entry points, many contacts, and materials stored at it.
**Rationale:** Duplicating address records per company wastes data and causes sync issues. Transport sites are physical places that exist independently of business relationships. A quarry doesn't stop being a quarry because a different customer needs material from it.
**Alternatives considered:** Addresses owned by a single company (rejected — same physical site is referenced by multiple companies in different contexts), addresses duplicated per relationship (rejected — data quality nightmare).

### DEC-015: Contractor assets need availability states, compliance parity, and smooth scheduling
**Date:** 2026-03-19
**Context:** Nexum has contractor assets in the scheduling system but with poor visibility, messy compliance tracking, and unclear availability.
**Decision:** Rebuild contractor assets with: explicit availability status (available/in use/unavailable/maintenance) that contractors can update via portal, same compliance tracking as tenant assets (rego, insurance, inspections with expiry alerts), and scheduling integration that treats contractor assets identically to tenant-owned assets.
**Rationale:** The scheduler shouldn't care who owns a truck — it cares whether it's available, compliant, and in the right region. Current Nexum makes contractor assets second-class citizens which creates scheduling friction.
**Alternatives considered:** Don't track contractor assets (rejected — tenant needs to schedule them), separate scheduling pools for tenant vs contractor (rejected — adds unnecessary complexity to the scheduling UI).

### DEC-016: Configurable onboarding checklists per tenant
**Date:** 2026-03-19
**Context:** Both customers and contractors need setup steps before they're fully operational. Should onboarding be standardised or flexible?
**Decision:** Configurable per tenant. Each tenant defines their own onboarding requirements with sensible defaults. Onboarding is a living status — if compliance lapses (e.g., insurance expires), status drops back to "requires attention."
**Rationale:** Different operators have different requirements. A large operator with strict compliance needs requires more onboarding steps than a small operator. Hard-coding a single checklist doesn't serve either well.
**Alternatives considered:** Standard checklist only (rejected — too rigid for diverse operator needs), no formal onboarding (rejected — leads to incomplete records and compliance gaps).

### DEC-014: Entry points belong to addresses, jobs select and override
**Date:** 2026-03-19
**Context:** Large sites have multiple access points. Which entry point a driver uses depends on job state, weather, vehicle type, and project stage. Entry points change mid-job.
**Decision:** Entry points are defined on the address (reusable across jobs). When a job references an address, it selects which entry point(s) are active and can add job-specific notes. Entry points carry: GPS coordinates, vehicle/weight restrictions, operating hours/conditions, photos/media, and driver instructions. Dispatcher updates the active entry point on a live job, driver is notified via DriverX.
**Rationale:** Entry points are properties of the physical site, not the job. Gate 3 at a quarry exists whether there's a job or not. But each job may use different gates depending on conditions. The override model (address defines options, job selects from them) gives dispatchers flexibility without duplicating site data.
**Alternatives considered:** Entry points per job only (rejected — loses institutional knowledge about sites), entry points on address only with no job override (rejected — doesn't handle condition-dependent access changes).

### DEC-017: Full customer credit system with hold/stop and credits on account
**Date:** 2026-03-19
**Context:** Nexum has basic credit limits. Ryan needs a full credit management capability.
**Decision:** Customer credit includes: configurable limits, credit hold (blocks new jobs), credit stop (hard stop with review), and credits on account (from overpayments, adjustments, goodwill) that reduce outstanding balance and can be applied against future invoices. Credit status visible everywhere customers are referenced.
**Rationale:** Transport operators need to manage customer payment risk actively. A basic credit limit isn't enough — the ability to hold/stop work and manage credits is essential for cash flow management.

### DEC-018: Contractor self-service documents via portal with approval workflow
**Date:** 2026-03-19
**Context:** Keeping contractor compliance documents current is a burden on tenant admin staff. Contractors should manage their own documentation.
**Decision:** Contractors upload and update documents independently via the portal. Changes require tenant approval before going live. Full version history is maintained. Both parties receive expiry alerts. Notifications route to relevant tenant staff based on document type.
**Rationale:** Reduces admin overhead on the tenant, empowers contractors to keep their own records current, maintains control through the approval workflow, and creates a full audit trail.

### DEC-019: Contractor accounts with extra charges, credits, and reversals
**Date:** 2026-03-19
**Context:** Contractor financial relationship goes beyond RCTI payments. Tenants charge contractors for parking, fuel, equipment hire, etc.
**Decision:** Contractors have a full financial account: RCTI payments, additional charges (tenant-configurable charge types like parking, fuel, admin), credits/reversals for incorrect deductions, and a transparent account statement visible through the portal.
**Rationale:** Keeps the contractor financial relationship clean and transparent. Contractors see exactly what they're paid and what's deducted. Avoids disputes from opaque deductions.

### DEC-020: Tenant-configurable payment terms and charge types
**Date:** 2026-03-19
**Context:** Different tenants operate with different payment structures and cost pass-throughs.
**Decision:** Payment term options (7 days, 14 days, 30 days, EOM, etc.) and contractor charge types (parking, fuel, equipment hire, etc.) are tenant-configurable, not hardcoded.
**Rationale:** Hardcoding business rules limits the system to one operator's workflow. Transport companies have diverse arrangements with customers and contractors.

### DEC-021: Digital contractor onboarding with e-signatures and PDF pre-fill
**Date:** 2026-03-19
**Context:** Contractor onboarding is complex (17+ sections in real-world packs covering legal, compliance, financial, and operational requirements). Currently paper-based or manual.
**Decision:** The system supports full digital onboarding: configurable pack contents per tenant, PDF pre-fill with known data, digital form completion via portal, e-signatures, document upload, and progress tracking. Different contractor types can get different packs.
**Rationale:** Digitising the onboarding pack reduces paper, speeds up contractor setup, creates a complete digital record, and integrates directly with the compliance tracking system. The FTG Subcontractor Onboarding Pack demonstrates the level of detail needed.

### DEC-022: Full employee management, not just drivers
**Date:** 2026-03-19
**Context:** Nexum only tracks drivers. Ryan wants to manage all employees regardless of role.
**Decision:** Every employee gets a record: drivers, yard staff, mechanics, admin, management. Not everyone accesses the system the same way — operational staff use the web app, drivers use DriverX, some employees don't use either. Nexum is not a payroll/HR system — it captures operational, compliance, and timesheet data, leaving pay processing to Xero or dedicated payroll.
**Rationale:** Compliance, onboarding, and operational management apply to all staff, not just drivers. A yard worker needs WHS induction tracking just as much as a driver needs licence tracking.

### DEC-023: Fully configurable qualification types
**Date:** 2026-03-19
**Context:** Different tenants require different qualifications from their drivers and staff.
**Decision:** The tenant defines all qualification types: name, whether it expires, required evidence, notes. The system comes with common defaults (heavy vehicle licence, medical, construction card, operator tickets) but the tenant can add, modify, or remove qualification types to match their operation.
**Rationale:** Hardcoding qualification types limits the system to one operator's requirements. Transport companies work across different sectors (construction, mining, general freight) with different qualification needs.

### DEC-024: Timesheets capture classified hours for payroll export, not pay calculation
**Date:** 2026-03-19
**Context:** Tenant drivers need timesheets with full award-level detail. Should Nexum calculate pay or just capture hours?
**Decision:** Nexum captures hours classified into award-aligned categories (ordinary, OT1, OT2, weekend, public holiday, breaks, travel, standby). It exports this classified data to the tenant's payroll system. Nexum does NOT calculate pay — the payroll system applies rates and calculates gross. Time categories, overtime thresholds, and classification rules are tenant-configurable.
**Rationale:** Award interpretation is complex, varies by enterprise agreement, and is already handled by payroll systems. Nexum's value is capturing and classifying the raw hours from job data and manual entry — turning operational time into payroll-ready data. Trying to replicate full award calculation duplicates functionality and creates liability.

### DEC-025: Contractor driver timesheets are tenant-configurable
**Date:** 2026-03-19
**Context:** Contractor drivers are generally paid by their own contractor, so timesheets aren't needed by default. But some tenants may want to track contractor driver time for operational purposes.
**Decision:** Contractor driver timesheets are off by default but tenant-configurable. If enabled, they capture the same data as tenant driver timesheets.
**Rationale:** Flexibility without adding complexity for tenants who don't need it.

### DEC-026: Employee onboarding follows same configurable pattern as contractors
**Date:** 2026-03-19
**Context:** Employee onboarding needs to support multiple position types with different requirements.
**Decision:** Same configurable checklist pattern as contractor onboarding (doc 02). Tenant creates onboarding templates per role (driver, yard staff, mechanic, admin). Living status that drops back to "requires attention" if compliance lapses.
**Rationale:** Consistency across all onboarding workflows. The same engine handles contractor and employee onboarding, just with different templates.

### DEC-027: Trailers as independent assets with default pairings, drop inline fields
**Date:** 2026-03-19
**Context:** Nexum has both inline trailer fields on truck records (legacy) and linked trailer assets (modern). This dual approach causes data duplication and confusion.
**Decision:** Drop inline trailer fields entirely. Every piece of rolling stock (truck, trailer, dog trailer) is an independent asset record. Trailers can have a default prime mover pairing that pre-selects in job creation, but dispatchers can override at job level.
**Rationale:** Independent records allow proper compliance tracking, maintenance scheduling, and flexible reassignment. Default pairings save time for fleets that rarely change combinations without locking them in.
**Alternatives considered:** Independent assets with no default pairings (rejected — too much dispatcher effort for stable fleets), keeping both inline and linked (rejected — repeats Nexum's data duplication problem).

### DEC-028: Mass management consumed from external compliance system, not managed in Nexum
**Date:** 2026-03-19
**Context:** Nexum has a sophisticated mass management system with vehicle configurations, mass schemes (GML/CML/HML/PBS), legal limit calculations, steer axle allowance, and tenant-overridable rules. However, the NHVL mass scheme framework is changing with the introduction of the new SMS (Safety Management System) in 2026.
**Decision:** Nexum stores physical asset specs (tare, manufacturer GVM/GCM) and vehicle configuration assignment locally. Mass scheme definitions, mass limit rules, legal limit calculations, and all compliance-related mass data comes from the external compliance system (SafeSpec or equivalent). Nexum consumes this data for operational use (scheduling, docket processing, performance analytics).
**Rationale:** The regulatory framework is changing. Having mass rules in one place (the compliance system) means changes only need to happen once. Nexum doesn't need to be updated when regulations change. Single source of truth across both systems.
**Alternatives considered:** Keep full mass management in Nexum (rejected — would need updating when SMS is introduced, duplicates effort with compliance system), remove mass entirely from Nexum (rejected — Nexum still needs mass data for operational decisions like payload calculations and scheduling).

### DEC-029: No fallback — Nexum and compliance system are separate systems, not standalone alternatives
**Date:** 2026-03-19
**Context:** Earlier discussion considered building Nexum with standalone compliance that could optionally be replaced by SafeSpec. Ryan corrected: having a fallback adds confusion and unnecessary code.
**Decision:** Nexum and the compliance system (SafeSpec or equivalent) are two separate systems. Nexum consumes compliance data, period. There is no standalone compliance mode in Nexum. The exact shape of the compliance system (whether SafeSpec, a new purpose-built system, or something else) is undecided, but the architecture is clear: compliance lives outside Nexum.
**Rationale:** A fallback means maintaining two code paths — one local, one API-based — which doubles the maintenance burden and creates confusion about which is the source of truth. Clean separation: Nexum = operations, compliance system = compliance.
**Alternatives considered:** Standalone with optional SafeSpec integration (rejected by Ryan — adds unnecessary code and confusion), everything in Nexum (rejected — compliance is a distinct concern being built separately).

### DEC-030: Enhanced asset performance tracking — fuel, downtime, cost per km
**Date:** 2026-03-19
**Context:** Nexum tracks basic asset performance (jobs, tonnes, revenue/cost, utilisation). Ryan wants more comprehensive fleet analytics.
**Decision:** Enhance performance tracking to include: fuel consumption and cost per km, downtime analysis (time in each non-available status), maintenance cost trends, revenue per km, and driver efficiency per asset. Retain all existing metrics.
**Rationale:** Fleet operators need to identify underperforming or expensive assets. Basic job/tonne metrics don't show the full picture — fuel efficiency, downtime patterns, and escalating maintenance costs are key operational indicators.
**Alternatives considered:** Deferring all performance to reporting module (rejected — some metrics need to be visible on the asset record, not just in reports).

### DEC-031: Configurable custom fields per asset category, expanding on Nexum's 3-field limit
**Date:** 2026-03-19
**Context:** Nexum already has 3 custom fields per category with configurable labels, plus per-category feature toggles (enableSpecifications, enableWeightSpecs, enableMassScheme, enableEngineHours, enableCapacityFields, enableRegistration). The feature toggles work well and carry forward. The 3-field limit is the constraint.
**Decision:** Keep existing per-category feature toggles as-is. Expand custom fields from 3 fixed text fields to a configurable field set: tenants define fields per category with name, type (text, number, date, dropdown), and whether required. Volume override carries forward with improved multi-level approval.
**Rationale:** The toggles solve the problem of hiding irrelevant sections per category — that pattern works. The custom field expansion handles the remaining gap: category-specific attributes that don't fit the standard fields.
**Alternatives considered:** Keep 3 fixed fields (rejected — too limiting for diverse operations), unlimited free-form fields (rejected — needs structure for reporting).

### DEC-032: Trailer removal from jobs is a first-class operation
**Date:** 2026-03-19
**Context:** Some jobs don't require trailers (rigid truck work), and mid-job changes (site access, weather, project stage) can mean a trailer needs to be removed.
**Decision:** Removing a trailer from a job — at creation or mid-job — is a supported, explicit operation. Mass recalculates for the remaining vehicle. The trailer becomes available for other allocations immediately.
**Rationale:** Not all work needs a combination. Site conditions change. Treating trailer-less as a valid state (not an edge case) prevents dispatchers from working around the system.
**Alternatives considered:** None — this was identified as a critical gap in the initial draft.

### DEC-033: Assets only allocatable when all compliance and contractor onboarding is complete
**Date:** 2026-03-19
**Context:** Nexum already has 24+ compliance checks that gate asset allocation (document expiry, operational status, defects, fatigue, contractor agreements, pre-starts). Ryan confirmed this is essential and contractor onboarding must also be a hard gate.
**Decision:** Strict compliance gating on all allocations. An asset cannot be scheduled unless: compliance status passes (from external system), all local document gates pass (configurable per tenant with grace periods), contractor onboarding is complete (for contractor assets), and pre-start requirements are met (configurable enforcement level). Override mechanism exists for exceptional circumstances with full audit trail.
**Rationale:** Assigning non-compliant resources to jobs creates legal and safety liability. The system must enforce this, not just advise.
**Alternatives considered:** Soft warnings only (rejected — too easy to ignore, creates liability).

### DEC-034: Pre-start checklists support DriverX, paper, and web entry; items configurable per tenant
**Date:** 2026-03-19
**Context:** Nexum's pre-start has 26 hardcoded check items in fixed groups, submitted via DriverX only. Not all drivers have DriverX access, and different vehicle types may need different checks.
**Decision:** Pre-starts are primarily via DriverX but must also support paper-based pre-starts entered by office staff and web-form completion. Checklist items should be configurable per tenant and potentially per vehicle category, not hardcoded.
**Rationale:** Real-world operations have drivers without smartphones, casual workers, borrowed equipment. The system must accommodate all submission methods. Different vehicle types genuinely have different inspection requirements (a truck vs an excavator).
**Alternatives considered:** DriverX only (rejected — excludes drivers without the app), hardcoded items only (rejected — doesn't serve diverse vehicle types or regulatory changes).

### DEC-035: Keep separate material tables per source, rebuild cleaner
**Date:** 2026-03-19
**Context:** Nexum has 4 separate material tables (company, supplier, customer, disposal). Initially considered simplifying to a single table, but Ryan corrected: separate tables are architecturally correct because each source has different fields (buy vs sell pricing), different naming conventions (every party names materials differently), and different configuration needs.
**Decision:** Keep separate tables per source (tenant, supplier, customer, disposal) plus disposal site settings. Rebuild them cleaner with consistent shared patterns (all link to material type hierarchy, all link to addresses, all carry compliance flags, all have unit of measure). Disposal site settings remain a separate table for site-level configuration.
**Rationale:** A single table with nullable columns for every source context would be confusing — most fields wouldn't apply to most rows. Separate tables correctly model the genuinely different data structures while shared patterns ensure consistency.
**Alternatives considered:** Single table with source_type flag (rejected by Ryan — different sources have fundamentally different fields and naming, forcing them together adds confusion).

### DEC-036: Material pricing behaviours carry forward, configuration deferred to doc 09
**Date:** 2026-03-19
**Context:** Nexum's pricing behaviours (transport_revenue, material_cost, material_resale, tracking_only) are conceptually right but the configuration experience is confusing — too many places to set rates (supplier level, customer level, markup rules, job level).
**Decision:** Pricing behaviour concepts carry forward as-is. Configuration cleanup (making it less confusing for users) is covered in doc 09 (Pricing Engine) where the full rate precedence and configuration approach will be defined.
**Rationale:** The behaviours reflect real-world scenarios. The problem is the UX of configuring prices, not the pricing model itself. This is better addressed holistically in the pricing doc.
**Alternatives considered:** Simplifying to just "rate per unit" (rejected — doesn't cover material resale or tracking-only scenarios).

### DEC-037: Material compliance stays in Nexum — it's operational data
**Date:** 2026-03-19
**Context:** Material compliance (hazardous, DG, EPA, regulated waste) could move to the external compliance system like asset compliance, or stay in Nexum.
**Decision:** Material compliance stays in Nexum. It's operational data about what's being transported — the driver and dispatcher need to know immediately if a load has special handling requirements. This is different from asset compliance (regulatory accreditation status).
**Rationale:** Material compliance flags are needed at the point of job creation and dispatch. They're properties of the material being moved, not regulatory status of the operator. Keeping them in Nexum avoids an API call for every material lookup.
**Alternatives considered:** External compliance system (rejected — adds latency and dependency for fundamental operational data).

### DEC-038: Disposal sites keep dual nature (accept + supply) with site settings
**Date:** 2026-03-19
**Context:** Nexum models disposal sites as dual-purpose: they accept waste (with tip fees) and supply recycled material (with sale prices). Site-level settings track operating hours, EPA licence, accepted materials, credit terms.
**Decision:** Carry forward as-is. This accurately reflects how disposal sites operate in practice.
**Rationale:** Real disposal sites genuinely do both — accept concrete waste and sell crushed recycled concrete, accept soil and sell screened clean fill. The dual material_mode (disposal/supply) per material record handles this cleanly.
**Alternatives considered:** None — the model is accurate.

### DEC-039: Immutable material snapshots in jobs carry forward
**Date:** 2026-03-19
**Context:** Nexum freezes material data (name, price, compliance flags) at job creation as an immutable snapshot. Price changes don't affect existing jobs.
**Decision:** Keep immutable snapshots. You need to know what was quoted, not what the current price is.
**Rationale:** Financial integrity requires that job pricing doesn't change retroactively. Compliance audit requires knowing what was declared at the time of transport, not the current classification.
**Alternatives considered:** None — this is a fundamental requirement.

### DEC-040: Material type hierarchy carries forward (12 categories, ~139 subcategories)
**Date:** 2026-03-19
**Context:** Nexum has a two-level hierarchy of material types. Useful for filtering and reporting, especially for tenants dealing with many material types.
**Decision:** Keep the hierarchy. Categories and subcategories are tenant-configurable with system-seeded defaults.
**Rationale:** The hierarchy helps organise what would otherwise be a sprawling flat list. Tenants dealing with dozens of material types across multiple suppliers benefit from categorical grouping.
**Alternatives considered:** Flat list only (rejected — doesn't scale for tenants with many material types), optional hierarchy (considered but hierarchy is lightweight enough that forcing it doesn't add burden).

### DEC-041: Subcontractor rates are always fixed value, never percentage
**Date:** 2026-03-19
**Context:** Nexum has both fixed and percentage subcontractor rate types. Ryan confirmed percentage was added in error and never removed.
**Decision:** Subcontractor rates are always a fixed value. Typically ~10% less than the job rate (for hourly work) or the material rate (for contract-based work). No percentage option.
**Rationale:** This reflects how subcontractor rates actually work in practice. The percentage option was a Nexum mistake that was never corrected.
**Alternatives considered:** Keep both fixed and percentage (rejected — percentage was an error in Nexum).

### DEC-042: Database-first real-time only — no V1/V2 split
**Date:** 2026-03-19
**Context:** Nexum has a V1 (state-based) and V2 (database-first) job system with a feature flag. Multiple users need to use the system simultaneously.
**Decision:** Database-first only. The database is the single source of truth. Every change is written immediately. Frontend subscribes to changes in real-time. No batching, no local state divergence.
**Rationale:** Multi-user real-time operation requires a single source of truth. The V1 approach of holding state in the frontend and batching updates is fundamentally incompatible with concurrent use.
**Alternatives considered:** None — real-time database-first is the only viable approach for multi-user web SaaS.

### DEC-043: Job types tenant-configurable, drive form behaviour
**Date:** 2026-03-19
**Context:** Nexum has 11 default job types that are essentially labels — they don't control what the form shows or which fields are required.
**Decision:** Job types are fully tenant-configurable and control form behaviour: which sections are visible, which fields are required, which pricing methods are available, and what defaults are applied. Simpler default set (Transport, Disposal, Hire, On-site) as starting points.
**Rationale:** Different tenants have different work types. A hire company doesn't need material sections. A disposal-focused tenant always needs disposal site selection. Job types should reflect this rather than being cosmetic labels.
**Alternatives considered:** Keep types as labels (rejected — doesn't help users, adds no value).

### DEC-044: Jobs start as draft, no auto-save, explicit confirm
**Date:** 2026-03-19
**Context:** Nexum auto-saves drafts every 30 seconds, which creates confusion — half-finished jobs appear in the system. Ryan wants drafts by default but explicit save.
**Decision:** All new jobs start as a draft. Drafts are not visible in the scheduler. No auto-save — the user saves when ready. A draft becomes a live job when the user explicitly confirms it. This replaces the broken auto-save system.
**Rationale:** Auto-save caused confusion by persisting incomplete work. Explicit save + explicit confirm gives users control over when their work becomes visible to the rest of the system.
**Alternatives considered:** Keep auto-save (rejected — creates confusion), no drafts at all (rejected — users need a way to work on jobs before committing them).

### DEC-045: Multi-customer, parent/child, and cloning all carry forward
**Date:** 2026-03-19
**Context:** Nexum supports multi-customer jobs (billing splits), parent/child jobs (complex work breakdown), and job cloning.
**Decision:** All three carry forward. They serve real operational needs.
**Rationale:** Multi-customer jobs handle shared site work. Parent/child handles complex projects. Cloning saves time for recurring work.
**Alternatives considered:** Dropping parent/child (rejected — needed for complex projects).

### DEC-046: Simplified job lifecycle — single status, consistent naming
**Date:** 2026-03-19
**Context:** Nexum has three overlapping concepts: status, workflow_stage, workflow_substatus. The naming is inconsistent across the app (planning vs pending vs entry).
**Decision:** Single status field. Core statuses: Draft → Confirmed → Scheduled → In Progress → Completed → Invoiced (plus Cancelled and Quote path). Tenants can add custom intermediate statuses. Status names are consistent everywhere — scheduler, job list, reports, notifications, portal, DriverX all use the same terms.
**Rationale:** Three overlapping status concepts confuse users and developers. One clear status with consistent naming eliminates ambiguity.
**Alternatives considered:** Keep the three-layer system (rejected — confusing).

### DEC-047: Mid-job edits allowed with restrictions and variation tracking
**Date:** 2026-03-19
**Context:** Jobs change mid-flight (scope changes, site conditions, customer modifications). Nexum's current system makes mid-job edits difficult.
**Decision:** Most things are editable at most stages. Changes after confirmation create a variation record with reason. Relevant parties notified via SMS. Restrictions: can't change customer after dockets processed, can't remove materials/locations with processed dockets, pricing locked after invoicing (changes require credit note).
**Rationale:** Real operations require flexibility. The system should support change, not prevent it — while protecting financial integrity and maintaining an audit trail.
**Alternatives considered:** Everything editable always (rejected — need to protect processed dockets and invoiced financials), lock everything after confirmation (rejected — too rigid for real-world operations).

### DEC-048: Section-level collaboration for concurrent editing
**Date:** 2026-03-19
**Context:** Multiple users need to work on jobs simultaneously. Nexum's editing locks are broken. Auto-inviting isn't wanted.
**Decision:** Real-time visibility of who's viewing/editing. Section-level interaction: if two users edit the same section, the second is notified and can wait or force. Different sections (pricing, locations, materials, assignments) can be edited by different users simultaneously.
**Rationale:** Full Google Docs-style collaboration is overengineered for this use case. Section-level awareness strikes the right balance — prevents conflicts without blocking legitimate parallel work.
**Alternatives considered:** Full real-time collaboration (rejected — overengineered), whole-job locking (rejected — too restrictive), optimistic concurrency (rejected — conflict resolution is confusing for non-technical users).

### DEC-049: AI provider-flexible, system-wide where beneficial
**Date:** 2026-03-19
**Context:** Nexum uses Google Gemini for AI job parsing only. Ryan wants broader AI use and provider flexibility.
**Decision:** Abstract AI interface with provider adapters (OpenAI, Anthropic, Google). Tenant chooses and configures their provider. AI applied across the system: job parsing, entity resolution, scheduling suggestions, pricing analysis, in-app help/guidance, anomaly detection. Not locked to one provider or one feature.
**Rationale:** AI providers evolve rapidly — locking to one creates dependency risk. AI value extends well beyond job parsing into scheduling, pricing, and user assistance.
**Alternatives considered:** Gemini only (rejected — lock-in risk), no AI (rejected — competitive disadvantage and missed efficiency gains).

### DEC-050: Multiple scheduler view modes (table + timeline/Gantt)
**Date:** 2026-03-19
**Context:** Nexum's scheduler is table-only. Different users prefer different views.
**Decision:** Support both table view (data-centric, filterable, the primary working view) and timeline/Gantt view (visual blocks across time, drag-drop allocation, shows overlaps). Switchable modes, same underlying data.
**Rationale:** Table works for dispatchers focused on data and filtering. Timeline works for visual planning and spotting gaps/overlaps. Both serve different working styles.
**Alternatives considered:** Table only (rejected — misses visual planning capability), timeline only (rejected — table is more efficient for data-heavy operations).

### DEC-051: Double-booking allowed with visual warning
**Date:** 2026-03-19
**Context:** Nexum allows the same asset on multiple jobs silently. Assets genuinely work multiple jobs in a day.
**Decision:** Allow multi-allocation but show visual warnings when allocations have overlapping time windows. Show allocation count per asset. Dispatchers make the operational call — the system warns, doesn't block.
**Rationale:** Blocking double-booking would break legitimate workflows (morning + afternoon jobs). Silent double-booking risks genuine conflicts going unnoticed. Warning strikes the right balance.
**Alternatives considered:** Block overlapping (rejected — too restrictive), silent as-is (rejected — misses genuine conflicts).

### DEC-052: Multi-factor recommendation scoring with tenant-configurable weights
**Date:** 2026-03-19
**Context:** Nexum's recommendations use 2 factors (region + ranking). Ryan wants all relevant factors considered.
**Decision:** Recommendation scoring includes: region match, entity ranking, availability (concurrent allocations), proximity (distance to job), hours worked (fatigue/balance), maintenance proximity (upcoming service), driver preference, and capability match. Scoring weights are tenant-configurable.
**Rationale:** More factors produce better recommendations. Different tenants weight factors differently (some prioritise region, others availability). Configurable weights serve diverse operations.
**Alternatives considered:** Keep 2-factor scoring (rejected — misses important operational factors), fixed weights (rejected — different operations have different priorities).

### DEC-053: Proper recurring schedules with auto-job creation
**Date:** 2026-03-19
**Context:** Nexum has schedule template infrastructure but it's barely implemented.
**Decision:** Full recurring schedule system: recurrence patterns (daily, weekly, monthly, custom), job templates with pre-set allocations, automatic job creation with configurable lead time, per-occurrence override and skip capability. Plus manual templates for irregular patterns.
**Rationale:** Recurring work is common in transport (weekly quarry runs, daily site deliveries). Auto-creating scheduled jobs reduces dispatcher effort and ensures nothing falls through the cracks.
**Alternatives considered:** Templates only without auto-creation (rejected — still requires manual job creation each time).

### DEC-054: Route optimization and backhaul integrated into scheduler, not separate
**Date:** 2026-03-19
**Context:** Nexum has route/backhaul features as a separate area. Ryan corrected: these are scheduling decisions.
**Decision:** Route awareness, backhaul detection, and multi-stop optimization are integrated into the scheduler. When recommending assets, the system considers routes. Backhaul opportunities are flagged to the dispatcher or AI allocator. Doc 19 covers the map/planning tools, but the scheduler is where route decisions are acted on.
**Rationale:** Route optimization directly affects allocation decisions. Separating it forces dispatchers to work in two places. Integration means better recommendations and the AI allocator can factor in routes automatically.
**Alternatives considered:** Keep as separate feature (rejected by Ryan — it's a scheduling decision).

### DEC-055: Table view keeps line and multi-line display modes from Nexum
**Date:** 2026-03-19
**Context:** Nexum's table view has two modes: line (one row per job) and multi-line (one row per assigned asset within a job).
**Decision:** Both display modes carry forward. Line view for overview, multi-line for seeing all allocations per job. Essential when jobs have 1 to 300 allocations.
**Rationale:** Both modes serve different situations. Line view is compact for scanning. Multi-line is necessary for large jobs with many allocations.
**Alternatives considered:** None — both are needed.

### DEC-056: Extensive partial-match search on every page — app-wide principle
**Date:** 2026-03-19
**Context:** Ryan emphasised that search needs to be extensive across the entire app, not just the scheduler. Partial word matching, search across all fields.
**Decision:** Every page in the application supports searching by anything, with partial word matching. On the scheduler: job number, name, customer, project, locations, materials, assets (rego, make, model), drivers, contractors, contacts, requirements. App-wide: the same principle applies to every list/table/view.
**Rationale:** Users shouldn't have to know the exact term or which field contains it. Partial match reduces friction and speeds up daily operations.
**Alternatives considered:** None — this is a fundamental UX requirement.

### DEC-057: Scheduler opens in separate windows via date tab clicks
**Date:** 2026-03-19
**Context:** Nexum opens scheduling in a new window when clicking date tabs. Users view main app and scheduling simultaneously.
**Decision:** Carry forward. Clicking date tabs opens the scheduler for that date in a new window. Multiple scheduling windows can be open simultaneously (today + tomorrow for planning ahead).
**Rationale:** Dispatchers need to see the main application and scheduling side by side. This is how they work and it should be preserved.
**Alternatives considered:** None — it works.

### DEC-058: Asset requirement matching at subcategory level, not just category
**Date:** 2026-03-19
**Context:** Initial doc said matching was at category level ("2 Tippers"). Ryan corrected: subcategories define specific equipment types — a Side Tipper is not an End Tipper is not a Body Truck.
**Decision:** Allocation matching is at the subcategory level. A job requiring "2 Side Tippers" only matches assets with the Side Tipper subcategory, not any Tipper. Categories are too broad.
**Rationale:** Transport operations require specific equipment types. The wrong tipper type at a job site can mean the load can't be tipped, wasting time and money.
**Alternatives considered:** Category-level matching (rejected — too imprecise for real operations).

### DEC-059: Job status transitions are context-aware (past start time → In Progress)
**Date:** 2026-03-19
**Context:** Initial doc said allocation always transitions job to "Scheduled". Ryan corrected: if the job's scheduled start time has already passed, it should transition to In Progress or the appropriate active status.
**Decision:** Status transitions on allocation are context-aware. If the scheduled start time is in the future → Scheduled. If the scheduled start time has passed → In Progress (or appropriate active status). The system shouldn't keep a job at "Scheduled" when it's already meant to be running.
**Rationale:** Reflects operational reality — jobs that are being allocated after their start time are already active.
**Alternatives considered:** Always → Scheduled regardless of time (rejected — creates misleading status).

### DEC-060: AI-driven auto-allocation with progressive tenant control
**Date:** 2026-03-19
**Context:** Ryan wants AI agents to take over routine allocation decisions to reduce staffing requirements. Also wants machine learning/training built in.
**Decision:** Build the scheduler with AI allocation in mind from the start. Progressive levels: fully manual (recommendations only), AI proposes + human confirms, AI auto-allocates routine + human handles exceptions, full auto-allocation with oversight dashboard. ML training from historical patterns, dispatcher overrides as feedback, and outcome correlation (on-time, efficiency, cost). Tenant controls the level of AI involvement.
**Rationale:** Manual dispatching is labour-intensive and doesn't scale. AI allocation using the same scoring model as recommendations is a natural extension. Progressive control builds trust. The long-term goal is significantly reduced dispatching staff.
**Alternatives considered:** No AI in scheduling (rejected — misses major efficiency and cost reduction opportunity), full AI from day one (rejected — needs trust-building and training data first).

### DEC-061: All recommendation factors overridable for operational situations
**Date:** 2026-03-19
**Context:** Maintenance proximity scoring was mentioned as lowering an asset's score. Ryan corrected: need the ability to override based on operational situations.
**Decision:** Every recommendation factor can be overridden. Recommendations inform, they don't restrict. Only compliance gates are hard blocks. A dispatcher or AI allocator can use an asset approaching maintenance if the operational need justifies it.
**Rationale:** Operational reality requires flexibility. An asset 50km from service might be the only one available for a critical job. The system should flag it, not prevent it.
**Alternatives considered:** Strict enforcement of all factors (rejected — too rigid for real operations).

### DEC-062: Daysheets and dockets are separate document types, linked to the same job
**Date:** 2026-03-19
**Context:** Nexum mixes daysheets and dockets under one "docket" concept. They're fundamentally different: daysheets are the driver's work record (primary), dockets are external supplier documents (supporting evidence) that may or may not exist.
**Decision:** Separate document types with their own workflows. Daysheet = primary work record, always exists, drives charge creation. Dockets = external documents (weighbridge tickets, tip receipts), matched to daysheets for reconciliation. Both linked to the same job.
**Rationale:** Mixing them creates confusion about what the "docket" is. Separating them clarifies the workflow: process the daysheet to generate financials, reconcile against dockets for verification.
**Alternatives considered:** Keep mixed (rejected — causes confusion), completely independent (rejected — they need to be linked for reconciliation).

### DEC-063: AI docket reading (OCR) for pre-populating fields from images
**Date:** 2026-03-19
**Context:** Currently all docket data is manually entered. Weighbridge tickets and tip receipts are photographed but numbers are typed in by hand.
**Decision:** AI reads uploaded docket images and pre-populates form fields (weights, quantities, material types, dates). Uses the provider-flexible AI architecture. Confidence scores per field. Low-confidence highlighted. Human always confirms before processing. Full manual entry remains available as fallback.
**Rationale:** Major time-saver for processing teams. Reduces transcription errors. Docket images are already being uploaded — extracting data from them is a natural extension.
**Alternatives considered:** Manual only (rejected — too slow for volume operations), fully automated without human review (rejected — accuracy can't be guaranteed).

### DEC-064: Batch + auto-processing for dockets/daysheets
**Date:** 2026-03-19
**Context:** Nexum processes dockets one at a time. Busy operators handle hundreds per day.
**Decision:** Two mechanisms: auto-processing for clean data (within tolerances, no overages, all fields present) that flows through without human intervention, AND batch processing for items needing review (select multiple, review exceptions, bulk approve). Goal: minimal human effort on routine items, staff focus on exceptions only.
**Rationale:** One-at-a-time processing doesn't scale. Between DriverX automation, AI reading, and auto-processing, most routine dockets should require zero human interaction.
**Alternatives considered:** Batch only without auto (rejected — still requires human review of clean data), auto only without batch (rejected — exceptions need efficient bulk handling).

### DEC-065: Overage system improved — streamlined approval, tolerance tiers, pattern detection
**Date:** 2026-03-19
**Context:** Nexum's overage approval is cumbersome (too many clicks), capping logic lacks nuance (no tolerance tiers), and there's no pattern detection for repeated overages.
**Decision:** Three improvements: (1) Streamlined approval — one-click approve, bulk approval, configurable routing by overage severity. (2) Tolerance tiers — minor overages within secondary tolerance auto-approve, significant overages require full approval. Per-material and per-customer tolerance settings. (3) Pattern detection — track overages by driver/asset/route/customer, identify systemic issues (wrong tare weight, miscalibrated weighbridge, habitual overloading), dashboard with trends, feed into compliance system for CoR obligations.
**Rationale:** A 0.5% overage on a 25-tonne load shouldn't trigger the same workflow as a 10% overage. Pattern detection catches safety and compliance issues that individual overage approval misses.
**Alternatives considered:** Keep current approach (rejected — too cumbersome and misses patterns).

### DEC-066: Company driver daysheets feed directly into timesheets
**Date:** 2026-03-19
**Context:** Company drivers currently enter timesheets separately from their work records. DriverX will automate capture but manual entry must remain.
**Decision:** The daysheet captures time data (start/end, hours, overtime, breaks) that flows directly into the driver's timesheet (doc 03). No double-entry — work recorded once, used for both operational records and payroll export.
**Rationale:** Reduces admin overhead and eliminates discrepancies between work records and timesheets. DriverX automates capture; daysheet is the single entry point.
**Alternatives considered:** Separate systems (rejected — double-entry is wasteful and error-prone).

### DEC-067: RCTI progression gates on invoice status and staff approval, not auto-creation
**Date:** 2026-03-19
**Context:** Ryan clarified RCTI behaviour ahead of doc 10 discussion. RCTI auto-creation should be part of the approval process, not a standalone action.
**Decision:** RCTI progression is gated — it doesn't advance until the corresponding invoice is generated, paid, or approved by selected staff (tenant-configurable gate). Once an RCTI reaches its preserved date, the user can batch-send RCTIs as emails. This is approval-driven, not time-driven.
**Rationale:** RCTIs are financial documents with legal obligations. They shouldn't progress automatically without proper approval. Batch email on preserved date keeps the workflow efficient while maintaining control.
**Alternatives considered:** Auto-progress on creation (rejected — skips approval), individual send only (rejected — batch is essential for volume).

### DEC-068: All 6 pricing methods and 5 pricing behaviours carry forward
**Date:** 2026-03-19
**Context:** Nexum has 6 pricing methods (Hourly, Tonnage, Volume, Distance, Unit, Fixed) and 5 behaviours (transport_revenue, material_cost, material_resale, tracking_only, buyback).
**Decision:** All carry forward as-is. They cover the full range of transport/logistics pricing scenarios.
**Rationale:** These are well-established, proven pricing patterns that map directly to how transport operations work. No gaps, no redundancy.
**Alternatives considered:** None — all are needed and in active use.

### DEC-069: Markup rules and margin warnings carry forward with improved UX
**Date:** 2026-03-19
**Context:** Nexum has priority-based markup rules and a 10% margin warning threshold. Configuration UI was noted as confusing.
**Decision:** Keep both systems, improve the configuration UX. Add rule preview, test mode, visual priority ordering, and conflict detection. Expand margin controls beyond a single threshold.
**Rationale:** The underlying systems work correctly — the problem is usability, not functionality.
**Alternatives considered:** Redesign markup from scratch (rejected — the priority-based model works, just needs better UX).

### DEC-070: Multi-level margin thresholds (global, per-customer, per-material, per-category)
**Date:** 2026-03-19
**Context:** Nexum has a single 10% margin warning. Different customers, materials, and pricing categories have naturally different margin profiles.
**Decision:** Configurable thresholds at four levels: global default, per pricing category, per customer, per material type. Most specific wins. Visual warnings, reason required for override, full audit trail.
**Rationale:** A single threshold is too blunt. Large-volume customers have thinner margins by nature. Some materials are inherently low-margin. The system should reflect this reality.
**Alternatives considered:** Single configurable threshold (rejected — too simplistic), tiered warning levels (considered — could be added later as an enhancement).

### DEC-071: Price history with effective dates — essential, keep and improve
**Date:** 2026-03-19
**Context:** Nexum tracks material price changes with effective dates and supports bulk/CSV updates.
**Decision:** Essential feature, carry forward with improved UI. Better visibility of price history timeline, improved bulk update tools, CSV import with validation and preview.
**Rationale:** Transport pricing changes frequently (fuel surcharges, supplier rate reviews). Effective date tracking ensures jobs are priced correctly based on when they occur, not when they're entered.
**Alternatives considered:** Simplify to current + previous only (rejected — need full history for audit and rate review negotiations).

### DEC-072: Customer rate cards with auto-apply and per-job override
**Date:** 2026-03-19
**Context:** Key customers negotiate specific rates. Nexum tracked whether customer pricing was used but didn't have formal rate cards.
**Decision:** Combination approach: formal rate cards for key customers (per-material and per-service rates with effective dates), auto-applied when a job is created for that customer, with per-job override capability. Standard rates used when no rate card exists. Flagging when customer rates are in use.
**Rationale:** Key customers expect negotiated rates applied consistently. Per-job override handles exceptions. Auto-apply reduces manual effort and ensures agreed rates are honoured.
**Alternatives considered:** Customer discounts only (rejected — too simplistic for complex rate negotiations), full rate cards without override (rejected — operational exceptions always occur).

### DEC-073: Quote pricing lock vs update is tenant-configurable
**Date:** 2026-03-19
**Context:** Quotes may sit for weeks before acceptance. Rates may change in that time. Different tenants have different business practices.
**Decision:** Tenant-level setting: lock rates at quote time (snapshot) OR re-price on acceptance (current rates). Applies to all quotes for that tenant.
**Rationale:** Some tenants promise "this is the price" and need locked quotes. Others quote indicatively and re-price on acceptance. Both are legitimate business practices.
**Alternatives considered:** Always lock (rejected — some businesses need current pricing), always update (rejected — some businesses commit to quoted prices), per-quote choice (rejected — adds decision fatigue, this is a business policy not a per-quote decision).

### DEC-074: Structured rate review workflow with stale rate detection and bulk adjustments
**Date:** 2026-03-19
**Context:** Material and service rates change regularly (fuel, supplier reviews, CPI). Without a structured review process, stale rates go unnoticed.
**Decision:** Rate review workflow: stale rate detection (configurable staleness period), review queue grouped by supplier/customer, bulk adjustment tools (percentage, CPI/index, supplier rate sheet import), all with preview before applying and full audit trail.
**Rationale:** Ad-hoc rate updates miss stale rates and lack audit trail. A structured workflow ensures rates stay current and changes are traceable for supplier negotiations and customer reviews.
**Alternatives considered:** Ad-hoc only (rejected — rates go stale unnoticed).

### DEC-075: Fuel surcharges and ad-hoc levies as separate auto-applied line items
**Date:** 2026-03-19
**Context:** Australian transport commonly applies fuel levies that fluctuate. Baking surcharges into base rates makes them invisible and hard to adjust.
**Decision:** Surcharges configured at tenant level with name, type (% or fixed), applicable categories, auto-apply toggle, and effective dates. Applied as separate invoice line items for transparency. Surcharge history tracked over time.
**Rationale:** Separate line items give customers visibility into surcharges (common expectation in Australian transport). Updating the surcharge once applies to all new jobs without touching individual rates.
**Alternatives considered:** Bake into base rates (rejected — invisible to customers, hard to adjust), manual addition per job (rejected — too labour-intensive for something that applies to most jobs).

### DEC-076: Negative pricing lines for credits, adjustments, goodwill, and reversals
**Date:** 2026-03-19
**Context:** Doc 02 established customer credit management (overpayments, goodwill, adjustments). The pricing model needs to support these.
**Decision:** Credits are negative pricing lines (negative total_amount). Support overpayment credits, goodwill adjustments, rate corrections, and full/partial reversals. Each credit links to the original line if applicable. Credits can apply to a specific job or be held on the customer account. Same mechanism for contractor cost-side credits.
**Rationale:** Using the same pricing line model for credits keeps the financial model consistent — revenue minus cost still equals margin, invoicing sums all lines including negatives.
**Alternatives considered:** Separate credit system (rejected — creates parallel financial tracking).

### DEC-077: Job type pricing defaults and reusable pricing templates
**Date:** 2026-03-19
**Context:** Job types drive form behaviour (DEC-043). Pricing is part of that behaviour — different job types have predictable pricing structures.
**Decision:** Job types carry default pricing: pre-loaded lines, default pricing method, required/excluded categories. Additionally, users can save reusable pricing templates for recurring scenarios independent of job types.
**Rationale:** Pre-loading pricing reduces manual setup. Templates handle recurring patterns that don't map to a single job type. Both reduce data entry and errors.
**Alternatives considered:** Job type defaults only (rejected — doesn't cover cross-type recurring patterns), templates only (rejected — misses the job type → pricing structure relationship).

### DEC-078: Daysheet processing updates pricing actuals and can create new charge lines
**Date:** 2026-03-19
**Context:** Daysheets capture actual quantities that need to flow into the pricing engine for variance tracking and invoicing.
**Decision:** Daysheet processing updates actual_quantity and actual_total on matching pricing lines. When daysheets record work not in the original pricing (ad-hoc materials, different tip fees, waiting time), new charge lines are created and flagged for review before flowing into invoicing.
**Rationale:** The pricing engine must reflect reality, not just plans. Auto-updating actuals from daysheets eliminates manual reconciliation. Flagging new charges prevents unexpected items on invoices.
**Alternatives considered:** Manual actual entry (rejected — double-entry from daysheets), auto-create charges without review (rejected — unexpected invoice items cause disputes).

### DEC-079: All invoice scheduling and grouping options carry forward, split invoicing properly completed
**Date:** 2026-03-19
**Context:** Nexum has invoice scheduling (on_completion, daily, weekly, fortnightly, monthly) and grouping (per_job, per_PO, per_project, per_site, combine_all). Split invoicing for multi-customer jobs was incomplete.
**Decision:** All scheduling and grouping options carry forward. Split invoicing is properly completed: each customer on a multi-customer job gets their own invoice with only their lines, linked via group reference.
**Rationale:** All options serve real customer needs. Split invoicing is essential for multi-customer jobs — leaving it incomplete was a Nexum gap.
**Alternatives considered:** Simplify grouping (rejected — all options are used by different customers).

### DEC-080: Full RCTI status flow and deduction management carry forward
**Date:** 2026-03-19
**Context:** Nexum's RCTI has an extensive status flow (draft → accumulating → ready → pending_approval → approved → sent → paid/partial/disputed/cancelled) and deduction categories.
**Decision:** Full workflow carries forward. Every status serves a purpose in the contractor payment lifecycle. Deduction categories (yard parking, fuel, overloads, driver errors, tip fee adjustments, other) all carry forward.
**Rationale:** Contractor payments are complex and high-stakes. Each status represents a real operational state. Deductions are essential for accurate contractor settlement.
**Alternatives considered:** Simplify statuses (rejected — each status represents a real workflow state that finance needs to track).

### DEC-081: AR approval and credit limit system carry forward as-is
**Date:** 2026-03-19
**Context:** Nexum has AR approval (jobs must be approved before invoicing) and a credit limit system with automatic tracking, over-limit approvals, and credit stop.
**Decision:** Both systems carry forward with minor UX improvements. They work correctly and serve essential financial control functions.
**Rationale:** AR approval prevents invoicing errors. Credit management prevents overexposure to customer debt. Both are fundamental to financial health.
**Alternatives considered:** None — these are proven and essential.

### DEC-082: Remittance advice with PDF, docket images, auto-email, staggered sending all essential
**Date:** 2026-03-19
**Context:** Nexum generates remittance PDFs with docket images, auto-emails on approval, and staggers sending to avoid rate limits.
**Decision:** All features carry forward. Remittance PDF with docket images, auto-email on approval, customisable email templates, staggered sending, email queue with retry logic — all essential for contractor communications.
**Rationale:** Contractors expect detailed remittance with proof of work. Auto-email reduces manual effort. Staggering prevents email delivery issues at scale.
**Alternatives considered:** Drop docket image inclusion (rejected — contractors need proof of work), drop auto-email (rejected — manual sending doesn't scale).

### DEC-083: Supplier invoice recording with job cost matching and AP review workflow
**Date:** 2026-03-19
**Context:** Not all AP is contractor RCTIs. Tenants receive invoices from suppliers (tip fees, material purchases, hire charges) that need reconciliation against job costs.
**Decision:** Supplier invoices are recorded and matched against job pricing cost lines. System suggests matches, highlights discrepancies, and tracks missing invoices. AP review workflow with permission control. Approved supplier invoices sync to Xero as bills.
**Rationale:** Without supplier invoice matching, job profitability is incomplete — actual supplier costs may differ from planned costs. Missing invoice detection prevents period close with unrecorded costs.
**Alternatives considered:** Track in Xero only (rejected — loses the job-level cost matching and discrepancy detection).

### DEC-084: Formal customer and contractor statements with ageing and batch sending
**Date:** 2026-03-19
**Context:** Doc 02 mentioned customer and contractor statements. Formal statements are essential for account management and debt collection.
**Decision:** PDF statements for customers (invoices, payments, credits, running balance, ageing breakdown) and contractors (RCTIs, payments, deductions, balance). Batch generation and sending for all customers in one operation.
**Rationale:** Ageing breakdowns are the primary tool for debt collection — showing at a glance which customers are overdue and by how long. Contractor statements provide the transparency promised in doc 02.
**Alternatives considered:** Rely on Xero for statements (rejected — need to include Nexum-specific data and formatting).

### DEC-085: Invoice dispute tracking with resolution workflow on the AR side
**Date:** 2026-03-19
**Context:** RCTI has a "disputed" status but customer invoice disputes had no tracking mechanism. Disputes handled via email get lost.
**Decision:** Dispute flag on invoices with reason, running notes log, resolution tracking (explanation accepted, credit note, replacement, adjustment), resolution status, and dispute age for SLA tracking. Disputes don't change invoice status — they add an overlay visible in lists and dashboards.
**Rationale:** Untracked disputes lead to lost revenue (forgotten follow-ups) or customer relationship damage (repeated chasing for disputed amounts). Simple tracking prevents both.
**Alternatives considered:** Use invoice status for disputes (rejected — conflates payment status with dispute status).

### DEC-086: Batch invoice generation for scheduled billing runs with preview and reporting
**Date:** 2026-03-19
**Context:** Customers on periodic invoicing need batch generation. Generating invoices one at a time doesn't scale for monthly runs with 50+ customers.
**Decision:** Billing run workflow: queue of customers due, preview before generating, batch generate, batch verify, batch send. Post-run summary report with counts, totals, skipped items, and period comparison.
**Rationale:** Monthly billing runs are a core finance operation. A single workflow for the entire run dramatically reduces time and errors vs individual invoice generation.
**Alternatives considered:** Individual generation only (rejected — doesn't scale for periodic billing).

### DEC-087: Invoice PDF preview at verification stage before sending
**Date:** 2026-03-19
**Context:** Finance needs to see exactly what the customer will receive before committing to send.
**Decision:** Full PDF preview at verification stage showing formatted invoice, attached documents, and email preview. Draft watermark on previewed documents to prevent confusion. Verifier can adjust document preferences before finalising.
**Rationale:** Sending incorrect invoices damages credibility and creates admin overhead (credit notes, re-issues). Preview catches errors before they reach the customer.
**Alternatives considered:** No preview, rely on verification checklist (rejected — visual review catches formatting and attachment issues that checklists miss).

### DEC-088: Complete Xero integration overhaul — bidirectional with full feature coverage
**Date:** 2026-03-19
**Context:** Nexum's Xero integration is mostly one-way with gaps: no credit note sync, hardcoded GST, no tracking categories, no chart of accounts lookup.
**Decision:** Complete overhaul. Bidirectional sync where appropriate. Add credit note sync, dynamic account mapping, tracking categories, proper tax handling, webhooks, and full reconciliation.
**Rationale:** A transport business's accounting integration is critical infrastructure. Half-measures create manual workarounds that defeat the purpose of integration.
**Alternatives considered:** Fix gaps only (rejected — fundamental architecture needs rethinking for bidirectional support), keep current + credit notes (rejected — too many other gaps).

### DEC-089: Dynamic account code mapping — pull chart of accounts, tenant-configurable
**Date:** 2026-03-19
**Context:** Nexum uses hardcoded account codes (200 for revenue, 310 for expenses). Different tenants have different chart of accounts structures.
**Decision:** Pull chart of accounts from Xero on connection and refresh daily. Tenants map pricing categories to Xero account codes in admin. Resolution order: per-line override → per-party → per-category → default. Validate codes before sync.
**Rationale:** Hardcoded codes only work for tenants whose chart of accounts matches the defaults. Dynamic mapping works for everyone.
**Alternatives considered:** Keep simple defaults with override (rejected — too manual for tenants with non-standard charts), both (effectively what this is — smart defaults + full mapping).

### DEC-090: Webhooks for real-time payment sync with polling as fallback
**Date:** 2026-03-19
**Context:** Nexum polls Xero every 15 minutes for payment updates. Xero supports webhooks but they weren't implemented.
**Decision:** Webhooks as primary payment notification mechanism for real-time updates. Polling continues as a fallback every 15 minutes to catch anything webhooks miss (network issues, webhook downtime).
**Rationale:** Real-time payment visibility matters for credit management and cash flow. Webhooks provide it. Polling as fallback ensures reliability.
**Alternatives considered:** Polling only (rejected — 15-minute delay isn't real-time), webhooks only (rejected — webhooks can fail silently).

### DEC-091: Credit note sync to Xero (ACCECCREDIT)
**Date:** 2026-03-19
**Context:** Nexum creates credit notes but doesn't sync them to Xero. This means manual entry in Xero for every credit note.
**Decision:** Credit notes sync to Xero as ACCECCREDIT records, allocated against the original invoice. Full and partial credits supported. Unallocated credits stay on the customer's Xero account.
**Rationale:** Without credit note sync, the accounting record in Xero is incomplete. Manual entry is error-prone and creates reconciliation issues.
**Alternatives considered:** None — this is a clear gap that must be filled.

### DEC-092: Dynamic tax rate handling — pull rates from Xero, no hardcoded GST
**Date:** 2026-03-19
**Context:** Nexum hardcodes 10% GST. Some items are GST-free, BAS-excluded, or have different tax treatments.
**Decision:** Pull available tax rates from Xero (OUTPUT, INPUT, EXEMPTOUTPUT, EXEMPTINPUT, BASEXCLUDED, etc.). Map pricing categories to tax types. Per-line override available. GST (10%) remains the default but is configurable.
**Rationale:** Hardcoded tax rates cause incorrect BAS reporting. Different line items legitimately have different tax treatments.
**Alternatives considered:** Keep hardcoded (rejected — causes BAS errors for items that aren't standard-rated).

### DEC-093: Tracking category integration for dimensional financial reporting
**Date:** 2026-03-19
**Context:** Xero tracking categories enable reporting by dimensions (region, department, project). Not implemented in Nexum.
**Decision:** Pull tracking categories from Xero. Auto-assign from Nexum data (region from job location, job type, department). Per-line assignment on invoices and bills. Manual override available. Tenant-configurable mapping.
**Rationale:** Tracking categories are one of Xero's most powerful reporting features. Auto-populating them from Nexum data gives tenants dimensional financial reporting without manual effort.
**Alternatives considered:** Not implementing (rejected — misses significant reporting value).

### DEC-094: SafeSpec owns ALL compliance — every module moves out of Nexum
**Date:** 2026-03-19
**Context:** Nexum has 40+ compliance tables, 30+ handlers, 40+ UI components covering NHVAS, WHS, CoR, fatigue, mass, maintenance, defects, drug testing, pre-starts, audit. Ryan's vision is that SafeSpec manages all compliance.
**Decision:** ALL compliance management moves to SafeSpec: NHVAS modules, mass management, maintenance management, fatigue management, WHS (incidents, hazards, SWMS, training, emergency, workers comp, PPE, health monitoring), CoR risk assessments, drug/alcohol testing, pre-start processing, document/licence tracking, compliance alerts, audit/CAR/NCR, NHVR API integration. Nexum becomes a compliance consumer, not manager.
**Rationale:** Compliance is a specialist domain that deserves a dedicated system. Duplicating it across Nexum and SafeSpec creates inconsistency risk. Single source of truth for compliance = SafeSpec.
**Alternatives considered:** Keep some modules in Nexum (rejected — partial split creates confusion about where to manage what), keep all in Nexum (rejected — duplicates SafeSpec's purpose).

### DEC-095: WHS moves entirely to SafeSpec
**Date:** 2026-03-19
**Context:** Nexum has a comprehensive WHS system (incidents, hazards, SWMS, toolbox talks, training, emergency plans, workers comp, PPE, health monitoring). Should this stay or move?
**Decision:** WHS moves entirely to SafeSpec. Nexum doesn't manage WHS incidents, hazards, or any WHS workflows.
**Rationale:** WHS is compliance. If the principle is "SafeSpec owns compliance," WHS is no exception. Managing WHS in two places creates legal risk (which system has the authoritative incident record?).
**Alternatives considered:** Keep WHS in Nexum (rejected — violates the compliance boundary), keep core WHS only (rejected — partial split creates ambiguity).

### DEC-096: Nexum's compliance role — status check, gates, data push, cached display
**Date:** 2026-03-19
**Context:** If SafeSpec owns compliance, what does Nexum do with compliance data?
**Decision:** Four roles: (1) Status check — ask SafeSpec "is this entity compliant?" and get yes/no/warning with summary. (2) Compliance gates — block non-compliant entities from operational use. (3) Operational data push — send hours, loads, distances, weights to SafeSpec for compliance assessment. (4) Display — show cached compliance summary on entities for quick reference.
**Rationale:** Nexum needs to enforce compliance operationally without managing the compliance data. These four roles give operations what they need without duplicating SafeSpec.
**Alternatives considered:** No compliance awareness in Nexum (rejected — operations must respect compliance gates).

### DEC-097: No compliance override in Nexum — non-compliant = blocked
**Date:** 2026-03-19
**Context:** Should authorised users be able to override compliance blocks in Nexum?
**Decision:** No override. If SafeSpec says non-compliant, the entity is blocked in Nexum. The resolution path is to fix the issue in SafeSpec. Compliance bypasses create legal liability under Chain of Responsibility.
**Rationale:** Under CoR legislation, everyone in the supply chain is liable. Allowing compliance overrides in Nexum creates a legal risk pathway. The override (if any) should happen in SafeSpec where the compliance context exists.
**Alternatives considered:** Override with reason (rejected — creates CoR liability), warnings only (rejected — doesn't enforce compliance).

### DEC-098: Compliance status cached locally with short TTL, invalidated by webhooks
**Date:** 2026-03-19
**Context:** Checking SafeSpec on every operation would be slow. Need caching.
**Decision:** Cache compliance status locally with configurable TTL (15 minutes for active operations, 1 hour for display). SafeSpec pushes cache invalidation via webhooks when status changes. Stale cache shows last known status with indicator.
**Rationale:** Balances responsiveness with API efficiency. Webhooks ensure critical changes (entity becomes non-compliant) are reflected quickly without waiting for cache expiry.
**Alternatives considered:** No caching (rejected — too many API calls), long cache (rejected — compliance status could be stale when it matters).

### DEC-108: Portal is same-app routes with role-based access, not a separate application
**Date:** 2026-03-19
**Context:** Nexum had a separate portal application. Now that Nexum is a web SaaS, the portal could be routes within the same app or a separate deployment.
**Decision:** Portal is part of the same web application, accessed via dedicated routes (e.g. `/portal/contractor/`, `/portal/customer/`). Same deployment, same auth system, role-based routing. No separate portal app or subdomain.
**Rationale:** One app to build and maintain. Shared auth via Better Auth means no separate credentials table. Simpler infrastructure. The portal is just another set of views, not a separate product.
**Alternatives considered:** Separate portal app (rejected — more infrastructure for no benefit), separate with shared auth (rejected — unnecessary deployment complexity).

### DEC-109: Portal roles are Contractor and Customer only — drivers use DriverX
**Date:** 2026-03-19
**Context:** Nexum had 5 portal roles (admin, sales, driver, contractor, customer). Drivers now have DriverX (doc 20). Admin/sales use the main app.
**Decision:** Two portal roles: Contractor and Customer. Drivers use DriverX. Internal staff use the main app. A future Sales CRM portal role is planned but not part of the initial build.
**Rationale:** Each user type has its purpose-built interface. Consolidating portal to external parties keeps it focused.
**Alternatives considered:** Keep all 5 roles (rejected — redundant with main app and DriverX).

### DEC-110: Contractors get full self-management — drivers, assets, availability, documents, financials
**Date:** 2026-03-19
**Context:** Nexum's contractor portal was mostly view-only. Contractors had to contact the tenant to make changes.
**Decision:** Full self-service: contractors manage their own drivers (add/remove, availability, documents), assets (add/remove, status, documents), and view all financials (RCTIs, deductions, payments, statements). Tenant is notified of changes.
**Rationale:** Self-service reduces admin overhead for the tenant and gives contractors immediate control. Notify-on-change keeps the tenant aware without creating an approval bottleneck.
**Alternatives considered:** View only (rejected — too limiting), propose-and-approve (rejected — creates bottleneck).

### DEC-111: Customers get full self-service — job requests, tracking, financials, reporting, disputes
**Date:** 2026-03-19
**Context:** Nexum's customer portal only showed job tracking and invoices. Customers had to call/email for everything else.
**Decision:** Full self-service: submit job requests, track jobs and projects, view invoices and statements, accept/dispute invoices, accept quotes, download documents, run reports with date filtering and export.
**Rationale:** Self-service is expected in modern SaaS. Job requests replace phone/email orders with structured submissions. Dispute handling keeps everything tracked in the system.
**Alternatives considered:** View-only plus requests (rejected — misses financial self-service which reduces admin workload significantly).

### DEC-112: Portal uses same Better Auth system — no separate portal_users table
**Date:** 2026-03-19
**Context:** Nexum had a separate `portal_users` table with independent credentials. Web SaaS has a unified auth system.
**Decision:** Portal users authenticate through Better Auth with portal-specific roles. No separate credentials table. User creation flow: tenant creates portal user → invitation email → user sets up account. Entity scoping via linked `business_companies.id`.
**Rationale:** One auth system to maintain. No credential sync issues. Portal users benefit from Better Auth features (password reset, session management, potential SSO with SafeSpec).
**Alternatives considered:** Separate portal auth (rejected — duplicate auth infrastructure with sync problems).

### DEC-113: Sales CRM portal noted as future module — not in initial build
**Date:** 2026-03-19
**Context:** Ryan mentioned wanting a sales CRM like Salesforce functionality, but later, not now.
**Decision:** Noted as a future portal role in the documentation. No design work, no detail — just a placeholder acknowledging it's planned.
**Rationale:** Captures the intent without committing design effort to something that isn't being built yet.
**Alternatives considered:** Leave out entirely (rejected — Ryan wanted it noted).

### DEC-099: Pre-starts captured in Nexum ecosystem but processed by SafeSpec
**Date:** 2026-03-19
**Context:** Pre-starts are captured via DriverX, portal, or manual entry — all Nexum interfaces. But processing (defect creation, compliance assessment) is compliance work.
**Decision:** Nexum captures pre-start submissions and forwards them to SafeSpec for processing. SafeSpec evaluates results, creates defects if needed, updates compliance status, and pushes the result back via webhook.
**Rationale:** The capture interface is Nexum's (DriverX is a Nexum product). The processing logic is compliance. Clean separation.
**Alternatives considered:** Process in Nexum (rejected — compliance processing belongs in SafeSpec), capture in SafeSpec (rejected — drivers use DriverX which is Nexum's app).

### DEC-100: Operational data pushed from Nexum to SafeSpec for compliance assessment
**Date:** 2026-03-19
**Context:** SafeSpec needs operational data (hours worked, loads carried, distances) to assess compliance (fatigue, mass, maintenance triggers).
**Decision:** Nexum pushes operational data to SafeSpec: hours (real-time for fatigue), loads/distances/weights (batch at daysheet processing), daily summaries (end-of-day batch). Queue with retry logic for reliability. No data loss — facts persisted in Nexum's job records regardless.
**Rationale:** Nexum is the source of operational facts. SafeSpec needs them for compliance calculations. Push model keeps the data flowing without SafeSpec needing to query Nexum.
**Alternatives considered:** SafeSpec pulls from Nexum (rejected — adds coupling and requires Nexum to expose data API), shared database (considered — but separate services should use APIs).

### DEC-101: SafeSpec is an optional subscription — Nexum functions fully without it
**Date:** 2026-03-19
**Context:** Ryan clarified that SafeSpec is a separate multi-tenant product. Not all Nexum tenants will subscribe. Nexum must work independently.
**Decision:** SafeSpec is an optional subscription enabled per tenant. Without SafeSpec: Nexum operates normally with no compliance features (no badges, no gates, no dashboard). With SafeSpec: compliance features activate (status checks, gates, warnings, dashboard). Toggling on/off is clean.
**Rationale:** Nexum is an operations platform first. Compliance is an enhancement for tenants who subscribe to SafeSpec, not a prerequisite for Nexum to function.
**Alternatives considered:** Require SafeSpec (rejected — would limit Nexum's market to SafeSpec subscribers only).

### DEC-102: Corrects DEC-029 — "No fallback" means no internal compliance engine, not that Nexum requires SafeSpec
**Date:** 2026-03-19
**Context:** DEC-029 stated "no fallback" for compliance. Ryan clarified: this means Nexum doesn't build its own compliance engine as a fallback. It does NOT mean Nexum can't operate without SafeSpec.
**Decision:** DEC-029 is reinterpreted: Nexum has no internal compliance management (no fallback compliance engine). If a tenant wants compliance features, they subscribe to SafeSpec. If they don't subscribe, Nexum works fine — just without compliance. The "no fallback" was about not duplicating SafeSpec's functionality inside Nexum.
**Rationale:** The original decision was about avoiding code duplication, not about creating a hard dependency on SafeSpec.
**Alternatives considered:** None — this is a clarification, not a new decision.

### DEC-114: Contractor-uploaded documents require tenant approval before becoming active
**Date:** 2026-03-19
**Context:** Contractors can upload documents (licences, registrations, insurance, inductions) through the portal. These documents affect operational readiness and compliance status.
**Decision:** All documents uploaded by contractors enter a "pending approval" state. Tenant reviews in a centralised approval queue: approve, reject with reason, or request resubmission. Only approved documents are active in the system. Rejected documents show the reason so the contractor can resubmit.
**Rationale:** The tenant must maintain control over what enters their system. Unverified documents could be expired, incorrect, or fraudulent. The approval step is lightweight (one-click approve) but essential for data integrity.
**Alternatives considered:** Auto-accept all uploads (rejected — no quality control), auto-accept with spot audits (rejected — risky documents could be active before review).

### DEC-103: Standardise on 1–2 SMS providers with provider abstraction for easy swapping
**Date:** 2026-03-19
**Context:** Nexum supports 5 SMS providers. Multiple providers add maintenance burden without proportional benefit.
**Decision:** Standardise on 1–2 SMS providers (primary + fallback) selected for Australian coverage, cost, and reliability. Keep the provider abstraction/factory pattern so adding or swapping providers later is straightforward.
**Rationale:** 5 providers is excessive maintenance for diminishing returns. Two providers (primary + failover) cover reliability needs. The abstraction layer preserves future flexibility.
**Alternatives considered:** Keep all 5 (rejected — maintenance burden), single provider (rejected — no failover).

### DEC-104: Notification system rethought for web SaaS — WebSockets, push, event-driven
**Date:** 2026-03-19
**Context:** Nexum's 31 notification types were designed for a desktop app using PostgreSQL NOTIFY. Web SaaS needs a different delivery architecture.
**Decision:** Rethink the notification system for web SaaS. The 31 types carry forward conceptually but delivery is redesigned around WebSockets, push notifications, and a unified queue. Event-driven triggers replace polling where possible. Time-based checks run as background jobs (BullMQ).
**Rationale:** Desktop notification patterns don't translate to web. WebSockets provide real-time updates, push notifications reach users outside the app, and event-driven architecture is more efficient than polling.
**Alternatives considered:** Port existing system directly (rejected — desktop patterns don't fit web SaaS).

### DEC-105: Unified communications service — single service for SMS, email, push, in-app
**Date:** 2026-03-19
**Context:** Nexum has separate systems for SMS, email, and notifications. This means separate templates, separate tracking, separate history.
**Decision:** One unified communications service handling all channels: SMS, email, push notifications, and in-app notifications. Shared template engine, single delivery queue, unified communication log, and centralised tracking. One place to see all communications for any entity.
**Rationale:** One system to maintain instead of three. Unified history makes it easy to see everything sent for a job, customer, or driver. Easier to add new channels later.
**Alternatives considered:** Keep separate services (rejected — fragmented history and maintenance overhead).

### DEC-106: Push notifications are primary real-time channel; SMS for drivers without app; email for formal only
**Date:** 2026-03-19
**Context:** Need to define the channel strategy for the web SaaS — when to use push, SMS, and email.
**Decision:** Push notifications (browser + DriverX mobile) are the primary real-time channel for operational updates. SMS is for drivers/contractors without app access and critical operational messages. Email is reserved for formal communications only: invoices, statements, remittance advice, quotes, compliance alerts.
**Rationale:** Push is free, instant, and actionable. SMS costs money per message and should be reserved for users without push access. Email is the wrong channel for operational urgency but the right channel for formal documents.
**Alternatives considered:** SMS as primary (rejected — costly and not interactive), email for everything (rejected — too slow for operational updates).

### DEC-107: WebSocket replaces PostgreSQL NOTIFY for real-time data propagation in web SaaS
**Date:** 2026-03-19
**Context:** Nexum uses PostgreSQL NOTIFY for real-time updates between processes. In a web SaaS, the server needs to push updates to browser clients.
**Decision:** WebSocket connections between browser and server for real-time data propagation. Clients subscribe to channels (jobs, scheduler, notifications, company broadcasts). Redis pub/sub (already in stack via BullMQ) handles scaling across multiple server instances. Auto-reconnect with exponential backoff.
**Rationale:** PostgreSQL NOTIFY works for co-located processes but can't push to browser clients. WebSocket is the standard for real-time web applications. Redis pub/sub enables horizontal scaling.
**Alternatives considered:** Server-Sent Events (viable but less flexible — no client→server), polling (rejected — inefficient and not real-time), keep PostgreSQL NOTIFY with adapter (rejected — adds unnecessary layer).

### DEC-115: AWS S3 with presigned URLs for all document storage
**Date:** 2026-03-19
**Context:** Nexum uses S3 for file storage. Evaluating whether to keep or change for the SaaS rebuild.
**Decision:** Keep AWS S3 with presigned URLs. Proven, scalable, cost-effective. Multi-tenant path isolation (`/{tenant_id}/{entity_type}/{entity_id}/`). Storage tier lifecycle policies for cost management.
**Rationale:** S3 is battle-tested for this use case. Presigned URLs provide secure, time-limited access without exposing the bucket. No reason to change what works.
**Alternatives considered:** S3-compatible providers like R2 (viable later if cost is a concern — same API), self-hosted (rejected — unnecessary operational burden).

### DEC-116: Full document version control carries forward
**Date:** 2026-03-19
**Context:** Nexum tracks full version history for documents. Evaluating whether to simplify.
**Decision:** Keep full versioning. Every re-upload creates a new version with auto-incrementing version number, upload source, upload reason, and who uploaded. Previous versions remain accessible. Any version can be restored as current.
**Rationale:** Full history is essential for compliance audit trails. When a licence was replaced, what the previous one said, and who changed it — all matter for regulatory purposes.
**Alternatives considered:** Current + previous only (rejected — loses audit trail), no versioning (rejected — compliance risk).

### DEC-117: Document metadata auto-sync to entity fields carries forward
**Date:** 2026-03-19
**Context:** Nexum auto-syncs document metadata (expiry dates, numbers) to entity fields when documents are uploaded.
**Decision:** Keep auto-sync. Uploading a licence updates the driver's licence_expiry. Uploading insurance updates the contractor's insurance_expiry. Eliminates double-entry.
**Rationale:** Major time-saver and data quality improvement. Without it, users must update both the document AND the entity fields manually — leading to mismatches.
**Alternatives considered:** Manual only (rejected — double-entry is error-prone), optional toggle (considered — but auto-sync with manual override covers all cases).

### DEC-118: Full sharing capabilities carry forward — public links, passwords, limits, Xero batch
**Date:** 2026-03-19
**Context:** Nexum has public document links with password protection, download limits, expiry, and Xero batch links.
**Decision:** All sharing features carry forward. Public links with configurable expiry, optional password, optional download limits, revocation, access logging. Xero batch links for invoice attachments. Portal access complements but doesn't replace public links.
**Rationale:** Portal covers regular contractor/customer access, but ad-hoc sharing (third parties, auditors, one-off requests) still needs public links. Xero batch links are essential for accounting integration.
**Alternatives considered:** Portal-only sharing (rejected — doesn't cover ad-hoc external sharing scenarios).

### DEC-119: Human-readable S3 file structure — entity names and logical folders, no UUIDs
**Date:** 2026-03-19
**Context:** Ryan specified that S3 storage must use human-readable paths, not UUID-based or hashed paths. Each contractor, driver, asset etc gets its own named root folder.
**Decision:** S3 paths are human-readable: `/{tenant}/{Contractors}/{Contractor Name}/{Drivers}/{Driver Name}/{Licences}/filename.pdf`. Entity names are slugified. Folder structure mirrors how a person would organise files on a shared drive. If an entity is renamed, the S3 path updates.
**Rationale:** Human-readable paths mean anyone with S3 bucket access (admin, support, migration) can find files without needing a database lookup. Also makes the document manager UI intuitive — the folder tree matches the storage structure.
**Alternatives considered:** UUID-based paths (rejected by Ryan — not human-readable), hybrid UUID + display name (rejected — still opaque in S3).

### DEC-120: Standard file naming convention with auto-naming on upload
**Date:** 2026-03-19
**Context:** Ryan wants a standard naming feature so files aren't just stored with whatever name the user uploaded them with.
**Decision:** Files are automatically renamed on upload to a standard format: `{Entity}_{Document Type}_{Date}_{Sequence}.{ext}`. System proposes the name, user can accept or customise. Manual rename available at any time. Bulk rename for cleaning up legacy files. Duplicate names get auto-incrementing sequence numbers.
**Rationale:** Consistent naming makes files findable and identifiable at a glance — in the UI, in S3, in downloads. Removes the chaos of user-uploaded filenames like "IMG_20240315.jpg" or "scan001.pdf".
**Alternatives considered:** Keep original filenames (rejected — inconsistent and unhelpful), force naming with no override (rejected — users sometimes have good reasons for custom names).

### DEC-121: Full document manager UI — folder tree, file operations, bulk actions, search, quick access
**Date:** 2026-03-19
**Context:** Ryan wants a complete file management interface — not just document attachments on entities, but a proper file manager with folder navigation, full file operations, and bulk actions.
**Decision:** Document manager with: folder tree navigation (matching S3 structure), file listing with full detail (name, type, size, dates, versions, status, compliance), all operations (upload, download, view/preview, edit metadata, rename, move, delete, share, version history), bulk operations (upload, download as ZIP, move, rename, delete), global search, quick access (recent, expiring, pending approval, starred), and storage dashboard for admin.
**Rationale:** Documents are a core operational asset. A proper file manager gives users full control and visibility. The folder structure makes navigation intuitive and mirrors the S3 storage for consistency.
**Alternatives considered:** Entity-attached documents only (rejected — no central management view), third-party file manager (rejected — needs tight integration with Nexum entities and compliance).

### DEC-122: AI features are as extensive as possible, all tenant-configurable
**Date:** 2026-03-19
**Context:** Ryan wants AI woven throughout the application, not limited to a few features. Every AI feature should be toggleable per tenant.
**Decision:** Full AI suite: conversational job creation, AI job review, docket OCR, smart scheduling/auto-allocation, natural language queries, proactive suggestions, document analysis, communication drafting. Every feature has a per-tenant on/off toggle. Tenants control how aggressively AI operates (confidence thresholds, suggestion frequency, auto-allocation level).
**Rationale:** AI should handle anything repetitive or pattern-based. Making everything tenant-configurable means conservative tenants can start with just job creation while progressive tenants can enable full auto-allocation. No tenant is forced into AI they don't want.
**Alternatives considered:** Limited AI scope (rejected — Ryan wants maximum AI coverage), mandatory AI features (rejected — must be tenant choice).

### DEC-123: Lightweight workflow engine for tenant-configurable automation rules
**Date:** 2026-03-19
**Context:** Beyond AI, tenants need configurable business process automation — event-driven rules like "when job completes, auto-generate invoice."
**Decision:** Lightweight workflow engine with event triggers, conditions, and actions. Tenants configure rules in admin (no code). Rules can chain for multi-step workflows. Pre-built templates for common scenarios. Test mode for safe experimentation. Full audit logging.
**Rationale:** Every tenant has slightly different business processes. A configurable workflow engine lets them automate their specific patterns without custom code. Reduces manual steps and ensures consistency.
**Alternatives considered:** No workflow engine — hardcode common automations (rejected — doesn't cover tenant-specific variations), full BPMN engine (rejected — too complex for the use case).

### DEC-124: All background automation runs on BullMQ job queues
**Date:** 2026-03-19
**Context:** Nexum uses ad-hoc background tasks. Web SaaS needs reliable, retryable, monitorable job processing.
**Decision:** All background work runs on BullMQ: email delivery, SMS, push notifications, document processing, Xero sync, compliance checks, AI requests, report generation, billing runs, system maintenance. Queue dashboard for monitoring. Failed job retry with exponential backoff.
**Rationale:** BullMQ is already in the stack (Redis for WebSocket pub/sub). Reliable queues prevent lost work, retry handles transient failures, monitoring catches problems early. Replaces fragile ad-hoc background tasks.
**Alternatives considered:** Keep ad-hoc tasks (rejected — unreliable), separate queue system (rejected — BullMQ is already available via Redis).

### DEC-125: All existing reports carry forward with improved visualisation and drill-down
**Date:** 2026-03-19
**Context:** Nexum has extensive reporting across financial, operational, performance, and compliance areas. Evaluating whether to carry forward or rebuild.
**Decision:** All existing reports carry forward. Financial (revenue, aging, margins, cash flow, cost breakdown), operational (utilisation, efficiency, scheduling, delivery tracking), performance (drivers, contractors, sales reps), and compliance reports all rebuild with improved visualisation, deeper drill-down, and additional chart types.
**Rationale:** The report coverage is comprehensive and reflects real operational needs. Rebuilding from scratch would lose proven report logic. Improve the presentation, not the content.
**Alternatives considered:** Rebuild from scratch (rejected — would lose proven report definitions), core only (rejected — tenants rely on the full suite).

### DEC-126: Scheduled report delivery carries forward with more triggers and portal access
**Date:** 2026-03-19
**Context:** Nexum has scheduled customer report delivery via email with configurable sections, templates, and activity-based sending.
**Decision:** Carry forward and improve. Add more triggers (per daysheet, monthly, milestone), portal-based report access alongside email, better templates, test send functionality. Both email and portal are equal delivery channels — some customers prefer email, others prefer portal self-service.
**Rationale:** Scheduled delivery is essential for customer communications. Portal access adds self-service without removing the email channel that many customers rely on.
**Alternatives considered:** Portal-first only (rejected — many customers prefer emailed reports), email-only (rejected — portal self-service reduces admin overhead).

### DEC-127: Custom report builder — essential, tenant-configurable, drag-and-drop
**Date:** 2026-03-19
**Context:** Pre-built reports cover common scenarios but every tenant has unique reporting needs. Ryan wants a report builder as an essential feature.
**Decision:** Drag-and-drop report builder: select data sources, choose fields, apply filters and grouping, add aggregations and charts, preview with live data, save and schedule. Report library per tenant. Export to CSV/PDF. Custom reports can be included in scheduled delivery. Read-only and tenant-scoped.
**Rationale:** Every tenant's business is slightly different. A report builder lets them answer their own questions without requesting custom development. Essential for self-service and reducing support overhead.
**Alternatives considered:** Pre-built only (rejected — too rigid for diverse tenant needs), future module (rejected — Ryan wants it as essential in initial build).

### DEC-128: Two admin levels — platform admin (Redbay) and tenant admin (each tenant)
**Date:** 2026-03-19
**Context:** SaaS requires platform-level management (tenants, subscriptions, system config) separate from tenant-level management (users, roles, settings).
**Decision:** Two distinct admin contexts. Platform admin: tenant management, subscriptions, system config, support tools (impersonation, health monitoring). Tenant admin: user management, roles, permissions, company settings, feature toggles. Platform admin is a separate context not accessible to tenants.
**Rationale:** Platform and tenant concerns are fundamentally different. Mixing them creates confusion and security risk. Each level has its own permissions and UI.
**Alternatives considered:** Tenant admin only with direct DB for platform (rejected — doesn't scale as tenant count grows), three levels with reseller (deferred — not needed initially).

### DEC-129: Granular permissions kept and improved — better UX, enforced in development
**Date:** 2026-03-19
**Context:** Nexum's permission model has the right fundamentals (granular, custom roles, per-user overrides) but the UX is confusing and developers frequently forget to add permission checks.
**Decision:** Keep granular permissions with custom roles and per-user overrides. Dramatically improve the UX: visual role builder with plain-English descriptions, live preview of effective permissions, role comparison, permission templates for common roles. Critically: enforce permissions in development — every handler must check permissions, PermissionGate component for UI, automated tests catch missing checks, CI fails on unprotected endpoints.
**Rationale:** The permission model is sound — the problems are UX and enforcement. Fixing UX makes it usable. Enforcing in development prevents the "forgot to add permissions" problem that Ryan experienced with AI coding agents.
**Alternatives considered:** Simplified pre-defined roles only (rejected — different tenants need different role structures), team-based permissions (deferred — can be added later if needed by larger tenants).

### DEC-130: Audit logging enhanced with better search, longer retention, compliance exports
**Date:** 2026-03-19
**Context:** Nexum has audit logging with retention policies and export. SaaS makes audit even more important for compliance and support.
**Decision:** Carry forward and enhance. Better search and filtering, timeline view per entity, activity dashboard, configurable retention per action type (minimum 2 years financial, 1 year operational, 90 days system). Compliance-ready export formats. Immutable logs — no user can modify or delete audit entries.
**Rationale:** Audit is a legal and operational necessity. Enhanced search makes it useful for support and debugging, not just compliance. Immutability ensures the audit trail is trustworthy.
**Alternatives considered:** Full activity feed (considered — the enhanced audit log effectively provides this with timeline view per entity).

### DEC-131: Keep Google Maps as map provider
**Date:** 2026-03-19
**Context:** Nexum uses Google Maps for display, directions, geocoding, and places. Evaluating whether to keep or switch.
**Decision:** Keep Google Maps. Proven, feature-rich, excellent Australian coverage. Route caching minimises API costs.
**Rationale:** Google Maps is the standard for Australian logistics. Good geocoding accuracy for Australian addresses, reliable directions API, strong places API. No compelling reason to switch.
**Alternatives considered:** Mapbox (more customisable but less Australian-specific), provider-flexible abstraction (unnecessary complexity for minimal benefit).

### DEC-132: Real-time GPS tracking from DriverX with geofencing
**Date:** 2026-03-19
**Context:** Nexum only shows last-known position based on job locations. DriverX enables real-time GPS.
**Decision:** Real-time GPS tracking from DriverX devices. Live vehicle positions on map with direction, speed, and job context. Full location history with playback. Plus geofencing: define boundaries around sites, auto-trigger status updates on arrival/departure (loading, in transit, unloading, complete).
**Rationale:** Real-time tracking transforms dispatch efficiency — dispatchers see exactly where every asset is. Geofencing eliminates manual status updates (drivers don't need to tap "arrived" — the system knows). Also provides compliance data (actual time at site for fatigue calculations).
**Alternatives considered:** Job-based position only (rejected — too imprecise for real-time dispatch), GPS without geofencing (rejected — geofencing is where the real operational value is).

### DEC-133: Backhaul detection carries forward with AI learning enhancement
**Date:** 2026-03-19
**Context:** Nexum has a scoring-based backhaul detection algorithm with material compatibility rules. Integrated into the scheduler (DEC-054).
**Decision:** Current algorithm carries forward. AI enhancement added: learn from accepted/dismissed patterns, adjust score weightings, factor in traffic patterns, customer preferences, driver familiarity. Proactive suggestions surfaced in scheduling and map views.
**Rationale:** The existing algorithm is solid but static. AI learning makes it better over time — understanding which opportunities dispatchers actually value and why they reject others.
**Alternatives considered:** Keep as-is (rejected — misses the AI improvement opportunity), rebuild from scratch (rejected — current algorithm is proven, enhance rather than replace).

### DEC-134: DriverX is a separate repository from the Nexum monorepo
**Date:** 2026-03-19
**Context:** DriverX is a React Native app. Could live in the monorepo or as a separate repo.
**Decision:** Separate repository with its own release cycle. Shared types and validation schemas published as a package consumed by both repos. DriverX consumes the Nexum API as an external client.
**Rationale:** React Native has fundamentally different build tooling, dependencies, and release processes (App Store, Google Play). Keeping it separate avoids polluting the web monorepo. Independent release cycle means DriverX updates don't require web deployments.
**Alternatives considered:** In the monorepo (rejected — different toolchain and release process), monorepo with separate build (considered — viable but adds complexity to the monorepo).

### DEC-135: Pre-start checklists are simple pass/fail with defect photo capture
**Date:** 2026-03-19
**Context:** Pre-starts are captured in DriverX but processed by SafeSpec (DEC-099). How detailed should the driver experience be?
**Decision:** Simple pass/fail per checklist item. Driver checks items off (pass) or reports a defect with description, photo, and severity (minor/major/critical). Checklist template defined by SafeSpec, rendered dynamically. Critical defects flag the asset. Completed pre-start forwarded to SafeSpec for processing.
**Rationale:** Drivers need speed, not complexity. A simple pass/fail with photo-on-defect captures the essential information without slowing down the start of shift. SafeSpec does the detailed processing.
**Alternatives considered:** Full detailed inspection with condition ratings per item (rejected — too slow for daily use, creates driver friction), no pre-start in DriverX (rejected — pre-starts are captured in the Nexum ecosystem per DEC-099).

### DEC-136: DriverX is a full driver hub — jobs, comms, timesheets, leave, documents, compliance
**Date:** 2026-03-19
**Context:** DriverX could be minimal (just job execution) or a comprehensive driver hub.
**Decision:** Full driver hub. Core job execution plus: messaging with dispatch, notification centre, schedule overview (week view), timesheet review with classified hours, leave requests, document uploads with approval status, compliance status display, training records. Everything a driver needs in one app.
**Rationale:** Drivers shouldn't need multiple apps or phone calls for basic work admin. A full hub reduces admin overhead (leave requests, document uploads) and improves driver satisfaction (they can see their timesheets, compliance status, upcoming schedule). More features in the app means less manual work for office staff.
**Alternatives considered:** Core only (rejected — misses the admin efficiency gains), core + comms only (rejected — still leaves timesheet review, leave, documents out).

### DEC-137: DigitalOcean exclusively for all infrastructure — Australian data residency
**Date:** 2026-03-19
**Context:** Nexum needs a hosting provider. SafeSpec already uses DigitalOcean exclusively in Sydney region.
**Decision:** All Nexum infrastructure on DigitalOcean Sydney region: App Platform for application, Managed PostgreSQL for database, Managed Redis for cache/queue, Spaces (S3-compatible) for object storage, dedicated Droplet for PDF generation. Same provider and pattern as SafeSpec.
**Rationale:** Single provider simplifies ops. Australian data residency is a straightforward privacy statement. Shared infrastructure patterns with SafeSpec. Development happens on the same local dev server using shared Docker services (PostgreSQL, Redis, MinIO, MailHog).
**Alternatives considered:** AWS (more services but more complexity), Vercel + managed services (split infrastructure), self-managed VPS (more ops burden).

### DEC-138: Mirror SafeSpec's monorepo structure and conventions exactly
**Date:** 2026-03-19
**Context:** SafeSpec uses pnpm + Turborepo monorepo with packages: frontend, backend, shared, pdf-templates. Same conventions should apply to Nexum.
**Decision:** Nexum uses identical monorepo structure: pnpm workspaces + Turborepo, packages for frontend, backend, shared, pdf-templates. Same coding conventions (kebab-case files, PascalCase components, snake_case DB, camelCase functions). Same tooling (ESLint, Prettier, Vite). Developers move between SafeSpec and Nexum without relearning.
**Rationale:** Consistency between the two products reduces cognitive load, speeds up development, and allows code sharing patterns (like the compliance shared package).
**Alternatives considered:** Different structure (rejected — no benefit to diverging from a proven setup).

### DEC-139: GitHub Actions for CI/CD pipeline
**Date:** 2026-03-19
**Context:** Need CI/CD for automated testing, linting, and deployment.
**Decision:** GitHub Actions for CI/CD. Lint, type-check, test on every PR. Build and deploy on merge to main. Same pipeline structure as SafeSpec.
**Rationale:** Integrated with GitHub repos, familiar, good ecosystem. Same CI tool for both products.
**Alternatives considered:** Decide later (rejected — GitHub Actions is a clear choice given the existing setup).

### DEC-140: ABN Lookup via Australian Business Register API carries forward
**Date:** 2026-03-19
**Context:** Nexum integrates with the ABR API (abr.business.gov.au) for ABN lookup when creating business entities. Searches by name or ABN number, returns entity details, GST status, trading names.
**Decision:** ABN lookup carries forward. Integrated into entity creation forms (customers, contractors, suppliers). Search by name or ABN. Auto-populates company form with entity type, GST status, trading name, address. API key stored encrypted per tenant.
**Rationale:** Essential for Australian business operations. Ensures ABN accuracy, reduces manual entry, and verifies GST registration. Every transport company needs this when onboarding customers and contractors.
**Alternatives considered:** None — this is a core Australian business requirement.

---

### DEC-141: Mirror SafeSpec's git workflow exactly
**Date:** 2026-03-19
**Context:** Needed to decide on git workflow for the Nexum rebuild — branch strategy, commit conventions, merge approach.
**Decision:** Mirror SafeSpec exactly. Main/develop/feature/fix branches. Conventional commits (default to `fix:`, `feat:` only for new features). Squash merge into develop. Same branch protection rules.
**Rationale:** Developers and AI agents move between SafeSpec and Nexum — identical workflows eliminate context-switching friction. SafeSpec's workflow is proven and working.
**Alternatives considered:** Trunk-based development (simpler but less controlled for a multi-feature rebuild).

---

### DEC-142: Comprehensive testing from day one — unit, integration, and E2E
**Date:** 2026-03-19
**Context:** The original Nexum had no tests, which contributed to fragility and bugs. Needed to set testing expectations for the rebuild.
**Decision:** Comprehensive testing from first commit. Vitest for unit tests, Vitest + Supertest for integration tests (API routes against test database), Playwright for E2E tests. All business logic involving money, permissions, or compliance must have tests. No mocking the database — use a real test database.
**Rationale:** Nexum's lack of tests was a major pain point. Starting with tests from day one is dramatically easier than retrofitting later. The test database approach catches real issues that mocks miss.
**Alternatives considered:** Unit + integration only (deferred E2E), pragmatic minimum (tests only for critical paths). Both rejected — the rebuild is the opportunity to do it right.

---

### DEC-143: Full CI pipeline with permission audit enforcement
**Date:** 2026-03-19
**Context:** Needed CI/CD pipeline definition. Also needed to enforce doc 18's permission enforcement rules (DEC-128) at the CI level.
**Decision:** GitHub Actions pipeline: lint → type-check → unit tests → integration tests → build check → permission audit. All stages must pass before PR merge. Permission audit script scans all API handlers and fails if any endpoint lacks a permission check. E2E tests run on develop merge and nightly, not on every PR.
**Rationale:** The permission audit in CI is critical — Ryan's experience with AI agents forgetting to add permission checks means this cannot rely on code review alone. Automated enforcement catches every gap.
**Alternatives considered:** Fast pipeline (lint + type-check + build only) — rejected as it doesn't catch test failures or permission gaps before merge.

---

### DEC-144: CLAUDE.md included as part of doc 22, not a separate deliverable
**Date:** 2026-03-19
**Context:** Needed to decide whether the CLAUDE.md agent guide is part of the development workflow doc or a separate file.
**Decision:** Include CLAUDE.md content within doc 22 (Development Workflow). When the repo is initialised, this section becomes the root CLAUDE.md file. Keeps all development guidance in one place during the documentation phase.
**Rationale:** The CLAUDE.md is fundamentally a development workflow document — it tells agents how to work in the codebase. Including it in doc 22 avoids fragmentation and ensures it's reviewed alongside the workflow conventions it references.
**Alternatives considered:** Separate deliverable after all docs (adds another step), both doc 22 and separate file (duplication risk).

---

### DEC-145: Strict TypeScript enforcement as the top critical rule — zero tolerance for `any`, `as`, `@ts-ignore`
**Date:** 2026-03-19
**Context:** Ryan reported agents repeatedly bypassing TypeScript type safety — using `any`, `as` casts, `@ts-ignore`, and implicit `any` to silence errors rather than fixing actual types. This undermines the entire type system and creates hidden bugs.
**Decision:** TypeScript type safety is elevated to the SINGLE MOST IMPORTANT rule in CLAUDE.md. Zero tolerance: no `any`, no `as` assertions, no `@ts-ignore`/`@ts-expect-error`, no `!` non-null assertions, no `eslint-disable` for type rules. Every exported function must have explicit return types. Generic types must be constrained. `unknown` + type guards for truly unknown values. Zod schemas are the single source of truth for types (derive via `z.infer<>`). CI enforces with `@typescript-eslint/strict-type-checked`. The rule is written aggressively and repeated to make it impossible for agents to miss or rationalise bypassing.
**Rationale:** Type safety is the foundation everything else is built on. If agents bypass it, the entire codebase degrades. Making it the top rule with zero exceptions and aggressive wording is necessary because softer rules have been ignored.
**Alternatives considered:** Softer wording with exceptions — rejected because agents have already demonstrated they will exploit any flexibility.

---

### DEC-146: CLAUDE.md includes slash commands, skills, and plugins mirroring SafeSpec
**Date:** 2026-03-19
**Context:** SafeSpec has a `.claude/` directory with slash commands (`/checks`, `/continue`), skills (`shadcn`), and plugins (frontend-design, context7, github, playwright, semgrep, postman, etc.). Nexum should mirror this for consistent developer experience.
**Decision:** CLAUDE.md includes full slash command definitions (`/checks`, `/continue`, `/audit`, `/create-handler`, `/create-component`), skills (`shadcn`, `drizzle`, `fastify`, `testing`), and plugins (same as SafeSpec). These will be implemented as files in `.claude/commands/` and `.claude/skills/` when the repo is initialised.
**Rationale:** Identical agent workflows between SafeSpec and Nexum. Ryan (and agents) should be able to switch between projects without relearning. The slash commands enforce the "finish what you start" and "honest status assessment" principles that are critical for quality.
**Alternatives considered:** Minimal CLAUDE.md without commands/skills — rejected, Ryan specifically wants the same development process as SafeSpec.

---

### DEC-147: Zod 4 instead of Zod 3 (diverging from SafeSpec)
**Date:** 2026-03-19
**Context:** SafeSpec uses Zod ^3.24.0. Zod 4 (4.3.6) is now released with breaking API changes. `fastify-type-provider-zod` v6 has dropped Zod 3 support entirely and requires Zod ≥4.1.5. `drizzle-zod` 0.8.3 supports both Zod 3 and 4. `better-auth` has no Zod peer dependency.
**Decision:** Nexum uses Zod 4 from day one. The future `@redbay/compliance-shared` package should also be built on Zod 4.
**Rationale:** Nexum is greenfield — no migration cost. The ecosystem is moving to Zod 4 (`fastify-type-provider-zod` v6 already requires it). Building on Zod 3 would mean using `fastify-type-provider-zod` v4 (outdated) or losing type-safe route schemas. SafeSpec will need to upgrade eventually — better for the shared package to be forward-looking.
**Alternatives considered:** Stay on Zod 3 to match SafeSpec — rejected because it forces use of outdated `fastify-type-provider-zod` v4 and delays an inevitable migration.

### DEC-148: Tailwind CSS 4 instead of Tailwind CSS 3 (diverging from SafeSpec)
**Date:** 2026-03-19
**Context:** SafeSpec uses Tailwind ^3.4.0 with PostCSS, autoprefixer, and `tailwindcss-animate`. Tailwind 4 (4.2.2) is a complete rewrite — CSS-first config, no `tailwind.config.js`, no PostCSS/autoprefixer needed. shadcn/ui CLI v4 was built for Tailwind v4. `@tailwindcss/vite` plugin supports Vite 5–8.
**Decision:** Nexum uses Tailwind CSS 4 with `@tailwindcss/vite` plugin. Use `tw-animate-css` (CSS-only) instead of `tailwindcss-animate` (Tailwind v3 plugin API). No PostCSS or autoprefixer in the project.
**Rationale:** Tailwind v4 is the current major version. shadcn v4 is designed for it. The CSS-first config is simpler. Utility classes are largely the same between v3 and v4, so developers moving between projects won't be disoriented — only the config mechanism differs.
**Alternatives considered:** Stay on Tailwind 3 to match SafeSpec — rejected because shadcn v4 (latest) targets Tailwind v4, and using the old shadcn with Tailwind v3 means missing improvements.

### DEC-149: Vite 8 instead of Vite 6 (diverging from SafeSpec)
**Date:** 2026-03-19
**Context:** SafeSpec uses Vite ^6.0.0. Vite 8.0.1 is the latest. `@tailwindcss/vite` supports Vite 5–8. Vitest 4 supports Vite 6–8. `@vitejs/plugin-react` supports Vite 8.
**Decision:** Nexum uses Vite 8.
**Rationale:** All plugins are compatible. No reason to start a greenfield project on an older major version.
**Alternatives considered:** Vite 6 to match SafeSpec — rejected, no compatibility benefit and misses two major versions of improvements.

### DEC-150: Vitest 4 + ESLint 10 (diverging from SafeSpec)
**Date:** 2026-03-19
**Context:** SafeSpec uses Vitest ^3.0.0 and ESLint ^9.39.4. Vitest 4.1.0 supports Vite 6–8. ESLint 10.0.3 works with typescript-eslint 8.57.
**Decision:** Nexum uses Vitest 4 and ESLint 10.
**Rationale:** Both are the current major versions. Vitest 4 is required for native Vite 8 support. ESLint 10 continues the flat config approach SafeSpec already uses.
**Alternatives considered:** Match SafeSpec versions — rejected, Vitest 3 doesn't declare Vite 8 support in peer dependencies.

### DEC-151: React Router 7 unified package (no react-router-dom)
**Date:** 2026-03-19
**Context:** React Router v7 merged `react-router-dom` into `react-router`. Both packages exist at 7.13.1 but `react-router-dom` just re-exports from `react-router`. SafeSpec uses `react-router-dom` ^7.13.1.
**Decision:** Nexum imports from `react-router` only. Do not install `react-router-dom` separately.
**Rationale:** The React Router team recommends importing from `react-router` in v7. `react-router-dom` is a compatibility shim.
**Alternatives considered:** Install `react-router-dom` to match SafeSpec — rejected, unnecessary dependency that just re-exports.

### DEC-152: @scalar/api-reference instead of @fastify/swagger-ui
**Date:** 2026-03-19
**Context:** SafeSpec uses `@fastify/swagger-ui` for API documentation. Doc 21 specifies Scalar UI for Nexum. `@scalar/api-reference` 1.49.1 provides a modern interactive API documentation UI.
**Decision:** Nexum uses `@scalar/api-reference` for API docs at `/api/docs`, not `@fastify/swagger-ui`.
**Rationale:** Scalar provides a better developer experience with a modern UI. Already specified in the architecture doc.
**Alternatives considered:** `@fastify/swagger-ui` to match SafeSpec — rejected, Scalar was explicitly chosen in the architecture design.

### DEC-153: @redbay/compliance-shared to be built on Zod 4
**Date:** 2026-03-19
**Context:** The planned `@redbay/compliance-shared` package (DEC-005) does not yet exist. It will export Zod schemas consumed by both SafeSpec and Nexum. Nexum uses Zod 4; SafeSpec currently uses Zod 3.
**Decision:** When `@redbay/compliance-shared` is built, it should use Zod 4. SafeSpec should upgrade its Zod dependency at that point.
**Rationale:** Zod 4 is the current major version. Building a new shared package on an outdated version creates immediate tech debt. SafeSpec's upgrade to Zod 4 is inevitable given ecosystem direction (`fastify-type-provider-zod` v6 dropped v3 support). Better to upgrade SafeSpec once when the shared package is ready than to build the shared package on old technology.
**Alternatives considered:** Build on Zod 3 for SafeSpec compatibility — rejected, creates a package born outdated. Build with dual exports (Zod 3 + Zod 4) — rejected, unnecessary complexity.

---

### DEC-154: Nexum API on port 3002, frontend on port 5174 (separate from SafeSpec)
**Date:** 2026-03-19
**Context:** SafeSpec uses API port 3001 and frontend port 5173. Both projects run on the same dev server and must not conflict.
**Decision:** Nexum API runs on port 3002, frontend on port 5174. Redis key prefix `nexum:`, database `nexum_dev`, MinIO bucket `nexum-dev`.
**Rationale:** Must avoid port and namespace conflicts with SafeSpec. Sequential port numbers are easy to remember.
**Alternatives considered:** Arbitrary ports — rejected, sequential numbering is clearer.

### DEC-155: Shared @nexum/shared lib includes "DOM" in TypeScript lib for crypto.randomUUID()
**Date:** 2026-03-19
**Context:** The shared package runs in both browser and Node.js contexts. `crypto.randomUUID()` is available in both but TypeScript's `ES2022` lib doesn't include the Web Crypto API types.
**Decision:** Add `"DOM"` to the shared package's tsconfig `lib` array alongside `"ES2022"`. This provides `crypto.randomUUID()` typing.
**Rationale:** The shared package is consumed by both frontend (DOM environment) and backend (Node.js, which also has `crypto.randomUUID()` since v19). Adding DOM lib is simpler than Node.js-specific crypto imports that wouldn't work in the browser.
**Alternatives considered:** Use `node:crypto` — rejected, breaks browser usage. Use `globalThis.crypto` with custom type declaration — unnecessary complexity when DOM lib works.

### DEC-156: OpShield as the central platform layer for Nexum and SafeSpec
**Date:** 2026-03-20
**Context:** Nexum and SafeSpec are independent products that can be sold separately or bundled. Both currently embed their own Better Auth instances and tenant provisioning. A central platform is needed for unified auth, billing, provisioning, and management.
**Decision:** Create OpShield as a third project that owns authentication (single Better Auth SSO instance), tenant provisioning (creates schemas in product databases), billing (Stripe), public website (marketing/sign-up), and platform admin (Redbay staff dashboard). Products delegate auth to OpShield but retain their own business logic, databases, roles, and permissions.
**Rationale:** Extracting auth and billing to a platform layer avoids duplicating provisioning logic across products, enables true SSO, supports independent or bundled sales, and centralises Stripe billing. This is the standard multi-product SaaS pattern (Atlassian, Zoho, MYOB).
**Alternatives considered:** Keep auth embedded in each product (requires users to create separate accounts per product); shared database between products (creates coupling, violates independence); OpShield as API gateway/broker (adds latency and a single point of failure for all API calls).

### DEC-157: OpShield ports — API 3000, frontend 5170
**Date:** 2026-03-20
**Context:** SafeSpec uses 3001/5173, Nexum uses 3002/5174. OpShield needs non-conflicting ports.
**Decision:** OpShield API on port 3000, frontend on port 5170. Redis prefix `opshield:`, database `opshield_dev`, MinIO bucket `opshield-dev`.
**Rationale:** Port 3000 is a natural choice for the "first" service (the platform). Frontend port 5170 precedes both SafeSpec and Nexum in the sequence.
**Alternatives considered:** None — straightforward port assignment.

### DEC-158: Extract auth from Nexum — delegate entirely to OpShield
**Date:** 2026-03-20
**Context:** Nexum had an embedded Better Auth instance with its own user/session/account tables. Per the OpShield architecture (docs/07-AUTH-ARCHITECTURE.md, docs/24-OPSHIELD-PLATFORM.md), auth must be centralised in OpShield.
**Decision:** Remove Better Auth from Nexum entirely. Nexum validates OpShield JWTs via JWKS (using `jose` library). Login/signup/password-reset all redirect to OpShield. Nexum creates a local session cookie after validating the JWT callback.
**Rationale:** Single source of truth for auth enables SSO across Nexum, SafeSpec, and future products. Eliminates duplicate user tables. Products become stateless auth consumers. Matches the documented migration plan (Phase 4: Cut Over).
**Alternatives considered:** Dual-auth transition (rejected — no existing users to migrate since DB was reset), keeping Better Auth as a local session store (rejected — unnecessary complexity when a cookie + JWKS validation achieves the same).

### DEC-159: Redis client via ioredis with lazy connect
**Date:** 2026-03-20
**Context:** OpShield webhooks need idempotency tracking, entitlements caching, and session revocation — all requiring Redis. ioredis was already a dependency but no client module existed.
**Decision:** Create `lib/redis.ts` with ioredis, lazy connect, `nexum:` key prefix. Connect during server startup, disconnect on graceful shutdown. Auth middleware checks Redis for revoked sessions on every request.
**Rationale:** Lazy connect prevents startup failures when Redis is temporarily unavailable during development. Key prefix prevents collision with SafeSpec on the shared Redis instance. Session revocation check in auth middleware is the only reliable way to honour OpShield `session.revoked` webhooks since JWTs are stateless.
**Alternatives considered:** In-memory cache (rejected — doesn't survive server restart, doesn't share across multiple server instances), checking revocation only at webhook handler level (rejected — doesn't block the revoked user from making API calls with their still-valid JWT).

### DEC-160: Entry points managed under address permissions
**Date:** 2026-03-20
**Context:** Entry points are sub-entities of addresses (Gate 1, Gate 2 on a job site). Need permission checks but creating separate `manage:entry-points` permissions would bloat the permission system.
**Decision:** Entry point CRUD uses `manage:addresses` / `view:addresses` permissions. Entry points share the address permission scope.
**Rationale:** Entry points are always managed in the context of an address — they never exist independently. Users who can manage addresses should inherently be able to manage entry points at those addresses. Keeps the permission model simple.
**Alternatives considered:** Separate entry point permissions (rejected — adds complexity with no practical benefit since entry points are always address-scoped).

### DEC-161: Employees and drivers in a single table with isDriver flag
**Date:** 2026-03-20
**Context:** Doc 03 describes employees and drivers as overlapping categories — a driver is an employee with extra data. Need to decide between separate tables or a unified model.
**Decision:** Single `employees` table with an `isDriver` boolean. Licences, medicals, and qualifications are separate related tables. Compliance status is computed on read, not stored.
**Rationale:** Avoids data duplication and complex joins. The isDriver flag controls which sections appear in the UI and which related data is fetched. Contractor drivers are just employees with a `contractorCompanyId` set. The scheduler and job system only need to query `employees WHERE is_driver = true`.
**Alternatives considered:** Separate `drivers` table inheriting from employees (rejected — adds join complexity for no real benefit). Driver as a role on users (rejected — not all drivers are system users, and not all employees are drivers).

### DEC-162: Tenant-configurable qualification types
**Date:** 2026-03-20
**Context:** Doc 03 specifies that qualification types should be fully tenant-configurable (construction cards, operator tickets, DG licences, site inductions, etc.) rather than a fixed set.
**Decision:** `qualification_types` table defines what qualifications exist for the tenant (name, hasExpiry, requiresEvidence). `qualifications` table records which employees hold which types.
**Rationale:** Different tenants operate under different regulatory requirements and have different site-specific inductions. A fixed list would need constant updates and wouldn't cover tenant-specific requirements.
**Alternatives considered:** Predefined enum of qualification types (rejected — too rigid for the diverse tenant base).

### DEC-163: requireModule middleware with OpShield fetch + local fallback
**Date:** 2026-03-20
**Context:** Module-gated routes need to check whether the tenant's subscription includes the required module. Entitlements are managed by OpShield but Nexum needs to enforce them.
**Decision:** `requireModule()` middleware fetches entitlements from OpShield API, caches in Redis (15 min TTL), falls back to local `tenants.enabledModules` if OpShield is unreachable. User-friendly error messages on rejection.
**Rationale:** OpShield is the source of truth for billing/entitlements, but Nexum shouldn't break if OpShield is temporarily unavailable. The local fallback ensures graceful degradation. Cache invalidation happens via existing webhooks.
**Alternatives considered:** Only local check (rejected — would drift from OpShield's billing state). Only OpShield check without cache (rejected — too many API calls per request).

---
