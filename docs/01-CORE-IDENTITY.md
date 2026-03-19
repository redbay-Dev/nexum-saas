# 01 — Core Identity & Multi-tenancy

## The Tenant Model

A tenant is the company using the system. That's it. The tenant is the owner of their data, not a participant within it. They never appear in the same table as their customers, contractors, or suppliers.

### What went wrong in Nexum
Nexum has two tables: `companies` (tenant identity) and `business_companies` (all business entities). A database design shortcut put the tenant into `business_companies` as well, because the invoicing code needed a `party_id` foreign key and that FK pointed to `business_companies`. Instead of handling the tenant's billing identity separately, the tenant was shoved into the same table as their customers. This created constant confusion about which ID to use where, and is documented as a critical gotcha in Nexum's CLAUDE.md.

### How the rebuild fixes it
The tenant exists in two places, clearly separated:

**Public schema — `tenants` table**
This is the platform-level record. One row per paying customer of the Nexum platform. Contains: subscription status, plan, billing contact, creation date. This is for platform administration only — the tenant's users never see or interact with this directly.

**Tenant schema — `organisation` profile**
Within each tenant's own schema, an `organisation` record holds their business identity: company name, ABN, logo, registered addresses, bank details (for RCTI), default payment terms, and any operational preferences. When an invoice needs "from" details, it reads from here. When an RCTI needs the principal's bank details, it reads from here. The organisation profile is the tenant's identity within their own world.

The tenant never appears as a row in the `companies` table alongside customers and suppliers. They are the owner of the schema, not a participant within it.

## Schema-Per-Tenant Isolation

Each tenant gets their own PostgreSQL schema. All of their data — companies, jobs, invoices, compliance records, everything — lives within that schema. The application sets the schema search path based on the authenticated user's tenant before any query runs.

### What this means in practice
- No `WHERE company_id = ?` on every query — data isolation is architectural, not query-based
- A missing filter can't leak data between tenants — they literally can't see each other's tables
- Tenant data can be backed up, restored, or deleted independently
- Cross-tenant queries are intentionally impossible from the application layer

### Platform-level concerns
Cross-tenant queries (for platform analytics, support, billing) are handled separately from a shared `public` schema or aggregated metrics pushed from each tenant schema. Tenant data isolation is worth this trade-off.

## Business Entities

Within a tenant's schema, there are three types of external business entities:

### Companies (unified table with role tags)
A single `companies` table holds all external business entities: customers, contractors, and suppliers. Each company has role flags indicating what they are to the tenant.

A company can have multiple roles simultaneously. This is common in practice — disposal sites both accept and supply materials, some contractors are also customers. The system supports this through role tags on a single record, not separate tables.

### How dual roles work in the UI
When a user views a company that has multiple roles, the interface shows tabbed sections for each role:
- **"As Customer"** tab — shows their jobs, invoices, credit status
- **"As Supplier"** tab — shows their materials, supply pricing
- **"As Contractor"** tab — shows their assigned work, RCTI, payments, compliance

One record, one profile, multiple views depending on context.

### Company record contents
Every company has:
- Business identity: name, ABN, trading name
- Contact details: primary phone, email, website
- Addresses: registered address, operational addresses
- Status: active, on hold, archived
- Notes and internal references

Role-specific data attaches based on which roles are active:
- **Customer role:** Credit terms, credit limit, default pricing, job history
- **Contractor role:** Rate cards, payment terms, compliance status, RCTI preferences, asset ownership
- **Supplier role:** Material catalog, supply pricing, delivery terms

### What changed from Nexum
In Nexum, the `business_companies` table uses boolean flags (`is_customer`, `is_contractor`, `is_supplier`). The rebuild keeps this same concept but makes it cleaner:
- The tenant is no longer in this table (see above)
- Role-specific data lives in related tables/sections, not crammed into one wide row
- The UI presents roles as tabs, not as a flat page showing everything

## Contacts

Contacts represent individual people associated with business entities or physical locations.

A contact belongs to either a **company** or an **address** (or both). This supports:
- Office contacts tied to a customer company
- Site contacts tied to a physical address (e.g., the weighbridge operator at a quarry)
- Contacts who are associated with both a company and a specific site

Contacts are not independent/orphaned — they always have at least one parent relationship.

### Contact record contents
- Personal details: name, role/title, phone, email
- Relationship: which company and/or address they belong to
- Communication preferences: preferred contact method, opt-in for SMS
- Status: active, inactive

## Addresses

Addresses are first-class entities in Nexum — they are far more than just a field on a company record. In transport, a physical location carries critical operational information that affects how jobs are planned, dispatched, and executed.

### Companies have many addresses
A single company can have many addresses. This is the norm, not the exception:
- A customer might have a head office, 5 construction sites, and 2 storage yards
- A supplier might operate 3 quarries and a processing plant
- A contractor might have a main depot and satellite yards in different regions

### Addresses can be shared across companies and roles
The same physical location can serve multiple purposes and be referenced by different companies. A quarry might be a supplier's operational site AND a customer's delivery point AND a disposal site. The address record is shared — its role changes depending on context (pickup, delivery, storage, disposal).

### Address record contents
- Location: street address, suburb, state, postcode
- Geolocation: latitude, longitude (for mapping and distance calculations)
- Region assignment: which geographic region this address falls in
- Types/roles: what this address is used for (can have multiple: office, job site, quarry, depot, disposal site, storage)
- Site contacts: people at this location (via the contact model) — many contacts per site
- Materials: what materials are stored/available here (Nexum's "materials belong to addresses" pattern is correct and preserved)
- Operating information: hours of operation, access conditions, general site notes
- Status: active, inactive

### Entry Points

Entry points are a critical sub-entity of addresses. A single address (e.g., a large construction site or quarry) can have multiple entry points — named access locations that drivers use to enter the site.

**Why entry points matter:** A construction site might have Gate 1 (main road access), Gate 2 (rear access for heavy vehicles), and Gate 3 (emergency/overflow). Which gate a driver uses depends on the current state of the job, weather conditions, vehicle type, project stage, and access limitations. Getting this wrong means delays, safety issues, or trucks stuck in the wrong place.

**Entry points belong to the address** and are reusable across any job at that address. But when a job references an address, it selects which entry point(s) are active for that job and can add job-specific notes or overrides.

**Entry point data includes:**
- Name and description (e.g., "Gate 3 — Rear access road")
- GPS coordinates (separate from the main address coordinates — a large site might span kilometres)
- Vehicle and weight restrictions (max vehicle size, weight limits, no B-doubles, etc.)
- Operating hours and conditions (open times, wet weather restrictions, seasonal access)
- Photos and media (photos of the entry point, maps, diagrams for driver reference)
- Driver instructions (approach directions, safety requirements, check-in procedures)
- Status: active, temporarily closed, seasonal

**Entry point changes during a job:**
When conditions change (weather, project stage, access limitations), the dispatcher updates the active entry point on the job. The driver is notified via DriverX. This is a dispatcher-driven action — the system needs to make it fast and obvious to change the entry point assignment on a live job.

### The address hierarchy in summary
```
Company (customer, supplier, contractor)
  └── Address (head office, quarry, job site, depot)
        ├── Entry Points (Gate 1, Gate 2, rear access)
        ├── Contacts (site manager, weighbridge operator)
        └── Materials (what's stored/available here)
```

## Regions

Regions are geographic areas used for resource allocation and scheduling. They are NOT the same as depots.

A region defines a zone: "North Metro", "Geelong Corridor", "Western Districts". Assets and drivers are assigned to regions. When scheduling a job at a site in the "North Metro" region, the scheduler shows resources assigned to that region first.

A depot is a physical location (an address) where assets are based. A depot sits within a region, but they're separate concepts. A region can contain multiple depots. A region can exist without a depot (e.g., a service area with no physical base).

The tenant defines their own regional structure to match how they operate.

### Region record contents
- Name and description
- Geographic boundary (optional — could be a polygon for map display, or just a label)
- Default assets and drivers assigned to this region
- Active/inactive status

## Module Visibility

Because the product is modular (see doc 00), the core identity system needs to know which modules a tenant has enabled. This affects:
- What navigation items appear
- What fields are shown on entity records (e.g., compliance status only shows if the compliance module is active)
- What role-specific data is collected (e.g., contractor RCTI preferences only matter if the RCTI module is enabled)

Module enablement is stored at the tenant level (public schema) and checked at login/session creation.

## Authentication & Sessions

Authentication uses Better Auth (self-hosted), consistent with the SafeSpec architecture. Key points:

- Users belong to a tenant
- A user can only access their own tenant's data
- Sessions carry the tenant ID, which sets the schema search path
- Role-based permissions control what a user can see and do within their tenant
- Contractor portal users authenticate through the same system but see a restricted view
- DriverX (native mobile app) authenticates via the same API using token-based auth

Detailed permission and role design is covered in doc 18 (Administration).

---

*Status: Approved — reviewed and approved by Ryan*
*Created: 2026-03-19 | Session 1*
