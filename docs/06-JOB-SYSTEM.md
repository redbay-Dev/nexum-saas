# 06 — Job System

## Overview

The job is the core operational unit of Nexum. Everything else — assets, drivers, materials, pricing, dockets, invoicing — feeds into or out of jobs. A job represents a piece of work: moving material from A to B, providing a vehicle for hire, performing on-site work.

Nexum's current job system has evolved through V1 (state-based, frontend holds state) and V2 (database-first, realtime writes). The rebuild is database-first only — the database is the single source of truth, the frontend is a thin input/display layer, and multiple users can work in the system simultaneously with real-time visibility.

Key changes from Nexum: simplified and consistent lifecycle statuses, tenant-configurable job types that drive form behaviour, jobs start as drafts until confirmed, mid-job edits with restrictions and notifications, real-time collaboration with section locking, and AI capabilities expanded beyond just job parsing.

## Job Types — Tenant-Configurable

### What changed from Nexum
Nexum has 11 default job types (General Transport, Material Delivery, Disposal, Hire, etc.) but they're essentially labels — they don't drive form behaviour. The rebuild makes job types configurable per tenant and lets them control what the job form looks like.

### How job types work
Each tenant defines their own job types. A job type controls:

- **Which form sections are visible** — A "Hire" job might not need material sections. A "Disposal" job always needs a disposal site destination. A "Transport" job needs pickup and delivery locations.
- **Which fields are required** — Some job types may require a PO number, others don't. Some need specific material information, others are time-based only.
- **Which pricing methods are available** — Hourly jobs price by time. Cartage jobs price by weight/volume. Some job types support multiple methods.
- **Default values** — A job type can set defaults for priority, duration, asset category, and other fields so the dispatcher doesn't have to fill them in every time.

### System defaults
The system ships with sensible defaults that cover common transport scenarios, but these are starting points — tenants modify or replace them based on their operation. The exact default set should be simpler than Nexum's 11 types, focused on the most common patterns:

- Transport (material A to B)
- Disposal (material to disposal site)
- Hire (vehicle/operator for a period)
- On-site (work at a location)

Tenants add their own types for their specific work (concrete, crane, excavation, etc.).

## Job Creation

### Draft by default
All new jobs start as a **draft**. A draft is a work-in-progress job that hasn't been confirmed. Drafts:

- Are visible to the creator and anyone with permission
- Don't appear in the scheduler or operational views
- Don't trigger notifications
- Can be edited freely without restrictions
- Have no auto-save — the user saves when they're ready

When the user confirms the draft, it becomes a live job and enters the lifecycle. This replaces Nexum's auto-save drafts (which created confusion) with an explicit "this is ready" action.

### Core job data
A job contains:

**Identity and reference:**
- Job number (auto-generated, unique per tenant)
- Name/description
- Job type
- Customer (who the work is for)
- Project (optional grouping — see Projects section)
- Order/PO number (optional, can be required by job type or customer setting)
- Priority (low, medium, high)
- Sales rep and job lead assignments

**Locations:**
- Pickup location(s) — where material comes from
- Delivery location(s) — where material goes
- Each location links to the address system (doc 01) with entry point selection
- Locations carry on-site contact details and special instructions
- Sequence number for multi-stop jobs

**Materials:**
- What's being moved (links to material catalog — doc 05)
- Quantity (ordered/estimated)
- Unit of measure
- Flow type (supply, disposal, buyback, transfer, delivery)
- Material is snapshotted at the time it's added — immutable copy of name, type, compliance flags

**Asset requirements:**
- What type of asset is needed (category and subcategory)
- How many assets needed
- Per-requirement payload limits (can differ from job-level)
- Special requirements or notes

**Scheduling:**
- Scheduled start and end dates/times
- Multi-day flag (spans multiple days)
- Minimum charge hours (for hourly jobs)

**Notes:**
- External notes (visible to customer/driver)
- Internal notes (office staff only)

### Multi-customer jobs
A single job can serve multiple customers with different billing arrangements:

- **Billing split methods:** Single (one customer pays), percentage (split by %), fixed (fixed amounts per customer), equal (split evenly)
- Primary customer designation
- Each customer can have their own pricing lines

### Job cloning
Jobs can be cloned to create a new job based on an existing one. The clone includes locations, materials, and pricing by default, with options to include/exclude asset requirements and allocations. This saves time for recurring work patterns.

### Parent/child jobs
Complex work can be split into a parent job (the overall scope) and child jobs (individual pieces). Example: a large earthmoving project with separate pickup routes, each as a child job under the parent. Child jobs inherit some data from the parent but can have their own scheduling, assignments, and dockets.

## Job Lifecycle

### Simplified status model
Nexum has status, workflow_stage, and workflow_substatus — three overlapping concepts that create confusion. The rebuild simplifies to a single status field with clear, consistent naming used throughout the application.

The core statuses:

- **Draft** — Work in progress, not yet confirmed. Not visible in scheduler. Freely editable.
- **Confirmed** — Job is confirmed and ready to be scheduled. Appears in scheduler. Can be edited with some restrictions (see mid-job edits).
- **Scheduled** — Resources (assets/drivers) have been allocated. Notifications sent to relevant parties.
- **In Progress** — Work has started. Actual start time recorded automatically.
- **Completed** — Work finished. Actual end time recorded. Ready for docket processing and invoicing.
- **Invoiced** — Invoices generated for this job. Financial data locked.
- **Cancelled** — Job cancelled. Reason recorded. All allocations released.

### Quote workflow
Jobs can start as a **quote** instead of a draft. A quote follows its own path:

- **Quote** — Pricing estimate for a customer. Not operational.
- **Approved** → Converts to **Confirmed** status (becomes a live job)
- **Declined** → Quote rejected. Preserved for reference.

### Status transitions
Not every transition is valid. The system enforces:

- Draft → Confirmed (user confirms the job)
- Confirmed → Scheduled (resources allocated)
- Scheduled → In Progress (work starts — can be manual or automatic based on time)
- In Progress → Completed (work finishes)
- Completed → Invoiced (invoices generated)
- Any active status → Cancelled (with reason)
- Quote → Confirmed (approved) or Quote → Declined

Backward transitions (e.g., Completed back to In Progress) should be possible with appropriate permissions and a reason, because real-world situations sometimes require reopening completed work.

### Automatic actions on status change
- **→ In Progress:** Records actual_start timestamp if not already set
- **→ Completed:** Records actual_end timestamp. Triggers docket processing readiness.
- **→ Cancelled:** Records cancellation reason. Releases all allocated assets and drivers (they become available for other work).
- **→ Invoiced:** Locks financial data. Pricing lines become read-only.

### Tenant-configurable statuses
Tenants can add custom statuses between the core ones for their specific workflows (e.g., "Awaiting PO", "Customer Confirmed", "On Hold"). Custom statuses don't change the core lifecycle — they're intermediate states that give the tenant more granular tracking. The system enforces that core transitions still work regardless of custom statuses in between.

### Consistent naming
Status names must be consistent throughout the entire application — scheduler, job list, reports, notifications, portal, DriverX all use the same terminology. No "planning" in one place and "pending" in another.

## Job Pricing

### Single source of truth
The pricing table is the single source of truth for all job financial data. Every pricing line is explicitly:

- **Revenue** (what the customer pays) or **Cost** (what the tenant pays out)
- Linked to a **party** (which company — customer, contractor, supplier, tenant)
- Categorised (hire, cartage, tip fee, material, subcontractor, etc.)
- Has a rate type (per hour, per tonne, per m³, per km, per load, flat rate)
- Has quantity × unit rate = total amount (total is authoritative)

### Mid-job pricing changes
Pricing can be edited during the job lifecycle — this is essential because jobs change mid-flight (scope changes, site conditions change, customer requests modifications). When pricing changes after the job is confirmed:

- The change is recorded with a reason (variation tracking)
- A new snapshot of the pricing state is created
- Relevant parties are notified via SMS/notification (drivers get updated instructions, contractors see updated rates)
- Dockets already processed against the old pricing are preserved — only new dockets use the updated pricing

### Restrictions after certain stages
While most things are editable at most stages, some restrictions apply:

- **After dockets are processed:** The customer cannot be changed (dockets are linked to the customer). Materials and locations that have processed dockets against them cannot be removed (but new ones can be added).
- **After invoicing:** Pricing lines become read-only. Changes require a credit note / adjustment invoice (covered in doc 10).
- **Cancelled jobs:** Become read-only entirely.

The principle: don't block legitimate operational changes, but protect financial integrity and audit trail.

### Pricing detail deferred to doc 09
How pricing is calculated, rate precedence, customer-specific rates, markup rules, and the pricing configuration UX are all covered in **doc 09 — Pricing Engine**. This doc covers the job's relationship to pricing (it stores lines, lines are editable, snapshots are taken) but not the mechanics of how prices are determined.

## Real-Time and Collaboration

### Database-first, always
The database is the only source of truth. Every change is written to the database immediately. The frontend subscribes to changes and updates in real-time. No batching, no local state that diverges from the database.

### Multi-user visibility
Multiple users can view and work on jobs simultaneously. Changes made by one user are visible to others in real-time. The system must handle this properly — a dispatcher adjusting a job's schedule while the accounts team is reviewing pricing shouldn't cause conflicts.

### Section-level collaboration
Rather than locking the entire job, the system supports section-level interaction:

- Users can see who else is viewing/editing a job
- If two users try to edit the same section simultaneously, the second user is notified and can choose to wait or force their edit
- Different sections (pricing, locations, materials, assignments) can be edited by different users at the same time without conflict

### No auto-save
The auto-save draft system from Nexum is removed. Users save explicitly when they're ready. This prevents the confusion of half-finished changes being persisted and showing up unexpectedly.

## Job Locations

Jobs have one or more locations, each with a type:

### Location types
- **Pickup** — Where material is collected (quarry, supplier site, stockpile)
- **Delivery** — Where material goes (job site, disposal site, stockpile)

### Location data
Each location carries:
- Link to address system (company address with entry points — see doc 01)
- Sequence number (for multi-stop routes)
- On-site contact name and phone
- Special instructions and notes
- Material action at this location (pickup, delivery, disposal, buyback)
- Tip fee information for disposal sites
- Arrival/departure times (actual, for completed locations)

### Entry point selection
When a location is selected, the dispatcher can choose which entry point to use (from the address's entry points — doc 01). Entry points can be overridden per job based on weather, access, or project stage.

## Job Assignments

### Asset requirements vs actual allocations
Jobs declare what they **need** (asset requirements) separately from what they **get** (actual allocations):

- **Requirements:** "This job needs 2 Tippers and 1 Crane" — defined at job creation
- **Allocations:** "Truck ABC-123 and Truck DEF-456 assigned to this job" — handled by the scheduler

This separation means the scheduler can match requirements to available resources without the job having to know which specific assets will be used.

### Assignment types
- **Asset** — A specific vehicle/equipment assigned to the job
- **Driver** — A specific driver assigned (usually paired with an asset)
- **Contractor** — A contractor providing the asset/driver

### Assignment lifecycle
Assignments go through: assigned → in progress → completed (or cancelled/reassigned). Each assignment tracks planned and actual start/end times.

### Compliance gates
All assignments must pass compliance gates (doc 04). An asset with expired registration, a driver with an expired licence, or a contractor with incomplete onboarding cannot be assigned. The system prevents it — the dispatcher sees why and what needs to be resolved.

## Projects

Jobs can optionally belong to a **project** — a grouping of related work for a customer:

- Project number (auto-generated)
- Customer association
- Date range (project start/end)
- Assigned personnel (sales rep, project lead)
- Status (active, completed, on hold)

Projects allow:
- Viewing all jobs for a project in one place
- Project-level reporting (total tonnes, revenue, costs across all jobs)
- Grouping related work for large contracts

Projects are optional — most day-to-day jobs don't need a project. They're useful for ongoing construction sites, long-term supply contracts, and large-scale earthmoving work.

## AI Capabilities

### Provider flexibility
The rebuild should not lock to a single AI provider (Nexum uses Google Gemini). The AI integration should support multiple providers (OpenAI, Anthropic, Google) with the tenant choosing their preferred provider. This means:

- Abstracted AI interface — the system calls a common AI service layer
- Provider-specific adapters underneath
- Tenant stores their own API key for their chosen provider
- Easy to add new providers as they emerge

### Job-specific AI features
AI-assisted job creation and management:

- **Job parsing** — Natural language description to structured job data. "3 tippers from Smith's quarry to the new estate on Monday, 100 tonnes of road base" → pre-filled job form.
- **Entity resolution** — Fuzzy matching of customer names, material names, addresses to existing records.
- **Job review** — AI validates job data for inconsistencies (e.g., material type doesn't match disposal site's accepted materials, payload exceeds mass limits).

### System-wide AI (broader vision)
Beyond jobs, AI should assist across the system where it adds genuine value:

- **Scheduling suggestions** — Recommend optimal asset/driver assignments based on location, availability, and past performance
- **Pricing analysis** — Flag pricing anomalies (unusually low/high rates for a material or route)
- **Help and guidance** — In-app AI assistant that helps users navigate the system, answer questions about how to do things, explain what fields mean
- **Anomaly detection** — Flag unusual patterns (dockets with unusual quantities, jobs with unexpected durations)

The specific AI features and their priorities will evolve, but the architecture should support plugging AI in wherever it's beneficial rather than being limited to one feature (job parsing).

## Notifications and Communications

### Job event notifications
Key job events trigger notifications to relevant parties:

- **Job confirmed** — Customer notified (if configured)
- **Job scheduled** — Driver and contractor notified with job details
- **Job changed mid-flight** — Updated information sent to drivers/contractors via SMS
- **Job completed** — Customer notified
- **Job cancelled** — All assigned parties notified

### SMS integration
SMS is the primary communication channel for operational notifications (drivers are on the road, not checking email). Job-related SMS:

- Template-based with placeholder variables (job number, location, material, time)
- Delivery tracking (sent, delivered, failed)
- History retained on the job record

SMS detail is covered in **doc 13 — Communications**.

## What's Different from Nexum

| Aspect | Nexum | Rebuild |
|--------|-------|---------|
| Architecture | V1/V2 split with feature flag | Database-first only, real-time |
| Draft system | Auto-save every 30 seconds | Explicit save, draft until confirmed |
| Job types | 11 defaults, essentially labels | Tenant-configurable, drive form behaviour |
| Lifecycle | status + workflow_stage + workflow_substatus | Single status field, simplified and consistent |
| Concurrency | Editing locks (broken) | Section-level collaboration with real-time visibility |
| Mid-job edits | Limited, manual snapshot | Full edit with restrictions, variation tracking, SMS notification |
| AI | Gemini only, job parsing only | Provider-flexible, system-wide AI assistance |
| Multi-customer | Supported | Carries forward |
| Parent/child | Supported | Carries forward |
| Cloning | Supported | Carries forward |
| Quote workflow | Quote → planning | Quote → confirmed (or declined) |
| Pricing | Single source of truth (immutable) | Single source of truth (editable with variation tracking) |
| Status naming | Inconsistent across app | Consistent everywhere |

---

*Status: Approved — reviewed and approved by Ryan*
*Created: 2026-03-19 | Session 2*
