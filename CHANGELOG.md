# Changelog

All notable changes to the Nexum project will be documented in this file.

## [0.17.0] — 2026-03-22

### Dockets & Daysheets — Complete Doc 08 Implementation

**What was built:**

Full implementation of the daysheet and docket system (doc 08) — the bridge between "the job happened" and "here's the invoice." Daysheets are the primary work record (what the driver did), dockets are external supporting documents (weighbridge tickets, tip receipts).

**New constants (8 enums):**
- `DAYSHEET_STATUSES` — updated workflow: submitted → review → reconciled → processed (+ rejected)
- `DAYSHEET_SUBMISSION_CHANNELS` — driverx, portal, staff_entry, auto_generated
- `DOCKET_STATUSES` — uploaded → matched → reconciled → filed
- `DOCKET_TYPES` — weighbridge_ticket, tip_receipt, delivery_receipt, collection_receipt
- `CHARGE_STATUSES` — pending, approved, invoiced, void
- `OVERAGE_TYPES` — payload, volume, contract_limit
- `OVERAGE_SEVERITIES` — minor (auto-approve), significant, critical
- `OVERAGE_APPROVAL_STATUSES` — pending, approved, rejected, auto_approved

**New database tables (6):**
- `daysheets` — primary work record with tonnage/hourly fields, submission channel, processing metadata
- `daysheet_loads` — individual loads within a daysheet (material, weights, quantities per load)
- `dockets` — external documents with AI confidence scores, reconciliation status
- `docket_files` — uploaded images/documents linked to dockets (ready for S3/Spaces)
- `charges` — charge lines created from daysheet processing, linked to pricing lines
- `overages` — detected overages with severity classification and approval workflow

**New backend services (4 pure-function modules):**
- `weight-calculator.ts` — net weight = gross - tare, payable weight capping, payload overage check, load aggregation
- `time-calculator.ts` — hours from start/end times, overtime calculation, break deduction, session aggregation
- `overage-detector.ts` — payload/volume/contract limit checks with 3-tier severity (minor 2%, significant, critical 10%)
- `charge-creator.ts` — generates charges from pricing lines × daysheet quantities (per_tonne, per_hour, per_load, etc.)
- `reconciliation.ts` — docket-to-daysheet comparison with configurable tolerance, auto-processing eligibility check

**New backend routes (2 route files, ~30 endpoints):**

*Daysheet routes (`/api/v1/daysheets`):*
- `GET /` — list with filters (status, job, driver, asset, date range, search)
- `GET /:id` — detail with loads, dockets, charges, overages
- `POST /` — create daysheet (auto-calculates time from start/end)
- `PUT /:id` — update (recalculates time, blocks if processed)
- `DELETE /:id` — soft-delete (blocks if processed)
- `POST /:id/transition` — status transitions with validation
- `POST /:id/loads` — add load (auto-calculates net weight, recalculates totals)
- `PUT /:id/loads/:subId` — update load
- `DELETE /:id/loads/:subId` — remove load (recalculates totals)
- `POST /:id/process` — process daysheet: generates charges from pricing lines, blocks if pending overages
- `POST /batch-process` — batch process up to 100 daysheets with partial failure handling
- `POST /:id/detect-overages` — run overage detection per load (auto-approves minor)
- `POST /:id/check-auto-process` — check auto-processing eligibility

*Docket routes (`/api/v1/dockets`):*
- `GET /` — list with filters (status, job, daysheet, type, date range, search)
- `GET /:id` — detail with files
- `POST /` — create docket (auto-matches to daysheet if provided)
- `PUT /:id` — update (blocks if filed)
- `DELETE /:id` — soft-delete
- `POST /:id/transition` — status transitions
- `POST /:id/reconcile` — reconcile against matched daysheet (tolerance-based comparison)
- `GET /overages` — list overages with filters (approval status, severity, driver, asset)
- `POST /overages/:id/decision` — approve/reject overage with notes
- `GET /charges` — list charges for invoicing pipeline

**New frontend pages (3 pages + API hooks):**
- Daysheets list page — table with status/date/driver/asset filters, batch selection, batch process button
- Daysheet create page — job selector, work date, time fields, submission channel, notes
- Daysheet detail page — full processing UI with:
  - Summary cards (driver, asset, weight/hours, loads)
  - Loads table with add/remove (dialog for adding loads with weight/quantity fields)
  - Overages table with one-click approve/reject
  - Supporting dockets table with discrepancy indicators
  - Charges table (visible after processing) with revenue/cost/profit summary
  - Time section with start/end/overtime/billable breakdown
  - Status-aware action buttons (Start Review, Check Overages, Reject, Process, Resubmit)
- Sidebar navigation updated with "Daysheets" entry (ClipboardList icon)
- New checkbox UI component (shadcn/ui pattern)
- API hooks: 15+ TanStack Query hooks for all CRUD/process/transition/batch operations

**New migration:**
- `0014_daysheets_dockets.sql` — all 6 tables with indexes

**Test counts:**
- Before: 365 tests (201 shared + 158 backend + 4 pdf + 2 frontend)
- After: **452 tests** (225 shared + 227 backend) — **87 new tests**
- New unit tests: weight calculator (14), time calculator (10), overage detector (14), charge creator (14), reconciliation (11)
- New schema tests: 24 (daysheet, load, docket, charge, overage decision, batch process, reconciliation schemas)

**All checks pass:**
- `pnpm lint` — zero errors
- `pnpm type-check` — zero errors
- `pnpm build` — all packages build

**What's next:**
Continue the financial pipeline: **Invoicing & RCTI** (doc 10) — generate invoices from the charges now flowing through the daysheet processing system. The complete path is: job → pricing lines → daysheet → charges → invoice.

**What's STILL MISSING from doc 08 (deferred for future sessions):**
- **AI docket reading (OCR)** — requires AI provider integration (doc 16), scaffolded with `aiConfidence` and `aiProcessed` fields
- **File upload/download** — `docket_files` table ready, needs S3/Spaces integration (doc 15)
- **Inline document viewing** — requires presigned URL generation from storage layer
- **Auto-generation of daysheets** — for completed jobs with company assets, generate estimated daysheets
- **Pattern detection dashboard** — overage trends by driver/asset/route (analytics feature, doc 17)
- **Real-time WebSocket updates** — for multi-user processing (doc 13)
- **DriverX submission channel** — depends on mobile app API (doc 20)
- **Portal upload channel** — depends on contractor portal (doc 14)

## [0.16.0] — 2026-03-21

### Complete Pricing Engine — All Doc 09 Features Implemented

**What was built:**

Complete implementation of the pricing engine (doc 09) across 8 phases, covering every sub-feature specified in the spec. Previous sessions had basic pricing line CRUD and financial summary (~20% of doc 09). This session implements the remaining ~80%.

**Phase 1 — Foundation:**
- Extended `job_pricing_lines` with 8 new columns: `credit_type`, `original_line_id`, `snapshot_at`, `used_customer_pricing`, `rate_card_entry_id`, `surcharge_id`, `markup_rule_id`, `margin_override_reason`
- Added `"buyback"` to `MATERIAL_PRICING_BEHAVIOURS` (was missing — spec requires 5 behaviours)
- Extended `JOB_PRICING_SOURCES` with `"rate_card"`, `"markup_rule"`, `"surcharge"`
- New constants: `CREDIT_TYPES`, `MARKUP_RULE_TYPES`, `SURCHARGE_TYPES`, `MARGIN_THRESHOLD_LEVELS`, `PRICE_CHANGE_SOURCES`, `QUOTE_PRICING_MODES`
- Extended `organisation` table with `quote_pricing_mode` and `stale_rate_threshold_days`
- Pricing line schema now allows negative amounts for credits

**Phase 2 — Customer Rate Cards:**
- `customer_rate_cards` + `customer_rate_card_entries` tables
- Three-tier rate lookup service: customer rate card → standard material rate → manual entry
- Effective date filtering — rate cards only apply within their date range
- Full CRUD (8 endpoints) at `/api/v1/rate-cards`
- Rate lookup endpoint: `GET /api/v1/rate-cards/lookup`
- Frontend: Rate Cards settings page + detail page with entries management
- `usedCustomerPricing` flag tracks when auto-applied rates were used

**Phase 3 — Markup Rules + Margin Thresholds:**
- `markup_rules` table — priority-based cost-to-revenue auto-generation
- `margin_thresholds` table — multi-level margin validation (global > category > customer > material_type)
- Markup engine: finds highest-priority matching rule, applies percentage or fixed amount markup
- Margin check service: most-specific-wins threshold lookup, returns ok/warning/blocked
- Test/preview endpoint: `POST /api/v1/markup-rules/test` — enter a cost scenario, see which rule matches and the result
- Full CRUD for both (10 endpoints total)
- Frontend: Markup Rules page with priority ordering + test dialog, Margin Thresholds page

**Phase 4 — Surcharges & Credits:**
- `surcharges` + `surcharge_history` tables
- Surcharge engine: finds applicable surcharges by category + effective date, generates surcharge line data
- Value change history recorded automatically
- Full CRUD (5 endpoints) at `/api/v1/surcharges`
- Credits: pricing lines now support negative amounts with `creditType` (overpayment, goodwill, rate_correction, reversal) and `originalLineId` linking
- Frontend: Surcharges settings page with category selector + auto-apply toggle

**Phase 5 — Pricing Templates + Behaviour Auto-Generation:**
- `pricing_templates` + `pricing_template_lines` tables
- Template apply endpoint: bulk-creates pricing lines on a job from template
- Pricing behaviour engine (pure functions, unit-tested):
  - `inferPricingBehaviour()` — context-based inference per doc 09 rules
  - `generatePricingLinesFromBehaviour()` — creates appropriate lines per behaviour type
  - `generateTipFeeLines()` — tip fee + environmental levy auto-generation with minimum charge enforcement
  - Subcontractor rate auto-generation when `has_subcontractor_rate` flag set
- Full template CRUD + apply (7 endpoints) at `/api/v1/pricing-templates`
- Frontend: Pricing Templates settings page

**Phase 6 — Price History, Bulk Updates, Rate Review:**
- `price_history` table — tracks all material price changes with effective dates, change sources, and bulk update grouping
- `recordPriceChange()` service — called on every material price update
- `getPriceAsOf()` — effective-date price lookup (most recent price before a given date)
- Bulk percentage update: apply % increase/decrease to selected materials
- Supplier-wide bulk update: update all materials from a specific supplier
- Stale rate detection: query materials not updated within configurable threshold
- Mark-as-reviewed endpoint for rate review workflow
- 6 endpoints at `/api/v1/price-management`

**Phase 7 — Snapshots, Immutability, Quote Pricing Modes:**
- Snapshot at confirmation: all pricing lines get `snapshot_at` timestamp when job → confirmed
- Lock at invoice: all pricing lines get `is_locked = true` when job → invoiced
- Variation enforcement: post-snapshot pricing line edits require `isVariation = true` (returns SNAPSHOT_VARIATION_REQUIRED error otherwise)
- Quote pricing mode: tenant-configurable `lock_at_quote` vs `update_on_acceptance` (stored on organisation)
- Frontend: quote pricing mode toggle + stale rate threshold on Organisation Settings page

**Phase 8 — Pricing Allocations + Hourly Rate Enforcement:**
- `pricing_allocations` table — multi-customer job splits (amount + percentage per customer)
- Allocation validator: ensures percentages sum to 100% and amounts sum to line total
- Hourly charge calculator: minimum hours enforcement, overtime rate after threshold hours
- Jobs table extended with `overtime_rate` and `overtime_threshold_hours` columns
- Job schema updated to accept overtime fields

**New database tables (10):**
- `customer_rate_cards`, `customer_rate_card_entries`
- `markup_rules`, `margin_thresholds`
- `surcharges`, `surcharge_history`
- `pricing_templates`, `pricing_template_lines`
- `price_history`
- `pricing_allocations`

**New migrations (7):**
- `0007_pricing_engine_foundation.sql` through `0013_pricing_allocations.sql`

**New backend services (9):**
- `rate-lookup.ts`, `markup-engine.ts`, `margin-check.ts`, `surcharge-engine.ts`
- `pricing-behaviour.ts`, `price-history.ts`, `pricing-snapshot.ts`
- `hourly-pricing.ts`, `allocation-validator.ts`

**New route files (6):**
- `rate-cards.ts` (8 endpoints), `markup-rules.ts` (6), `margin-thresholds.ts` (4)
- `surcharges.ts` (5), `pricing-templates.ts` (7), `price-management.ts` (6)

**New frontend pages (6 settings pages):**
- Rate Cards (list + detail with entries), Markup Rules (with test/preview dialog)
- Margin Thresholds, Surcharges, Pricing Templates
- Organisation Settings extended with pricing configuration section

**Test counts:**
- Before: 254 tests across 14 files
- After: **365 tests across 22 files** (201 shared, 158 backend, 4 pdf, 2 frontend)
- New: 111 tests — 74 integration tests (rate cards, markup rules, margin thresholds, surcharges) + 37 unit tests (pricing behaviours, hourly pricing, allocation validation, schema validation)

**All checks pass:**
- `pnpm lint` — zero errors
- `pnpm type-check` — zero errors
- `pnpm test` — 365 tests, all passing
- `pnpm build` — all packages build

**What's next:**
Continue the financial pipeline: **Dockets & Daysheets** (doc 08) → captures what happened on each job day, bridges completed work to billing via the daysheet-to-pricing flow (now that the pricing engine exists to receive it). Then Invoicing (doc 10) to generate revenue from the pricing lines.

## [0.15.0] — 2026-03-21

### Deepen Three Half-Built Features — Pricing, Scheduling, Admin

**What was built:**

Three areas that had basic CRUD but lacked business logic were deepened with real functionality.

**Pricing Engine Depth:**
- Variation line tracking (`isVariation`, `variationReason`) for mid-job pricing changes
- Source tracking (`source`: manual/material/tip_fee/subcontractor) to trace how pricing lines were created
- Planned vs actual tracking fields (`plannedQuantity`, `plannedUnitRate`, `plannedTotal`)
- `equipment` and `labour` pricing categories added (spec required 9 categories, had 7)
- `GET /api/v1/jobs/:id/financial-summary` — computes total revenue, total cost, gross profit, margin %, category breakdown
- Audit logging on all pricing line CREATE/UPDATE/DELETE operations
- `JobFinancialSummary` component on job detail page with color-coded margin indicators
- Updated pricing dialog with variation toggle and conditional reason field
- Tax fields explicitly excluded — tax is Xero's responsibility (DEC-168)

**Scheduling Depth:**
- Job status auto-transition on resource allocation: `confirmed → scheduled` (or `→ in_progress` if `scheduledStart` is past)
- `PUT /api/v1/scheduling/deallocate/:id` — deallocation with reason capture, completed loads, notes
- `POST /api/v1/scheduling/bulk-allocate` — allocate up to 300 resources in one request with per-allocation validation, partial failure handling, and auto status transition
- Requirement fulfilment tracking in GET /scheduling response (`allocated` count, `fulfilled` boolean per asset requirement)
- `DeallocationDialog` component with reason selection, completed loads, and notes

**Settings/Admin:**
- `GET/PUT /api/v1/organisation` — view and edit company profile, banking, timezone, payment terms
- `GET /api/v1/users` — list all tenant users with role, status, ownership
- `PUT /api/v1/users/:id/role` — change role (guards: no self-change, no last-owner demotion)
- `PUT /api/v1/users/:id/status` — activate/deactivate user (guard: no self-deactivation)
- `GET /api/v1/audit-log` — paginated, filterable audit log viewer (by action, entityType, userId, date range, search)
- Settings layout with sidebar navigation (Organisation, Users, Job Types, Audit Log)
- Organisation settings page — company details, banking (BSB/account), timezone, payment terms
- User management page — role dropdowns, activate/deactivate buttons, owner badge
- Audit log page — filterable table with expandable change detail panels

**Database migrations:**
- `0006_pricing_admin_scheduling.sql` — pricing line enrichment (planned/actual, variation, source), assignment deallocation fields
- `0001_user_status.sql` (public) — user status column on tenant_users

**Test counts:**
- Before: 230 tests across 12 files
- After: **254 tests across 14 files** (88 backend, 166 shared)
- New: 24 integration tests covering pricing variations, financial summary, audit logging, organisation CRUD, user management, deallocation, bulk allocation, status auto-transitions

**All checks pass:**
- `pnpm lint` — zero errors
- `pnpm type-check` — zero errors
- `pnpm test` — 254 tests, all passing
- `pnpm build` — all packages build

**Decisions made:**
- DEC-168: No tax fields in Nexum pricing — tax is Xero's domain
- DEC-169: Sequential test file execution for integration tests sharing a database

**What's STILL MISSING (by area):**

*Pricing Engine (doc 09):*
- Customer rate cards (table + lookup + auto-apply)
- Markup rules engine
- Margin thresholds and warnings
- Subcontractor rate auto-generation
- Tip fee auto-generation from disposal locations
- Pricing snapshots and immutability enforcement
- Quote pricing lock/update modes
- Surcharges and levies
- Credits and negative pricing lines
- Pricing templates and job type defaults
- Daysheet-to-pricing flow
- Rate review workflow
- Bulk price updates

*Scheduling (doc 07):*
- Real-time WebSocket broadcast for multi-user scheduling
- Smart recommendations (multi-factor scoring)
- AI-driven auto-allocation
- Timeline/Gantt view
- Recurring schedules
- Saved view presets
- Compliance gates on allocation
- Route and backhaul integration
- Assignment notifications (SMS/push)

*Admin (doc 18):*
- Custom role builder UI (create/edit roles with permission picker)
- User invitation flow (requires OpShield integration)
- Session management
- Per-user permission overrides
- Feature toggles UI
- Data export
- Onboarding wizard

*Not started:*
- Dockets & Daysheets (doc 08) — next priority
- Invoicing & RCTI (doc 10)
- Xero integration (doc 11)
- Compliance/SafeSpec integration (doc 12)
- Communications/SMS (doc 13)
- Portal (doc 14)
- Documents/File management (doc 15)
- AI features (doc 16)
- Reporting (doc 17)
- Map/GPS (doc 19)
- DriverX API (doc 20)

**What's next:**
Continue the financial pipeline: **Dockets & Daysheets** (doc 08) → captures what happened on each job day, bridges completed work to billing. Then Invoicing (doc 10) to generate revenue.

## [0.14.0] — 2026-03-21

### Integration Tests — Full Business Logic Tests Against Real Database

**What was built:**

Real integration test infrastructure — no mocks. Every test hits real routes through real middleware against a real PostgreSQL database with a real tenant schema.

**Test infrastructure:**
- `test-utils/global-setup.ts` — Creates `nexum_test` database, runs public + tenant schema migrations, provisions test tenant (`tenant_11111111-1111-4111-a111-111111111111`), seeds 4 test users (owner/dispatcher/finance/read_only), 2 job types, 3 companies, 4 employees, 3 assets, 2 addresses, 1 project
- `test-utils/seed.ts` — Fixed v4 UUIDs for all seed data, idempotent inserts (`ON CONFLICT DO NOTHING`)
- `test-utils/helpers.ts` — `injectAs(app, role, method, url, payload?)` sends authenticated requests via `X-Test-Auth` header; `cleanupJobs()` truncates mutable tables between test groups
- `middleware/auth.ts` — Added test auth code path: when `NODE_ENV=test` and `X-Test-Auth` header present, parses session directly. All downstream processing (real DB lookup in `tenant_users`, real permission checks, real audit logging) is unchanged.
- `vitest.config.ts` — `globalSetup`, `env` overrides for test DB, `pool: "forks"` for connection isolation

**Integration tests (`jobs.integration.test.ts`) — 38 tests covering:**
- **Job CRUD** (7 tests) — Create, read detail with sub-resources, update, soft delete (verify row still exists with `deleted_at`), list with filtering/pagination, validation errors, non-customer rejection
- **Status Lifecycle** (8 tests) — Forward transitions (draft→scheduled, draft→confirmed→in_progress with `actualStart` auto-set, completion with `actualEnd` auto-set), invalid transitions rejected (`INVALID_TRANSITION`), invoiced is terminal (no outgoing transitions), self-transitions rejected, rework path (completed→in_progress with reason), recovery path (cancelled→draft with reason)
- **Reason Requirements** (3 tests) — Confirmed→cancelled without reason returns `REASON_REQUIRED`, with reason stores `cancellationReason`, rework without reason rejected
- **Cancellation Cascades** (1 test) — Cancel a confirmed job with 2 assignments → both assignments auto-set to `cancelled` status (verified by direct DB query)
- **Invoice Lock** (4 tests) — Invoiced job: pricing lines have `is_locked=true` (DB query), edit returns `JOB_LOCKED`, delete returns `JOB_LOCKED`, adding pricing lines returns `JOB_LOCKED`
- **Assignment Validation** (9 tests) — Reject maintenance asset (`RESOURCE_UNAVAILABLE`), accept available/in_use assets, reject terminated driver, reject non-driver employee, accept active driver, reject non-contractor company, accept contractor, reject assignments on cancelled jobs
- **Permission Enforcement** (4 tests) — Finance cannot create jobs (403), read_only cannot create (403) but can view (200), dispatcher can create and update, unauthenticated returns 401
- **Audit Logging** (1 test) — Create/update/status-change/delete all produce audit entries (verified by direct DB query on `audit_log` table)

**Test counts:**
- Before: 192 tests (unit + route protection only)
- After: **230 tests across 12 files**
- Backend: 58 tests (3 files — health, status/auth enforcement, **38 new integration tests**)
- Shared: 166 tests (7 files)
- Frontend: 2 tests, PDF: 4 tests

**All checks pass:**
- `pnpm lint` — zero errors
- `pnpm type-check` — zero errors
- `pnpm test` — 230 tests, all passing

## [0.13.0] — 2026-03-21

### Testing — Unit Tests for Business Logic, Schemas, and Route Protection

**What was built:**

Shared package — new test files:
- `permissions.test.ts` — Tests the role→permission matrix: owner gets all 40 permissions, admin gets all except `manage:organisation`, dispatcher manages jobs/scheduling/SMS/AI but not finance, finance manages dockets/pricing/invoicing/RCTI/Xero but not jobs, compliance manages compliance/documents/reports, read_only gets only `view:*` permissions. Verifies no overlap between dispatcher and finance write permissions.
- `job-lifecycle.test.ts` — Tests job status transition state machine: 15 valid forward transitions (draft→quoted→scheduled→confirmed→in_progress→completed→invoiced), cancellation from every pre-invoice state, rework path (completed→in_progress), recovery (cancelled→draft, declined→draft/quoted), terminal state (invoiced allows nothing), self-transitions rejected. Tests reason requirements: 7 transitions require reason (cancellations from confirmed/in_progress, rework, reactivations, declines), normal forward transitions do not.
- `schemas/schemas.test.ts` — Tests Zod validation schemas: ABN (11-digit regex), company (roles min 1, status default), employee (employment types, driver flag, emergency contacts), licence (all 6 Australian classes, all 8 states), medical records, job (priority default, UUID validation), job status transitions, locations (pickup/delivery), pricing lines (rate types, categories, non-negative constraints), assignments (asset/driver/contractor types), addresses (postcode 4 digits, lat/lng bounds, state validation), contacts (default preferred method), assets (status/ownership defaults, year range, weight validation), materials (all 4 source types with required fields, compliance flags, disposal fees), organisation (BSB format, payment terms cap, timezone default), pagination (limit coercion, bounds).
- `utils/datetime.test.ts` — Tests `formatDateTimeAu` format pattern, `formatCurrencyAud` edge cases (large numbers, small decimals, whole numbers).

Backend — new test file:
- `routes/status.test.ts` — Tests GET /api/v1/status returns version and environment. Tests auth enforcement: all 14 tenant-scoped route groups return 401 without auth (companies, jobs, employees, assets, scheduling, contacts, addresses, regions, projects, job-types, asset-categories, material-categories, qualification-types, materials/tenant). Tests unauthenticated routes (health, status) succeed without auth. Tests 404 for non-existent routes.

**Test counts:**
- Before: 24 tests across 6 files
- After: **192 tests across 11 files** (8x increase)
- Shared: 166 tests (7 files) — permissions, job lifecycle, schemas, utilities
- Backend: 20 tests (2 files) — health, status/auth enforcement
- Frontend: 2 tests (1 file) — app render
- PDF templates: 4 tests (1 file) — Handlebars helpers

**All checks pass:**
- `pnpm lint` — zero errors
- `pnpm type-check` — zero errors
- `pnpm test` — 192 tests, all passing
- `pnpm build` — all packages build

**Known issues:**
- None discovered

**What's STILL MISSING for comprehensive test coverage:**
- Integration tests against test database (need test DB setup, seed data, auth mocking)
- Business logic tests for route handlers (job status transitions with DB, assignment cascade, audit logging)
- Multi-tenant isolation tests (tenant A cannot see tenant B data)
- Permission enforcement tests per route with mocked auth context
- Module entitlement tests (requireModule middleware)
- Frontend component tests (React Testing Library)
- E2E tests (Playwright configuration and critical workflow tests)

**What's next:**
- Test database setup (nexum_test, seed scripts, auth mocking utilities)
- Integration tests for job lifecycle routes
- Dockets & Daysheets (Doc 08) — charge creation from completed jobs
- Pricing Engine (Doc 09) — rate matrices and calculation rules

## [0.12.0] — 2026-03-21

### Scheduling — Dispatcher Resource Allocation View

**What was built:**

Backend — new scheduling route (`/api/v1/scheduling`):
- `GET /api/v1/scheduling` — Returns jobs for a specific date with all assignments, locations, asset requirements, and joined resource data. Filters by status, priority, job type, customer, project, allocation status. Supports search across job number, name, customer, locations, asset registration, driver names, contractor names. Excludes cancelled/declined jobs by default. Returns summary stats (total, allocated, unallocated, assignment count).
- `GET /api/v1/scheduling/conflicts` — Returns double-booking warnings for the date. Groups assignments by asset/driver and identifies resources assigned to 2+ jobs. Optionally filters to specific asset or driver. Returns conflict details with job numbers and time windows.
- `GET /api/v1/scheduling/resources` — Returns available assets and drivers with their allocation count for the day. Assets filtered to available/in_use status, drivers filtered to active. Includes category/subcategory info for assets.

Frontend — new API hooks (`api/scheduling.ts`):
- `useSchedulingJobs(params)` — Fetch jobs for scheduler with all filters
- `useSchedulingConflicts(date)` — Fetch double-booking conflicts
- `useSchedulingResources(date, type?)` — Fetch available resources with allocation counts
- Full TypeScript types for all scheduler data structures

Frontend — new scheduling page (`/scheduling`):
- **Date navigation** — Yesterday/Today/Tomorrow + 3 forward date tabs, arrow navigation, calendar date picker, "Go to Today" button
- **Table view — Line mode** — One compact row per job showing: job number (links to detail), name, type, customer, location summary (pickup → delivery), allocation count with conflict warning, status, priority, scheduled time, "Allocate" action button
- **Table view — Multi-line mode** — Expanded view showing one row per assigned resource within each job. Shows resource type icon (truck/user/building), resource label, asset category, arrival time, assignment status. Unallocated jobs show italicised "No allocations" message. Conflict warnings inline with tooltip showing other jobs.
- **Grouping** — Group by customer (default), project, or flat list. Group headers show name and job count badge.
- **Filtering** — Allocation status (All/Allocated/Unallocated with live counts), job status (Any/Scheduled/Confirmed/In Progress/Completed/Draft), priority (All/High/Medium/Low), job type
- **Search** — Searches across job number, name, customer, project, PO number, internal notes, location addresses, asset registration/make/model, driver names, contractor names. Partial match.
- **Conflict display** — Header badge shows total conflict count. Row highlighting (destructive/5 bg) on jobs with conflicted resources. AlertTriangle icon on allocation count column.

Frontend — new allocation dialog (`components/scheduling/allocation-dialog.tsx`):
- Resource type selector tabs (Asset/Driver/Contractor) with icons
- Resource picker showing allocation counts per resource ("2 jobs" badge)
- Already-assigned resources disabled with "Already assigned" badge
- **Double-booking warning** — When selecting a resource that's already on other jobs that day, shows a warning panel with the resource name, number of other jobs, and their job numbers. Warning only, not a block — dispatcher makes the operational call.
- Arrival time pre-filled to 06:00 on the selected date
- Optional end time and notes fields
- Invalidates scheduling queries on success for immediate refresh

Frontend — navigation updated:
- "Scheduling" added to sidebar OPERATIONS group with CalendarClock icon (first item, above Jobs)
- Route registered at `/scheduling`
- Breadcrumb entry added

New shadcn/ui components added:
- Popover (date picker trigger)
- Calendar (date picker content, uses react-day-picker)
- Tabs (unused directly but available for future views)

**Business logic implemented:**
- Date-based job windowing — finds jobs scheduled on the date OR multi-day jobs spanning the date
- Double-booking detection — aggregates assignments by asset/driver across all jobs on a date, flags resources with 2+ assignments
- Resource availability tracking — shows allocation count per asset/driver for the selected day
- Search across all visible and related fields (app-wide principle from spec)
- Allocation from scheduler context reuses existing job assignment API with full type-specific validation

**All checks pass:**
- `pnpm lint` — zero errors
- `pnpm type-check` — zero errors
- `pnpm test` — all passing (24 tests across 6 files)
- `pnpm build` — all packages build (chunk size warning noted, not blocking)

**Known issues:**
- None discovered

**What's STILL MISSING from the full Scheduling spec (Doc 07):**
- Timeline/Gantt view — visual timeline with drag-drop allocation
- Saved views — user-configurable filter/grouping/column presets
- Multi-day side-by-side comparison view
- Separate scheduling window (open in new window/tab)
- Bulk allocation — allocate multiple resources in one action with staggered arrival times
- Smart recommendations — multi-factor scoring (region, ranking, availability, proximity, hours worked, maintenance, driver preference, capability match)
- AI-driven auto-allocation — auto/hybrid/human-review modes
- Route and backhaul integration — route awareness, backhaul detection, multi-stop optimization
- Recurring schedules — auto-creation from templates with recurrence patterns
- Real-time multi-user broadcast via WebSocket — live allocation updates across windows
- Compliance gates on allocation — check resource compliance before allowing allocation
- Deallocation with reason capture and completed load count
- Assignment notifications — SMS/push to drivers when assigned
- Requirement fulfilment tracking — link allocations to specific asset requirements

**What's next:**
- Timeline/Gantt view for visual scheduling
- Bulk allocation for large jobs (1-300 trucks)
- Dockets/Daysheets (Doc 08) — charge creation from completed jobs
- Pricing Engine (Doc 09) — rate matrices and calculation rules
- More admin/settings pages (asset categories, material categories, qualification types, org settings)

## [0.11.0] — 2026-03-21

### Job Assignments — Assign Assets, Drivers, and Contractors to Jobs

**What was built:**

Shared package — new constants and schemas:
- `JOB_ASSIGNMENT_TYPES` (asset, driver, contractor)
- `JOB_ASSIGNMENT_STATUSES` (assigned, in_progress, completed, cancelled)
- `createJobAssignmentSchema` — assignmentType, assetId/employeeId/contractorCompanyId, requirementId, plannedStart/End, notes
- `updateJobAssignmentSchema` — status, plannedStart/End, actualStart/End, notes
- TypeScript types: `CreateJobAssignmentInput`, `UpdateJobAssignmentInput`

Backend — new DB table (migration 0005):
- `job_assignments` — Links jobs to specific assets, drivers, or contractors. Tracks assignment lifecycle (assigned → in_progress → completed/cancelled), planned and actual start/end times, optional link back to an asset requirement for fulfilment tracking. Indexes on job_id, asset_id, employee_id, contractor_company_id, and status.

Backend — new CRUD endpoints on jobs route:
- `POST /api/v1/jobs/:id/assignments` — Create assignment with type-specific validation:
  - Asset assignments validate asset exists and is available/in_use
  - Driver assignments validate employee exists, is a driver, and is active
  - Contractor assignments validate company exists and is a contractor
  - Requirement reference validated against the job's actual requirements
  - Blocked on cancelled/invoiced jobs
- `PUT /api/v1/jobs/:id/assignments/:subId` — Update assignment status, times, notes
- `DELETE /api/v1/jobs/:id/assignments/:subId` — Remove assignment with audit logging
- Job cancellation now auto-cancels all active assignments (assigned/in_progress → cancelled)

Backend — job detail endpoint updated:
- `GET /api/v1/jobs/:id` now returns `assignments` array with joined data: asset registration/make/model/number, employee full name, contractor company name

Frontend — new API hooks:
- `useCreateJobAssignment(jobId)` — create assignment mutation
- `useUpdateJobAssignment(jobId)` — update assignment (status transitions)
- `useDeleteJobAssignment(jobId)` — remove assignment
- `JobAssignment` interface with all joined fields

Frontend — new dialog component:
- `add-assignment-dialog.tsx` — Assignment type selector (asset/driver/contractor), cascading resource picker per type, optional requirement linking, planned start/end datetime pickers, notes

Frontend — job detail page updated:
- New "Assignments" card section between Asset Requirements and Pricing
- Shows all assignments with type badge, resource label, status badge, planned times
- Action buttons per assignment: "Start" (assigned → in_progress), "Complete" (in_progress → completed), "Remove"
- Gated by `manage:jobs` permission and job locked status

**Business logic implemented:**
- Assignment type drives validation — assets must be available, drivers must be active and flagged as drivers, contractors must have contractor role
- Requirement fulfilment tracking — assignments can optionally link to an asset requirement, enabling future fulfilment status display
- Job cancellation cascades to release all active assignments
- Invoiced/cancelled jobs block new assignments
- Full audit trail for create/update/delete operations

**All checks pass:**
- `pnpm lint` — zero errors
- `pnpm type-check` — zero errors
- `pnpm test` — all passing (24 tests across 6 files)
- `pnpm build` — all packages build (chunk size warning noted, not blocking)

**Known issues:**
- None discovered

**What's STILL MISSING:**
- Scheduling view (Doc 07) — calendar/timeline showing jobs and assignments across dates — not started
- Conflict detection — checking if an asset/driver is already assigned to another job in the same time window
- Assignment notifications — SMS/push to drivers when assigned
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
- Scheduling (Doc 07) — calendar/timeline view for resource allocation, conflict detection
- Dockets/Daysheets (Doc 08) — charge creation from completed jobs
- More admin/settings pages (asset categories, material categories, qualification types)
- Assignment conflict detection (double-booking prevention)

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
