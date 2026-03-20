# Changelog

All notable changes to the Nexum project will be documented in this file.

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
- API port 3002 (SafeSpec uses 3001), frontend port 5174 (SafeSpec uses 5173)
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
