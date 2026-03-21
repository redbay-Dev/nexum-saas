# Changelog

All notable changes to the Nexum project will be documented in this file.

## [0.10.0] — 2026-03-21

### Job Detail Completion, Dashboard, Settings UI

**What was built:**

Frontend — 4 new dialog components (`components/jobs/`):
- `add-location-dialog.tsx` — Select address from existing addresses, location type (pickup/delivery), contact name/phone, tip fee, instructions
- `add-material-dialog.tsx` — Source type selector (own stock/supplier/customer/disposal), cascading material select per source, quantity, unit of measure, flow type, notes. Material data is snapshot on add.
- `add-asset-requirement-dialog.tsx` — Asset category select with cascading subcategory, quantity, payload limit, special requirements
- `add-pricing-line-dialog.tsx` — Line type (revenue/cost), category, rate type, quantity + unit rate with auto-calculated total

Frontend — Job detail page updated:
- All 4 sub-resource cards (Locations, Materials, Asset Requirements, Pricing) now have "Add" buttons in their headers
- Buttons gated by `manage:jobs` / `manage:pricing` permission and job locked status (invoiced jobs can't be modified)

Frontend — Dashboard updated with real data:
- Jobs count (was "coming soon") now shows live count from API
- Employees count (was "coming soon") now shows live count from API
- Assets count (was "coming soon") now shows live count from API
- All 4 stat cards link to their respective list pages
- Quick actions updated: "Create job" is now the primary action

Frontend — Settings section and Job Types admin page:
- New "Settings" nav group in sidebar with SlidersHorizontal icon
- `pages/settings/job-types.tsx` — Full CRUD for job types at `/settings/job-types`
- Table view showing all types with visible sections badges, required fields badges, active/inactive status
- System types (Transport, Disposal, Hire, On-site) show "System" badge, cannot be deleted
- Create/edit dialog with: name, code, description, visible section checkboxes (locations, materials, asset requirements, pricing, scheduling), required field checkboxes (PO number, materials, locations), active toggle
- Route registered in App.tsx, breadcrumbs added

Frontend — Navigation:
- `app-shell.tsx` — Added SETTINGS_NAV group with "Job Types" link
- Breadcrumb map updated for `/settings/job-types`

**All checks pass:**
- `pnpm lint` — zero errors
- `pnpm type-check` — zero errors
- `pnpm test` — all passing (24 tests across 6 files)
- `pnpm build` — all packages build

**Known issues:**
- None discovered

**What's STILL MISSING:**
- Job assignments/allocations (assigning specific drivers and assets to confirmed jobs) — next major feature
- Scheduling view (Doc 07) — calendar/timeline showing jobs across dates — not started
- Dockets/Daysheets (Doc 08) — not started
- Pricing Engine (Doc 09) — not started
- Invoicing/RCTI (Doc 10) — not started
- Xero integration (Doc 11) — not started
- All optional platform modules (Docs 12-20) — not started
- Admin pages for: asset categories, material categories, qualification types, tenant org settings, user management, audit log viewer
- Integration/E2E tests
- CI/CD workflows (GitHub Actions)
- OpenAPI/Swagger documentation

**What's next:**
- Job assignments — assigning specific drivers and assets to confirmed jobs (extends Doc 06)
- Scheduling (Doc 07) — calendar/timeline view for resource allocation
- Dockets/Daysheets (Doc 08) — charge creation from completed jobs
- More admin/settings pages (asset categories, material categories, qualification types)

## [0.9.0] — 2026-03-21

### Job System (Doc 06) — Foundation Implementation

**What was built:**

Shared package — new constants, lifecycle module, and schemas:
- Job statuses updated: added "scheduled" and "declined" to lifecycle
- New constants: JOB_PRIORITIES, JOB_LOCATION_TYPES, JOB_PRICING_LINE_TYPES, JOB_PRICING_RATE_TYPES, JOB_PRICING_CATEGORIES, PROJECT_STATUSES
- `job-lifecycle.ts` — Status transition validation (isValidTransition, requiresReason, getValidTransitions) with full forward/backward transition map
- 16 new Zod schemas: job types (with JSONB sub-schemas for visibleSections, requiredFields, defaults), projects, jobs, job status transitions, job locations, job materials, job asset requirements, job pricing lines + all update variants
- TypeScript types derived from all new schemas

Backend — 8 new DB tables (migration 0004):
- `job_types` — Tenant-configurable with code uniqueness, visible sections, required fields, available pricing methods, defaults. System defaults seeded: Transport, Disposal, Hire, On-site
- `projects` — Optional job grouping with auto-generated project numbers (YYYY-PXXX), customer FK, sales rep, project lead
- `jobs` — Core job record with auto-generated job numbers (YYYY-XXXX), job type FK, customer FK, project FK, priority, scheduling timestamps, multi-day support, minimum charge hours, internal/external notes, cancellation reason, metadata JSONB
- `job_locations` — Pickup/delivery locations per job with address/entry point FKs, tip fee, arrival/departure times
- `job_materials` — Material snapshots copied from source tables on add (name, category, compliance JSONB preserved at time of addition)
- `job_asset_requirements` — Asset category/subcategory requirements with quantity and payload limit
- `job_pricing_lines` — Revenue/cost lines with rate type, quantity, unit rate, authoritative total, lock flag
- `job_status_history` — Full audit trail of every status transition with reason

Backend — 3 new route files:
- `routes/job-types.ts` — Full CRUD with unique code validation, system type deletion protection
- `routes/projects.ts` — Full CRUD with auto-numbering, customer validation
- `routes/jobs.ts` — Core CRUD (create/update/delete) + dedicated status transition endpoint (POST /:id/status) with lifecycle validation, auto-timestamp setting, pricing lock on invoiced + sub-resource CRUD for locations, materials (with snapshot), asset requirements, pricing lines (with lock protection)

Frontend — 3 API hook files:
- `api/job-types.ts` — Query key factory + CRUD hooks
- `api/projects.ts` — Query key factory + CRUD hooks
- `api/jobs.ts` — Query key factory + CRUD/status hooks + 8 sub-resource mutation hooks (create/delete for locations, materials, asset requirements, pricing lines)

Frontend — 6 new pages:
- `pages/jobs/index.tsx` — Job list with status tabs (9 statuses), priority filter, job type filter, search, table with job#/name/type/customer/status/priority/date
- `pages/jobs/create.tsx` — Multi-section form driven by job type visibleSections, customer/project select, scheduling, notes
- `pages/jobs/detail.tsx` — Full detail view with edit toggle, status transition controls with reason dialog, inline sub-resource tables (locations with address, materials with snapshot, asset requirements, pricing with revenue/cost/margin calculation), status history timeline
- `pages/projects/index.tsx` — Project list with status filter, search, table
- `pages/projects/create.tsx` — Simple form with customer select, dates, notes
- `pages/projects/detail.tsx` — Detail with edit toggle, linked jobs table

Navigation:
- Jobs (Briefcase icon) and Projects (FolderKanban icon) added to OPERATIONS_NAV at top of list
- Breadcrumb map updated for all new routes
- 6 new routes registered in App.tsx

**Business logic highlights:**
- Status lifecycle enforced: draft → quoted/scheduled/confirmed, confirmed → in_progress, etc. Reason required for cancellations, reversals
- actualStart auto-set on transition to in_progress, actualEnd on completed
- Pricing lines locked (isLocked=true) when job transitions to invoiced
- Invoiced jobs cannot be edited or deleted
- Material snapshot captures name, category, and compliance data at time of addition — source changes don't retroactively affect jobs
- Job types drive form behaviour via visibleSections (locations, materials, assetRequirements, pricing, scheduling)

**All checks pass:**
- `pnpm lint` — zero errors
- `pnpm type-check` — zero errors
- `pnpm test` — all passing
- `pnpm build` — all packages build

**Known issues:**
- None discovered

**What's STILL MISSING from the Job System spec (Doc 06):**
- Job assignments/allocations (assigning drivers and assets to jobs) — deferred
- Multi-customer billing on a single job — deferred
- Parent/child job relationships — deferred
- Job cloning — deferred
- Variation tracking — deferred
- Custom statuses beyond the system defaults — deferred
- Compliance gates (blocking transitions if SafeSpec checks fail) — deferred
- Real-time collaboration / WebSocket updates — deferred
- SMS notifications on status changes — deferred
- AI-powered features (auto-pricing, demand prediction) — deferred
- Docket restrictions on jobs — deferred
- Add forms for sub-resources from the job detail page (currently inline tables show existing, but add dialogs not yet built — user must use API directly or future UI)
- Job type settings page (admin UI to manage job types) — not yet built
- Bulk status operations — not yet built

**What's next:**
- Build add-resource dialogs on job detail page (add location, add material, add asset requirement, add pricing line)
- Job type settings/admin page
- Job assignments/allocations (assigning specific drivers and assets to confirmed jobs) — this is the next major feature
- Scheduling view (calendar/timeline showing jobs across dates)

## [0.8.0] — 2026-03-21

### Materials & Disposal (Doc 05) — Full CRUD Implementation

**What was built:**

Shared package — new constants and schemas:
- Material category types (12 categories: fill, soil, sand, rock, aggregate, road_base, concrete_demolition, asphalt, recycled, mulch_organic, hazardous_regulated, specialty)
- Material source types (tenant, supplier, customer, disposal)
- Material modes (disposal, supply) — disposal sites dual nature
- Material flow types (supply, disposal, buyback, transfer, delivery) — for job material movement
- Material pricing behaviours (transport_revenue, material_cost, material_resale, tracking_only)
- Units of measure (tonne, cubic_metre, load, hour, kilometre)
- Material compliance schema (hazardous, regulated waste, DG classification with UN number/class/packing group, EPA waste codes)
- DG classes (1-9) and packing groups (I, II, III)
- Zod schemas: createMaterialCategorySchema, createMaterialSubcategorySchema, createTenantMaterialSchema, createSupplierMaterialSchema, createCustomerMaterialSchema, createDisposalMaterialSchema, createDisposalSiteSettingsSchema (and all update variants)
- TypeScript types derived from all schemas

Backend — 7 new DB tables (migration 0003):
- `material_categories` — Two-level hierarchy top level (12 system-seeded defaults)
- `material_subcategories` — Subcategories within categories, with density factor
- `tenant_materials` — Own stockpile materials with compliance JSONB
- `supplier_materials` — Buy-side: supplier product code, purchase price, min order qty
- `customer_materials` — Sell-side: customer name, sale price
- `disposal_materials` — Dual-mode (disposal/supply): tip fee, environmental levy, minimum charge, sale price
- `disposal_site_settings` — Site-level config: operating hours, EPA licence, waste codes, account terms, pre-approval

Backend — 2 new route files:
- `routes/material-categories.ts` (~350 LOC) — Category CRUD + nested subcategory CRUD (mirrors asset-categories pattern)
- `routes/materials.ts` (~850 LOC) — Full CRUD for all 4 source types (tenant/supplier/customer/disposal) with source-specific validation (supplier must be isSupplier company, customer must be isCustomer). Joined queries return category/subcategory/address/company names. Disposal site settings upsert (GET/PUT). Cursor pagination on all list endpoints.

Frontend — 2 new API hook files:
- `api/material-categories.ts` — useMaterialCategories, useMaterialCategory, useCreateMaterialCategory, useUpdateMaterialCategory, useDeleteMaterialCategory, useCreateMaterialSubcategory, useDeleteMaterialSubcategory
- `api/materials.ts` — Per-source hooks: useTenantMaterials/useSupplierMaterials/useCustomerMaterials/useDisposalMaterials (list/detail/create/update/delete for each). useDisposalSiteSettings/useUpdateDisposalSiteSettings. Query key factory with source-type namespacing.

Frontend — 3 new pages:
- Materials list: search, source tab switching (Own Stock / Supplier / Customer / Disposal), per-source columns (supplier shows company, disposal shows mode badge), hazardous/DG badges, unit labels, status badges, edit/delete actions
- Create material: source type selector (dynamically shows supplier/customer/disposal fields), material category/subcategory cascade, address picker, unit of measure, density factor, source-specific pricing (purchase price, sale price, tip fee, environmental levy, minimum charge), full compliance section (hazardous, DG, regulated waste, EPA tracking)
- Material detail/edit: read-only view with overview, source-specific pricing, compliance section. Edit mode for name, description, density, and source-specific pricing fields.

Frontend — sidebar updated: Materials link enabled (was "coming soon"), breadcrumbs added for /materials and /materials/new. Asset Detail breadcrumb also fixed.

**Business logic implemented:**
- Separate tables per source (architecturally correct per spec — different fields, naming, pricing per context)
- Supplier validation (supplierId must reference isSupplier=true company)
- Customer validation (customerId must reference isCustomer=true company)
- Disposal address validation (addressId must exist)
- Material compliance flags (hazardous, DG, regulated waste, EPA) stored as JSONB
- Disposal dual nature: material_mode controls pricing (disposal=tip fee+levy+min charge, supply=sale price)
- Disposal site settings upsert (create or update on PUT)
- All mutations create audit log entries
- 12 default material categories seeded in migration

**What's deferred (per spec, needs other features first):**
- Material-in-job immutable snapshots (needs Job System — doc 06)
- Flow types and quantity tracking (loaded/delivered/actual) — needs dockets (doc 08)
- Subcontractor rates per material — needs RCTI system (doc 10)
- Billing account assignment (customer/third party) — needs invoicing (doc 10)
- Pricing precedence chain — needs Pricing Engine (doc 09)
- ~139 default subcategories seeding (categories are seeded, subcategories left for tenant customisation)

**What's next:**
- Build the Job System (doc 06) — the core feature, needs all entities (companies, employees, assets, materials) to exist
- Implement granular permission system (doc 18) — needed for proper access control
- Scheduling (doc 07) — resource allocation

## [0.7.0] — 2026-03-21

### Assets & Fleet (Doc 04) — Full CRUD Implementation

**What was built:**

Shared package — new constants and schemas:
- `ASSET_STATUSES` (available, in_use, maintenance, inspection, repairs, grounded, retired)
- `ASSET_OWNERSHIP_TYPES` (tenant, contractor)
- `INDUSTRY_TYPES` (transport, construction, general)
- Zod schemas: `createAssetCategorySchema`, `createAssetSubcategorySchema`, `createAssetSchema`, `updateAssetSchema`, `equipmentFittedSchema`, `createDefaultPairingSchema`
- Updated `ASSET_CATEGORIES` — changed `other` to `tool` per spec

Backend — 4 new DB tables (migration 0002):
- `asset_categories` — Tenant-configurable categories with per-category feature toggles (enableSpecifications, enableWeightSpecs, enableMassScheme, enableEngineHours, enableCapacityFields, enableRegistration, industryType, sortOrder)
- `asset_subcategories` — Subcategories within categories (e.g., "Prime Mover" under "Truck"), with vehicle configuration and default volume
- `assets` — Full asset records: core identification (auto-generated asset number YYYY-XXXX), registration, make/model/VIN, weight specs (tare/GVM/GCM), body configuration, equipment fitted (JSONB), capacity, engine hours, odometer, ownership (tenant vs contractor), operational status
- `default_pairings` — Truck-trailer default pairings for scheduling pre-selection

Backend — 2 new route files:
- `routes/asset-categories.ts` (~480 LOC) — Category CRUD + nested subcategory CRUD (POST/PUT/DELETE under `/:id/subcategories`). Default categories seeded in migration (Trucks, Trailers, Equipment, Tools)
- `routes/assets.ts` (~620 LOC) — Asset CRUD with search (rego, make, model, VIN), filtering (category, status, ownership, contractor), cursor pagination with joined category/subcategory/contractor names. Status change endpoint. Default pairing management (add/remove pairings with truck/trailer category validation, duplicate detection). Detail endpoint returns category feature toggles and all default pairings.

Frontend — 2 new API hook files:
- `api/asset-categories.ts` — useAssetCategories, useAssetCategory, useCreateAssetCategory, useUpdateAssetCategory, useDeleteAssetCategory, useCreateSubcategory, useDeleteSubcategory
- `api/assets.ts` — useAssets, useAsset, useCreateAsset, useUpdateAsset, useUpdateAssetStatus, useDeleteAsset, useCreatePairing, useDeletePairing

Frontend — 3 new pages:
- Assets list: search, filter by category/status/ownership, status badges, contractor indicators
- Create asset: dynamic form driven by category feature toggles (weight specs, body config, capacity, engine hours shown/hidden based on selected category), ownership selector with contractor company picker, auto-generated asset number
- Asset detail/edit: full read-only view with payload capacity calculation, inline edit form, status change dropdown, default pairings management (add/remove trailers via dialog)

Frontend — sidebar updated: Assets link enabled (was "coming soon"), breadcrumbs added

**Business logic implemented:**
- Category feature toggles control form sections (both create and edit)
- Auto-generated asset numbers (YYYY-XXXX format)
- Contractor validation (asset ownership=contractor requires valid contractor company)
- Category/subcategory reference validation on create
- Truck-trailer pairing validation (must be correct category types, no duplicates)
- Payload capacity display (GVM minus tare)
- Operational status change with audit logging
- All mutations create audit log entries

**What's deferred (per spec, needs other features first):**
- Compliance gates (needs SafeSpec integration — doc 12)
- Asset documents with expiry tracking (needs document management — doc 15)
- Maintenance schedules and defect management (needs compliance system)
- Pre-start checklists (needs DriverX — doc 20)
- Performance and utilisation analytics (needs jobs/dockets — docs 06/08)
- Volume override with approval workflow
- Custom fields per category (configurable field sets)
- Driver assignment tracking (needs scheduling — doc 07)
- Auto-deallocation on status change (needs scheduling)
- Registration duplicate detection

**What's next:**
- Build Materials & Disposal (doc 05) — material types, pricing behaviour, disposal sites. Jobs reference materials.
- Build the Job System (doc 06) — the core feature, needs assets + materials to exist first
- Implement granular permission system (doc 18)

## [0.6.1] — 2026-03-21

### Port Configuration Fix + Auth Flow + shadcn/ui Update

**What was fixed:**
- Corrected all stale port references across Nexum, OpShield, and SafeSpec
- Nexum frontend: 5171, SafeSpec frontend: 5172, OpShield frontend: 5170
- Previously had Vite defaults (5173/5174) in env files, config defaults, and docs
- This caused OpShield to redirect to wrong ports after auth, VSCode to auto-forward phantom ports

**Auth flow improvements:**
- Added `/login` page that auto-redirects to OpShield SSO, shows error messages on callback failure
- Simplified `ProtectedRoute` — uses `<Navigate to="/login">` instead of imperative redirect with loading state
- Refactored `auth-client.ts` — cleaner session checking, proper cookie-based auth with `redirectToLogin()` helper
- Updated `App.tsx` — added `/login` route, dashboard moved to `/dashboard` path, catch-all redirects to `/login`

**shadcn/ui component update:**
- Changed component style from `radix-nova` to `new-york` in `components.json`
- Updated 17 UI components (avatar, badge, button, card, dialog, dropdown-menu, field, input, label, select, separator, sheet, sidebar, skeleton, sonner, table, textarea, tooltip) to match new-york style

**Config/env:**
- `.env.example` — Replaced old Better Auth vars with OpShield config vars
- `packages/backend/src/config.ts` — Fixed `frontendUrl` default to 5171
- `packages/frontend/vite.config.ts` — Fixed dev server port to 5171
- `packages/frontend/playwright.config.ts` — Fixed baseURL to 5171
- `packages/frontend/src/App.test.tsx` — Fixed test to navigate to `/dashboard` instead of `/`
- `packages/frontend/src/vite-env.d.ts` — Added Vite client type declarations

**Docs updated:**
- `docs/24-OPSHIELD-PLATFORM.md`, `docs/DECISION-LOG.md` — Corrected port references

**Known issues:**
- None

**Still missing from spec (unchanged from 0.6.0):**
- Full job system (doc 06) — not started
- Scheduling (doc 07) — not started
- Dockets/daysheets (doc 08) — not started
- Pricing engine (doc 09) — not started
- Invoicing/RCTI (doc 10) — not started
- All optional modules — not started
- Dashboard with real widgets — currently placeholder
- Permission system with role-based access — middleware exists but no granular permissions yet
- Document management (doc 15) — not started

**What's next:**
- Build the Job System (doc 06) — core feature, needed before scheduling, dockets, and pricing
- Implement granular permission system (doc 18) — needed for all CRUD operations
- Build Dashboard widgets with real data (doc 04)

## [0.6.0] — 2026-03-20

### Drivers & Employees (Doc 03) + OpShield Integration Completion

**What was built:**

Backend — 5 new DB tables (employees, licences, medicals, qualification_types, qualifications):
- `employees` — Full employee records: personal details, employment type (full-time/part-time/casual/salary/wages), position, department, emergency contacts, driver flag, contractor company link, status lifecycle, soft delete
- `licences` — Driver licence records: class (C/LR/MR/HR/HC/MC), number, state of issue, expiry, conditions
- `medicals` — Medical certificates: certificate number, issued/expiry dates, conditions, notes
- `qualification_types` — Tenant-configurable qualification definitions: name, has expiry, requires evidence
- `qualifications` — Employee qualification records: type link, reference number, state, issued/expiry dates

Backend — 2 new route files:
- `routes/employees.ts` (~750 LOC) — Full CRUD with search, filtering by status/isDriver/contractor. GET detail includes licences, medicals, qualifications, and computed compliance status (compliant/expiring_soon/non_compliant). Nested CRUD for licences, medicals, qualifications under `/:employeeId/`.
- `routes/qualification-types.ts` (~200 LOC) — Tenant-configurable qualification type CRUD

Backend — `requireModule()` middleware (`middleware/modules.ts`):
- Fetches entitlements from OpShield API with Redis cache (15 min TTL)
- Falls back to local `tenants.enabledModules` if OpShield is unreachable
- User-friendly error messages (e.g. "Invoicing is not included in your current plan")

Backend — Webhook handlers (3 new events in `routes/webhooks.ts`):
- `tenant.created` — Creates local tenant record, provisions tenant schema, maps owner user
- `tenant.user_added` — Creates tenant_users mapping for new users
- `tenant.user_removed` — Deletes user mapping, revokes session

Frontend — 3 new pages:
- Employees list: search, filter by type (drivers/non-drivers) and status, role badges, contractor indicators
- Create employee: full form with personal details, employment details, driver toggle, inline emergency contacts
- Employee detail/edit: edit all fields + inline management of licences (add/delete), medical certificates (add/delete), and qualifications (add/delete with type selector)

Frontend — 2 new API hook files:
- `api/employees.ts` — useEmployees, useEmployee, useCreateEmployee, useUpdateEmployee, useDeleteEmployee, useCreateLicence, useDeleteLicence, useCreateMedical, useDeleteMedical, useCreateQualification, useDeleteQualification
- `api/qualification-types.ts` — useQualificationTypes, useCreateQualificationType

Shared package:
- Added `EMPLOYEE_STATUSES`, `EMPLOYMENT_TYPES`, `LICENCE_CLASSES` constants
- Added Zod schemas: createEmployeeSchema, updateEmployeeSchema, emergencyContactSchema, createLicenceSchema, updateLicenceSchema, createMedicalSchema, updateMedicalSchema, createQualificationTypeSchema, updateQualificationTypeSchema, createQualificationSchema, updateQualificationSchema
- Added corresponding TypeScript types

Navigation:
- Sidebar: "Drivers & Staff" nav item (was disabled placeholder)
- Router: /employees, /employees/new, /employees/:id routes
- Breadcrumbs: all employee pages

Database migration generated: `0001_dusty_next_avengers.sql` (5 new tables with indexes and FK constraints)

**All checks passing:**
- `pnpm lint` — zero errors
- `pnpm type-check` — zero errors
- `pnpm test` — 24 tests across 6 files, all passing
- `pnpm build` — all packages build (chunk size warning noted, not blocking)

**What's STILL MISSING from doc 03:**
- Timesheets (depends on Jobs — doc 06 — and DriverX — doc 20)
- Employee onboarding workflows (configurable checklists per role)
- Vehicle qualifications (depends on Assets/Fleet — doc 04)
- Document upload for evidence (depends on Documents — doc 15)

**What's next:**
- Assets/Fleet (doc 04) — vehicle register, categories, subcategories, default pairings, status tracking
- Materials/Disposal (doc 05) — material types, disposal sites
- Jobs (doc 06) — the core feature that ties everything together

## [0.5.0] — 2026-03-20

### Contacts, Addresses, Entry Points, Regions — Complete Doc 02 (Business Entities)

**What was built:**

Backend — 4 new route files (full CRUD with pagination, search, filtering, audit logging):
- `routes/contacts.ts` — CRUD with search by name/email/phone, company/address filtering, parent reference validation (contacts must have at least one parent), soft delete
- `routes/addresses.ts` — CRUD with search by street/suburb/postcode, state/region/type filtering, company linking endpoints (`POST /:id/companies`, `DELETE /:id/companies/:companyId`), detail includes linked companies, site contacts, and entry points
- `routes/entry-points.ts` — CRUD scoped to addresses, address existence validation, status tracking (active/temporarily_closed/seasonal)
- `routes/regions.ts` — CRUD with search, active/inactive toggle (`PUT /:id/toggle`), address count on detail

Backend — Infrastructure:
- `lib/redis.ts` — ioredis client with connect/disconnect lifecycle, shared Redis instance with `nexum:` key prefix
- `routes/webhooks.ts` — Rewrote all event handlers with real implementations (no TODOs): idempotency via Redis (24h TTL), entitlements cache invalidation, tenant status updates, session revocation
- `middleware/auth.ts` — Now checks Redis for revoked sessions before accepting JWT
- `server.ts` — Redis connect/disconnect in startup/shutdown lifecycle

Frontend — 9 new pages:
- Contacts: list (search, status filter), create (with prefilled companyId/addressId from query params), detail/edit
- Addresses: list (search), create (with region selector, type toggles, company linking), detail/edit (inline entry point management, linked companies, site contacts)
- Regions: list (search, activate/deactivate), create, detail/edit

Frontend — 3 new API hook files:
- `api/contacts.ts` — useContacts, useContact, useCreateContact, useUpdateContact, useDeleteContact
- `api/addresses.ts` — useAddresses, useAddress, useCreateAddress, useUpdateAddress, useDeleteAddress, useLinkCompanyToAddress, useUnlinkCompanyFromAddress, useCreateEntryPoint, useUpdateEntryPoint, useDeleteEntryPoint
- `api/regions.ts` — useRegions, useRegion, useCreateRegion, useUpdateRegion, useToggleRegion

Frontend — Navigation:
- Sidebar updated with Contacts, Addresses, Regions (no longer disabled)
- Router updated with all new routes
- Breadcrumbs updated for all new pages

Shared package:
- Added `updateEntryPointSchema` and `updateRegionSchema`

**All checks passing:**
- `pnpm lint` — zero errors
- `pnpm type-check` — zero errors
- `pnpm test` — all passing (24 tests across 6 files)
- `pnpm build` — all packages build (chunk size warning noted, not blocking)

**What's STILL MISSING from doc 02 (Business Entities):**
- Customer credit system (credit limit, credit hold/stop, credits on account, credit status visibility)
- Customer-specific data (default pricing link, invoice preferences, PO requirements)
- Contractor-specific data (rate cards, RCTI preferences, payment terms, compliance status flag)
- Contractor self-service document management (portal upload, tenant approval workflow, history tracking, expiry alerts)
- Contractor account items (extra charges, RCTI deductions, account statement)
- Supplier-specific data (material catalog link, supply pricing, delivery terms)
- Onboarding workflows (configurable checklists, ABN lookup API, digital forms, e-signatures, progress tracking)
- Onboarding status (incomplete/complete/requires attention lifecycle)
- Company status lifecycle warnings (archiving with outstanding invoices/incomplete jobs)

**What's next:**
- Drivers/Employees (doc 03) — new DB schema, routes, and UI
- Assets/Fleet (doc 04) — depends on drivers being in place
- The role-specific data for doc 02 (credit system, rate cards, RCTI, compliance) depends on later feature modules (Invoicing, Pricing, Compliance) and should be built when those modules are built

## [0.4.0] — 2026-03-20

### OpShield Auth Integration — Remove Embedded Better Auth

**What was built:**
- Removed embedded Better Auth instance from Nexum entirely
- Added OpShield JWT/JWKS validation via `jose` library (`lib/opshield-client.ts`)
- Rewrote `middleware/auth.ts` to validate OpShield JWTs (Bearer token or `opshield_token` cookie)
- `middleware/tenant.ts` unchanged in logic — still looks up `tenant_users` by user ID, now the ID comes from OpShield
- Added auth callback route (`/api/v1/auth/callback`) — receives JWT from OpShield login redirect, sets local cookie
- Added logout route (`/api/v1/auth/logout`) — clears local cookie
- Added login-url route (`/api/v1/auth/login-url`) — provides OpShield URLs for frontend redirects
- Added OpShield webhook handler (`/api/webhooks/opshield`) with HMAC-SHA256 signature verification
- Added `opshield_tenant_id` column to `tenants` table (links to OpShield tenant registry)
- Added `display_name` and `email` columns to `tenant_users` (cached from OpShield)
- Deleted `auth.ts`, `routes/onboard.ts`, `db/schema/auth.ts` (Better Auth tables)
- Removed login, register, and onboard frontend pages (OpShield handles these)
- Created `auth-error.tsx` page for failed OpShield callbacks
- `ProtectedRoute` now redirects to OpShield login instead of local `/login`
- `signOut()` clears local cookie and redirects to OpShield
- Replaced `better-auth` dependency with `jose` (backend) and removed from frontend
- Updated `.env.development` with `OPSHIELD_*` env vars
- Updated all tests to work with new auth flow

**Decisions made:**
- DEC-158: Extract auth from Nexum — delegate entirely to OpShield per docs/07-AUTH-ARCHITECTURE.md

**All checks passing:**
- `pnpm lint` — zero errors
- `pnpm type-check` — zero errors
- `pnpm test` — all passing
- `pnpm build` — all packages build

**What's STILL MISSING:**
- OpShield Phase 1 (Better Auth + tenant provisioning) — being built separately
- Redis-backed entitlements cache (15 min TTL, invalidated by webhooks)
- `requireModule()` middleware for module-gated routes
- Webhook handler TODO stubs (module activation, tenant suspension, session revocation)
- New database migration SQL for public schema changes (opshield_tenant_id, display_name, email columns)
- Impersonation support (yellow banner, audit log context)
- Support widget (help button → OpShield support API)

**What's next:**
- OpShield must be running for Nexum auth to work — test full login flow (OpShield → callback → local session)
- Implement entitlements cache and `requireModule()` middleware
- Resume feature development: Contacts + Addresses CRUD (doc 02)

## [0.3.0] — 2026-03-20

### OpShield Platform Architecture & Database Reset

**What was built:**
- Created OpShield platform architecture doc (`docs/24-OPSHIELD-PLATFORM.md`) — defines the central platform layer for auth, billing, provisioning, and admin across Nexum and SafeSpec
- Scaffolded the OpShield project at `/home/redbay/OpShield/` with CLAUDE.md, project overview, and decision log
- Updated `SAFESPEC-INTEGRATION-NOTE.md` to reference OpShield and three-project structure
- Updated `CLAUDE.md` with OpShield section, updated SafeSpec section, added doc 24 to reference table

**Decisions made:**
- DEC-156: OpShield as the central platform layer (auth SSO, billing, provisioning, admin)
- DEC-157: OpShield ports — API 3000, frontend 5170

**Database reset:**
- Dropped and recreated `nexum_dev` (empty, fresh)
- Dropped and recreated `safespec_dev` (empty, fresh)
- Created `opshield_dev` (new database for OpShield)
- All three databases are clean — migrations need to be re-run before development resumes

**All checks passing:**
- `pnpm lint` — zero errors
- `pnpm type-check` — zero errors
- `pnpm test` — all passing
- `pnpm build` — all packages build (chunk size warning noted, not blocking)

**What's STILL MISSING:**
- OpShield has no code yet — only docs and project structure
- Auth extraction (Better Auth currently embedded in Nexum and SafeSpec, needs to move to OpShield)
- Nexum and SafeSpec public schemas need to be re-pushed after DB reset
- All feature work from previous changelog entries still applies

**What's next:**
- Decide whether to build OpShield Phase 1 (auth + provisioning) or resume Nexum/SafeSpec feature development
- If resuming Nexum: re-run public schema migration, then continue with Contacts + Addresses CRUD (doc 02)
- If building OpShield: scaffold monorepo, set up Better Auth as THE SSO instance, build tenant registry

## [0.2.1] — 2026-03-20

### UI/UX Overhaul — Brand Theme & Page Styling

**What was fixed:**
- Complete CSS theme overhaul: replaced default shadcn neutral grayscale with Nexum brand colour `#005AD0` (oklch 0.45 0.19 260) per `docs/23-UI-UX-DESIGN.md`
- Dark sidebar theme (dark navy background, light text) — matches design doc spec
- Added `--success`, `--warning` semantic colour tokens
- Border radius set to 6px per design doc spec (was 10px default)
- Proper chart colours with distinct hues

**Pages restyled (all):**
- Login, Register, Onboard: proper `p-8` card padding, `h-11` inputs, `shadow-md` cards, `rounded-xl` with explicit borders
- Dashboard: stat cards with visible shadow and depth, larger icon containers, better spacing
- App Shell: sidebar header/footer padding increased, main content `p-8`, header bar `px-6`
- Companies list: card with border-separated toolbar/table/footer sections, proper search input height
- Company create/detail: form sections with `border-t`/`border-b` separators, `h-11` inputs throughout

**Documentation:**
- Added `docs/23-UI-UX-DESIGN.md` to CLAUDE.md reference table
- Updated App.test.tsx to match new page copy

**All checks passing:**
- `pnpm lint` — zero errors
- `pnpm type-check` — zero errors
- `pnpm test` — all passing
- `pnpm build` — all packages build (chunk size warning noted, not blocking)

**What's STILL MISSING:**
- Same as 0.2.0 — this was a UI fix session, no new features added
- Dark mode toggle not yet implemented (theme tokens are ready)
- Global search / command palette (Ctrl+K)
- Double-click to open / right-click context menu on tables (per doc 23)
- Sidebar collapse/expand behaviour (per doc 23 responsive spec)

**What's next:**
- Contacts + Addresses CRUD (completing doc 02 — Business Entities)
- Drivers/Employees (doc 03)
- Dark mode toggle implementation
- Consider code-splitting to address build chunk size warning

## [0.2.0] — 2026-03-20

### Phase 2-3: Database, Auth & First Feature

**What was built:**
- `.env.development` with real credentials for shared dev services (PostgreSQL, Redis, MinIO, MailHog)
- Created `nexum_dev` database on shared PostgreSQL instance
- Better Auth 1.5 integration (backend):
  - `src/auth.ts` — Better Auth config with Drizzle adapter, email/password, session caching, 2FA plugin
  - `src/db/schema/auth.ts` — Full Drizzle schema for Better Auth tables (user, session, account, verification, two_factor) with relations
  - `src/middleware/auth.ts` — Session extraction from Fastify requests
  - `src/middleware/tenant.ts` — Real implementation: extracts tenant context from Better Auth session, looks up membership + schema, creates tenant-scoped DB client
  - Better Auth catch-all route handler registered in app.ts (`/api/auth/*`)
- Tenant provisioning system:
  - `src/db/provision-tenant.ts` — provisionTenantSchema(), migrateTenantSchema(), migrateAllTenants() with FK reference transformation and migration tracking
  - Generated migrations for public schema (8 tables) and tenant schema (9 tables) via drizzle-kit
  - Pushed public schema to PostgreSQL
- API routes:
  - `POST /api/v1/onboard` — Creates tenant, provisions schema, seeds organisation, links authenticated user as owner
  - `GET /api/v1/auth/me` — Returns user identity, role, permissions
  - `GET/POST/PUT/DELETE /api/v1/companies` — Full CRUD with pagination, search, role filtering, audit logging, soft deletes
- Frontend (React 19 + shadcn/ui base-nova):
  - shadcn/ui initialized with 18 components (button, input, label, card, dialog, table, sidebar, badge, select, textarea, sonner, etc.)
  - Better Auth React client (`lib/auth-client.ts`)
  - API client with typed fetch wrapper (`lib/api-client.ts`)
  - Auth hooks: `useAuth`, `useAuthLoader` with permission check helper
  - Protected route with redirect to login or onboard
  - Login page, Register page, Onboard (workspace creation) page
  - App shell with sidebar navigation (Dashboard, Companies, placeholder items for Drivers/Assets/Materials)
  - Companies list page with search, role filter tabs, data table
  - Create company page with form (name, trading name, ABN, phone, email, roles, notes)
  - Company detail/edit page with update and delete
  - TanStack Query hooks for all company operations
  - Dashboard page with placeholder KPI cards

**Decisions made:**
- Better Auth URL set to `http://localhost:3002` (same as API, auth is embedded not separate)
- Onboarding flow: sign up → create workspace (tenant) → enter app
- shadcn/ui style: base-nova (uses @base-ui/react primitives, `render` prop instead of `asChild`)
- Companies CRUD is the first feature slice to prove full stack works end-to-end

**All checks passing:**
- `pnpm type-check` — zero errors
- `pnpm lint` — zero warnings
- `pnpm test` — 6 test files, all passing
- `pnpm build` — all 4 packages build successfully

**What's STILL MISSING:**
- Husky pre-commit hooks
- OpenAPI/Swagger documentation (@fastify/swagger + @scalar/api-reference)
- Contacts, Addresses, Entry Points, Regions CRUD (schemas and DB tables exist, no routes/UI)
- Drivers/Employees (doc 03) — not started
- Assets/Fleet (doc 04) — not started
- Materials/Disposal (doc 05) — not started
- Jobs, Scheduling, Dockets, Pricing, Invoicing (docs 06-11) — not started
- Platform features: compliance, comms, portal, documents, AI, reporting, maps, DriverX API (docs 12-20)
- E2E tests (Playwright)
- Integration tests for API routes (need test DB setup)

**What's next:**
- Contacts + Addresses CRUD (completing doc 02 — Business Entities)
- Drivers/Employees (doc 03)
- Assets/Fleet (doc 04)
- OpenAPI documentation

## [0.1.0] — 2026-03-19

### Phase 1: Monorepo Scaffold

**What was built:**
- Monorepo structure with pnpm 10 workspaces + Turborepo 2.8
- `@nexum/shared` — Zod 4 validation schemas, TypeScript types (derived from Zod), constants (all enums), utility functions (ABN validation, AU phone formatting, date/currency formatting), RBAC permissions system
- `@nexum/backend` — Fastify 5 server with health check endpoint, config loader, Drizzle ORM 0.45 schema definitions (public + tenant), multi-tenant database client with connection caching, tenant/permission middleware, dual drizzle configs (public + tenant schemas)
- `@nexum/frontend` — React 19 + Vite 8 + Tailwind CSS 4 (CSS-first config with @tailwindcss/vite) + shadcn/ui v4 CSS variables + React Router 7 + Zustand 5 + TanStack Query 5, landing page component
- `@nexum/pdf-templates` — Handlebars helpers (Australian date/currency/ABN formatting), tsup build
- Root configs: tsconfig.base.json (strict: true), ESLint 10 flat config, Prettier 3.8, turbo.json
- `.claude/` commands (/checks, /continue, /audit, /create-handler, /create-component) and skills (shadcn, drizzle, fastify, testing)
- `.env.example` with all connection strings (PostgreSQL, Redis, MinIO, SMTP, Auth)
- Tests: ABN validation, phone formatting, date/currency formatting, Handlebars helpers, health check endpoint, React App component

**Decisions made:**
- API port 3002 (SafeSpec uses 3001), frontend port 5171 (SafeSpec uses 5172)
- Redis key prefix `nexum:` (SafeSpec uses `safespec:`)
- Database name `nexum_dev` (SafeSpec uses `safespec_dev`)

**Known issues:**
- None at scaffold stage

**What's STILL MISSING (Phase 1):**
- `pnpm install` and dependency resolution
- Build verification (`pnpm build`, `pnpm lint`, `pnpm type-check`, `pnpm test`)
- Husky pre-commit hooks not yet configured
- shadcn/ui CLI init not yet run (components not installed)

**What's next:**
- Verify build passes with zero errors
- Phase 2: Database foundation (public schema migration, tenant schema template, provisioning, middleware)
- Phase 3: Better Auth integration, user management, permission system
