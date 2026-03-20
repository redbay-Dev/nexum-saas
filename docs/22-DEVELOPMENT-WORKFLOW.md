# 22 — Development Workflow

> Git workflow, testing strategy, CI/CD pipeline, and coding conventions — mirroring SafeSpec's development practices.

## Principles

1. **Mirror SafeSpec exactly** — same tooling, same conventions, same patterns. Developers (and AI agents) move between projects without relearning.
2. **Comprehensive testing from day one** — unit, integration, and E2E tests are not retrofit activities. They ship with every feature.
3. **Automated quality gates** — CI blocks merge on failure. No exceptions.
4. **Permission enforcement in CI** — every API handler must declare its permission check. The pipeline catches what humans and agents miss.
5. **Documentation as code** — conventions, decisions, and architecture live in the repo, not in someone's head.

## Git Workflow

### Branch Strategy

Mirrors SafeSpec:

- **`main`** — Production-ready. Protected. Only receives merges from `develop` via release process.
- **`develop`** — Integration branch. All feature branches merge here via squash merge.
- **`feature/{ticket-id}-{short-description}`** — New features. Branch from `develop`, merge back to `develop`.
- **`fix/{ticket-id}-{short-description}`** — Bug fixes. Branch from `develop`, merge back to `develop`.
- **`hotfix/{ticket-id}-{short-description}`** — Critical production fixes. Branch from `main`, merge to both `main` and `develop`.

### Commit Conventions

Conventional commits with scopes:

**Format:** `type(scope): description`

**Types:**
- `feat` — Brand new features that didn't exist before (bumps minor version)
- `fix` — Bug fixes, UI improvements, refactoring, performance improvements, TypeScript fixes (bumps patch version)
- `chore` — Dependency updates, build/config changes, release commits
- `docs` — Documentation changes
- `test` — Adding or updating tests
- `style` — Code style changes (formatting, not CSS)
- `perf` — Performance-specific optimisations

**Scopes:** `frontend`, `backend`, `shared`, `pdf-templates`, `db`, `infra`, `docs`

**Default to `fix:`** — 95% of commits are fixes or improvements to existing code. Use `feat:` only for genuinely new features. When unsure, use `fix:`.

**Examples:**
- `fix(backend): resolve tenant schema isolation in bulk operations`
- `feat(frontend): add custom report builder with drag-and-drop`
- `fix(shared): update Zod schemas for pricing engine validation`
- `chore(infra): upgrade Node.js to latest LTS`

### Merge Strategy

- Squash merge into `develop` — clean linear history
- PR title becomes the squash commit message
- All commits in the feature branch are collapsed into one commit on develop
- Branch deleted after merge

### Branch Protection Rules

**`main`:**
- Require PR with at least 1 approval
- Require all CI checks to pass
- No direct pushes
- No force pushes

**`develop`:**
- Require all CI checks to pass
- No force pushes
- Direct pushes allowed for release commits only

## Coding Conventions

### Language & Style

- **TypeScript everywhere** — strict mode, no `any` without documented justification
- **Files:** kebab-case (`job-pricing-engine.ts`)
- **Components:** PascalCase (`JobPricingEngine.tsx`)
- **Functions:** camelCase (`calculateJobPricing()`)
- **Database tables/columns:** snake_case (`business_companies`, `created_at`)
- **API endpoints:** kebab-case (`/api/v1/job-pricing`)
- **Constants:** UPPER_SNAKE_CASE (`MAX_RETRY_ATTEMPTS`)
- **Imports:** Path aliases `@frontend/`, `@backend/`, `@shared/`

### Database Rules

- All tables must have: `id` (UUID), `created_at`, `updated_at`
- Soft deletes only — `deleted_at` timestamp column, never hard delete user data. (Note: SafeSpec uses a `status` column for soft deletes — Nexum uses `deleted_at` instead. Both are valid patterns; the key is consistency within each project. Nexum queries filter with `WHERE deleted_at IS NULL`, handled by Drizzle middleware alongside tenant scoping.)
- Every write operation must create an audit log entry
- All routes must have Zod schema validation and be tenant-scoped
- Indexes on all foreign keys and commonly queried fields
- JSONB for flexible metadata where appropriate
- Never modify existing migrations — only add new ones

### API Rules

- Every endpoint has Zod input validation (auto-400 on failure)
- Every endpoint has permission checks (enforced by CI — see below)
- Every endpoint is tenant-scoped via middleware
- Consistent error format: `{ error: string, code: string, details?: object }`
- Cursor-based pagination for all list endpoints
- Rate limiting via Redis middleware

### Frontend Rules

- shadcn/ui v4 components copied into codebase — fully owned, no import dependency. Use `npx shadcn@latest` CLI.
- Tailwind CSS v4 with `@tailwindcss/vite` plugin — CSS-first config, no `tailwind.config.js`, no PostCSS/autoprefixer
- `tw-animate-css` for animations (replaces `tailwindcss-animate` which is Tailwind v3 only)
- Zustand 5 for client state management
- TanStack Query 5 for server state
- React Router 7 (unified package — `react-router`, not `react-router-dom`)
- All forms use Zod 4 validation schemas from `@shared/`
- Responsive design — works on desktop and tablet
- Accessibility: semantic HTML, ARIA labels, keyboard navigation

### Australian-Specific Standards

Following SafeSpec conventions:
- **Dates:** DD/MM/YYYY in UI, ISO 8601 in API/database
- **Currency:** AUD with `$` prefix and 2 decimal places
- **Phone:** E.164 storage (+61...), display with spaces (04XX XXX XXX)
- **ABN:** 11 digits, validated with check digit algorithm
- **States:** QLD, NSW, VIC, SA, WA, TAS, NT, ACT
- **Timezone:** AEST/AEDT default, configurable per tenant
- **GST:** 10% default, configurable (dynamic tax rates from Xero)

## Testing Strategy

### Comprehensive from Day One

Every feature ships with tests. No exceptions. Test coverage is not a phase — it's part of "done."

### Test Layers

**Unit Tests (Vitest 4)**
- Business logic functions (pricing calculations, margin checks, permission evaluations, ABN validation)
- Zod schema validation (shared schemas tested once, used everywhere)
- Utility functions and helpers
- State management (Zustand stores)
- Target: all pure functions and business logic

**Integration Tests (Vitest 4 + Supertest or similar)**
- API route handlers end-to-end (request → validation → handler → database → response)
- Test database with schema-per-tenant isolation
- Authentication and permission checks
- Multi-tenant isolation (verify tenant A cannot access tenant B data)
- Xero webhook handling
- BullMQ job processing
- Target: every API endpoint has at least one happy-path and one error-path test

**End-to-End Tests (Playwright 1.58)**
- Critical user workflows: job creation, docket processing, invoice generation, RCTI approval
- Portal workflows: contractor login, document upload, approval flow
- Authentication flows: login, 2FA, session management
- Scheduling: drag-and-drop allocation, conflict detection
- Permission enforcement: verify UI elements hidden/shown based on role
- Target: all critical business workflows

### Test Database

- Dedicated test PostgreSQL database (or schema) on the shared dev server
- Seeded with realistic test data (test tenant, test users, test entities)
- Reset between test suites (not between individual tests — too slow)
- Migrations run automatically before test suite

### Seed Data Strategy

The test database must be seeded with data that exercises real business scenarios, not trivial placeholder data.

**Tenants:**
- **Tenant A ("Farrell Transport")** — Full-featured tenant with all modules enabled. The primary test tenant.
- **Tenant B ("Smith Haulage")** — Minimal tenant with only core modules. Used for multi-tenant isolation tests and to verify Nexum works without optional modules.

**Per tenant (Tenant A), seed:**
- 3 customers — one with rate card, one with credit hold, one standard
- 2 contractors — one fully onboarded with drivers and assets, one mid-onboarding with incomplete docs
- 1 supplier — with materials at 2 addresses
- 1 disposal site — dual mode (accepts waste + supplies recycled product)
- 5 drivers — one with expiring licence, one non-compliant (for gate testing), three compliant
- 8 assets — mix of trucks, trailers, and equipment across categories and subcategories. One with overdue service, one with open defect.
- 10 materials — across different categories, with pricing behaviours covering all 5 types
- Jobs in every lifecycle state — draft, quoted, confirmed, in progress, completed, invoiced, cancelled
- Daysheets at various processing stages — unprocessed, reviewed, approved, with and without overages
- Invoices at various states — draft, sent, partially paid, paid, overdue
- RCTIs at various states — pending, approved, sent
- Users with different roles — owner, admin, dispatcher, finance, read-only

**Per tenant (Tenant B), seed:**
- 1 customer, 0 contractors, 0 suppliers
- 2 drivers, 3 assets
- 3 jobs (one completed, one in progress, one draft)
- No invoicing data (module not enabled)

**Seed data commands:**
```bash
pnpm db:seed          # Full seed for development
pnpm db:seed:test     # Minimal seed for test suite (faster, reset between suites)
```

### Test Conventions

- Test files co-located with source: `pricing-engine.ts` → `pricing-engine.test.ts`
- E2E tests in dedicated `e2e/` directory
- Descriptive test names: `it('should reject invoice generation when margin is below threshold')`
- No mocking of database — use the test database for integration tests
- External services (Xero, Google Maps, AI providers, SMS) mocked at the HTTP boundary
- Test utilities in `packages/shared/test-utils/`

### Coverage Requirements

- No hard coverage percentage target (chasing 100% leads to bad tests)
- Rule: if a function handles money, permissions, or compliance — it must have tests
- PR reviews check for missing test scenarios, not coverage numbers

## CI/CD Pipeline

### GitHub Actions

All checks run on every pull request targeting `develop` or `main`.

### Pipeline Stages

**Stage 1 — Lint & Type Check (parallel)**
- `pnpm lint` — ESLint across all packages
- `pnpm type-check` — TypeScript strict mode compilation
- Fast feedback — fails in < 60 seconds

**Stage 2 — Unit Tests**
- `pnpm test:unit` — Vitest unit tests across all packages
- Runs after lint/type-check pass
- Parallel execution across packages via Turborepo

**Stage 3 — Integration Tests**
- `pnpm test:integration` — API route tests against test database
- PostgreSQL and Redis services in GitHub Actions (service containers)
- Runs migrations, seeds test data, executes tests
- Tenant isolation tests included

**Stage 4 — Build Check**
- `pnpm build` — Full production build of all packages
- Verifies no build errors, all imports resolve, all assets compile
- Frontend bundle size check (warn if significantly larger than previous)

**Stage 5 — Permission Audit**
- Custom script scans all API route handlers
- Verifies every handler calls a permission check function
- Fails if any endpoint is unprotected (doc 18 enforcement)
- Exceptions must be explicitly listed in a config file (e.g. health check, public auth endpoints)
- This is the CI enforcement of DEC-128 (permission enforcement in development)

**Stage 6 — E2E Tests (on develop merges only)**
- Playwright tests against a built application
- Runs on merge to develop, not on every PR (too slow)
- Nightly scheduled run for comprehensive E2E coverage

### Pipeline Rules

- All stages 1–5 must pass before PR can merge
- No manual override — if CI fails, fix the code
- Cache: pnpm store cached between runs, Turborepo remote cache for build artifacts
- Concurrency: cancel in-progress runs when a new commit is pushed to the same PR

### Deployment Pipeline

**develop → Staging:**
- Auto-deploy to staging environment on DO App Platform on merge to develop
- Staging uses separate database and Redis instances
- Staging accessible for testing before production release

**main → Production:**
- Manual trigger (not auto-deploy)
- Tagged release with semantic version
- Database migrations run automatically on deploy
- Health check verification after deploy
- Rollback plan: revert to previous App Platform deployment

## Development Environment

### Setup (Mirrors SafeSpec)

- **Development PC:** Linux + VSCode + Claude Code
- **Dev Server:** Linux machine (shared with SafeSpec at `../saas-project/`)
- **Shared Docker services** (already running, reuse for Nexum):
  - PostgreSQL 15 on port 5432 — create Nexum database
  - Redis 7 on port 6379 — use separate DB number or key prefix
  - MinIO on port 9000 (S3-compatible for local dev) — create Nexum bucket
  - MailHog on port 1025/8025 — email testing
  - Traefik reverse proxy
- Do NOT spin up duplicate Postgres/Redis/MinIO containers — use the shared ones
- Environment variables in `.env.development` (never commit)

### Dev Commands

```bash
pnpm dev              # Start all packages in dev mode (Turborepo)
pnpm build            # Production build
pnpm lint             # ESLint across all packages
pnpm type-check       # TypeScript strict compilation
pnpm test             # All tests (unit + integration)
pnpm test:unit        # Unit tests only
pnpm test:integration # Integration tests only
pnpm test:e2e         # E2E tests (Playwright)
pnpm db:migrate       # Run pending migrations
pnpm db:seed          # Seed development data
pnpm db:reset         # Reset database and re-seed
```

### Package Manager

**pnpm** — same as SafeSpec. Not npm, not yarn. pnpm workspaces for the monorepo.

## Pre-Commit Checks

Before every commit, developers (and agents) must run:

```bash
pnpm lint && pnpm type-check && pnpm test
```

This can be enforced via Husky pre-commit hooks, but the CI pipeline is the ultimate gate.

## Code Review Standards

### PR Requirements

- Clear title following conventional commit format
- Description explaining what changed and why
- Link to relevant documentation or decision log entry
- Tests included for new functionality
- No unrelated changes bundled into the PR

### Review Checklist

- Does every new API endpoint have permission checks?
- Does every new API endpoint have Zod validation?
- Is the endpoint tenant-scoped?
- Are there tests for the happy path and at least one error path?
- Are Australian formatting standards followed (dates, currency, phone)?
- Is audit logging in place for write operations?
- Is the code consistent with existing patterns in the codebase?
- Are shared types/schemas in `@shared/`, not duplicated?

## Error Handling & Degraded Mode Patterns

### Standard Error Handling

All errors follow a consistent pattern across the application:

**API Error Response Format:**
```json
{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE", "details": {} }
```

**Error Categories:**
- **Validation errors** — Zod schema failures. Return 400 with field-level details. Frontend displays inline.
- **Authentication errors** — Invalid/expired session. Return 401. Frontend redirects to login.
- **Permission errors** — Valid session but insufficient permissions. Return 403. Frontend shows "access denied" with the permission required.
- **Not found** — Entity doesn't exist or is in another tenant's schema. Return 404. Never leak whether the entity exists in another tenant.
- **Conflict** — Concurrent modification (e.g. two users editing same job). Return 409. Frontend prompts to reload.
- **Server errors** — Unexpected failures. Return 500. Log full stack trace server-side. Return generic message to client.

### Database Transaction Failures

All write operations that touch multiple tables must be wrapped in a database transaction. If any step fails, the entire transaction rolls back — no partial state.

**Example: Daysheet processing creates charge lines + updates pricing + creates audit entries. If the audit entry insert fails, all charge lines and pricing updates roll back.**

For BullMQ jobs that modify data, the job itself should be idempotent — if it runs twice due to a retry, the result is the same as running once. Use upserts or check-before-write patterns.

### External Service Failures

Each external integration has a defined degraded mode:

**Xero unreachable:**
- Invoice/bill push fails → job stays in BullMQ with exponential backoff (max 6 retries over ~1 hour)
- After max retries → job moved to failed queue, notification sent to tenant admin
- Xero status indicator in UI shows "disconnected" with last successful sync timestamp
- All local operations continue unaffected — invoices are generated and stored, just not synced

**SafeSpec unreachable:**
- Compliance status cache continues serving last known data with "stale" indicator and timestamp
- Scheduler still loads — compliance badges show grey "stale" icon, compliance gates use last known status with a visual warning banner: "Compliance data is stale — last updated {time}"
- Pre-start submissions queued locally for forwarding when connection restores
- Operational data sharing queued with retry

**AI provider unreachable:**
- All AI features degrade to manual — job creation shows standard form, docket OCR shows manual entry, job review unavailable
- No error shown unless user explicitly tries to use an AI feature
- Automatic fallback to secondary provider if configured (doc 16)

**SMS provider unreachable:**
- Messages queued with retry logic
- After max retries → notification to admin, SMS marked as failed
- Critical operational messages (allocation notifications) can fall back to push notification if driver has DriverX

**Google Maps unreachable:**
- Map views show placeholder with "Map unavailable" message
- Geocoding requests queued for retry
- Address entry still works (manual coordinates or postcode-based approximation)

### BullMQ Job Failure Handling

All background jobs follow the same failure pattern:

- **Retries:** 3 attempts with exponential backoff (1s, 4s, 16s) for transient failures
- **Dead letter queue:** After max retries, job moves to a failed queue per job type
- **Monitoring:** Bull Board dashboard shows failed jobs grouped by type and error
- **Alerting:** Failed job count exceeding threshold triggers admin notification
- **Resolution:** Failed jobs can be manually retried or dismissed from admin UI
- **Cleanup:** Successfully completed jobs removed after 7 days, failed jobs kept for 30 days

### WebSocket Disconnection

- Client auto-reconnects with exponential backoff: 1s, 2s, 4s, 8s, max 30s
- During disconnection, a subtle "reconnecting..." indicator appears in the UI
- On reconnection, client requests a state diff (what changed since last connected timestamp)
- If disconnected for more than 5 minutes, client does a full refresh of active data on reconnect

---

## Documentation Maintenance

### Living Documents

- `CHANGELOG.md` — Updated with every feature and fix
- `DECISION-LOG.md` — Updated when architectural or product decisions are made
- `docs/` folder — Updated when system behaviour changes

### After Every Task

1. Run: `pnpm lint && pnpm type-check && pnpm test`
2. Update `CHANGELOG.md`
3. Update `DECISION-LOG.md` if decisions were made
4. Commit with conventional format

---

## CLAUDE.md — Agent Guide

The following section is the `CLAUDE.md` file that lives at the root of the Nexum monorepo. It provides AI coding agents with the essential context they need to work on the project. This is included here as part of the development workflow documentation — when the repo is initialised, this content becomes the root `CLAUDE.md`.

---

````markdown
# CLAUDE.md — Nexum Project Guide for AI Agents

## Project Identity
- **Name**: Nexum
- **Owner**: Ryan Stagg (Redbay Development)
- **What**: Multi-tenant SaaS for Australian transport, earthmoving, civil construction, and logistics companies
- **Products**: Nexum (web app) + DriverX (React Native mobile app, separate repo)
- **Architecture**: Mirrors SafeSpec — same stack, same conventions, same tooling

## Tech Stack (verified compatible as of 2026-03-19)
- **Frontend**: React 19 + TypeScript 5.9 + Vite 8 + Tailwind CSS 4 + shadcn/ui (v4)
- **Backend**: Node.js 24 LTS + Fastify 5 + TypeScript 5.9
- **Database**: PostgreSQL 15 with schema-per-tenant multi-tenancy (Drizzle ORM 0.45)
- **Validation**: Zod 4 (shared frontend/backend, feeds OpenAPI generation via fastify-type-provider-zod v6)
- **PDF Engine**: Puppeteer 24 + Handlebars 4.7 on dedicated service
- **Job Queue**: BullMQ 5 (Redis 7-backed)
- **Auth**: Delegated to OpShield (JWT/JWKS via `jose` 6 — no local auth instance)
- **Real-time**: WebSocket (@fastify/websocket 11) + Redis pub/sub
- **Monorepo**: pnpm 10 workspaces + Turborepo 2.8
- **Hosting**: DigitalOcean exclusively (Sydney region, Australian data residency)
- **CI/CD**: GitHub Actions
- **Testing**: Vitest 4 (unit/integration) + Playwright 1.58 (E2E)
- **Linting**: ESLint 10 + typescript-eslint 8.57 + Prettier 3.8
- **State Management**: Zustand 5 (client) + TanStack Query 5 (server)
- **Routing**: React Router 7 (unified — no separate react-router-dom)
- **API Docs**: @scalar/api-reference 1.49

## Project Structure
```
nexum/
  packages/
    frontend/          # React + Vite + TypeScript
    backend/           # Fastify + TypeScript
    shared/            # Shared Zod schemas, types, constants
    pdf-templates/     # Handlebars HTML/CSS templates
  .claude/
    commands/          # Slash commands (see below)
    skills/            # Agent skills (see below)
    settings.json      # Plugin configuration
  docs/                # All project documentation (numbered 00-22)
  docker/              # Docker compose for dev services
  scripts/             # Dev scripts, migrations, seeding
  turbo.json           # Turborepo pipeline config
  pnpm-workspace.yaml  # Workspace definitions
```

## Dev Environment
- **Development PC**: Ubuntu 24.04 LTS + VSCode + Claude Code
- **Runtime**: Node.js 24.14.0 LTS, pnpm 10.32.1
- **Dev Server**: Linux machine (shared with SafeSpec at `../saas-project/`)
- **Shared Docker services** (already running):
  - PostgreSQL 15 on port 5432 — create Nexum database
  - Redis 7.4 on port 6379 — separate DB number or key prefix from SafeSpec (requires auth)
  - MinIO on port 9000 — create Nexum bucket
  - MailHog on port 1025/8025 — email testing
  - Traefik reverse proxy
- Do NOT spin up duplicate containers — use the shared ones
- Environment variables in `.env.development` (never commit)
- Package manager: **pnpm 10** (not npm, not yarn)
- Run dev: `pnpm dev` | Build: `pnpm build` | Lint: `pnpm lint` | Test: `pnpm test`

## 🚨 Critical Rules

### TYPESCRIPT TYPE SAFETY (NEVER VIOLATE)
This is the single most important development rule. Agents that bypass type safety will produce code that is rejected.

- **`strict: true` in tsconfig.json** — this is non-negotiable and must never be weakened
- **NEVER use `any`** — not as a type, not as a cast, not as a generic parameter, not "temporarily"
- **NEVER use `as` type assertions** to silence errors — fix the actual type instead
- **NEVER use `@ts-ignore` or `@ts-expect-error`** — these hide real bugs
- **NEVER use `!` non-null assertions** — handle the null case properly
- **NEVER use `// eslint-disable`** to bypass type-related lint rules
- **NEVER leave implicit `any`** — every function parameter, return type, and variable must have an explicit or correctly inferred type
- **Every function must have explicit return types** — do not rely on inference for exported functions
- **Generic types must be constrained** — `<T extends SomeType>` not `<T>`
- **Use `unknown` instead of `any`** for truly unknown values, then narrow with type guards
- **Use discriminated unions** for state management — not optional fields and null checks
- **Zod schemas in `@shared/` are the single source of truth** — derive TypeScript types from Zod with `z.infer<>`, never define types separately
- **If `pnpm type-check` fails, the code is not done** — fix ALL type errors before committing

**Enforcement:** CI runs `pnpm type-check` with `strict: true`. PRs with type errors cannot merge. The ESLint config includes `@typescript-eslint/strict-type-checked` rules. There are zero exceptions.

**If you are tempted to use `any` or `as`:** Stop. Ask yourself what the actual type should be. Define it properly. If you genuinely don't know the shape, use `unknown` and narrow it. If it's from an external library, create a proper type declaration file.

### FINISH WHAT YOU START
- Do NOT implement thin CRUD slices and call them done
- Check every bullet point in the spec doc for the feature you're building
- Depth over breadth — one fully working feature beats five scaffolded ones
- Changelog honesty — list what's STILL MISSING, not just what was built
- If you run out of context/time, clearly document exactly what remains unfinished

### Before Starting Any Task
1. Read the relevant doc(s) from `docs/` (numbered 00-22)
2. Read `DECISION-LOG.md` for recent decisions
3. Read `CHANGELOG.md` for recent changes
4. Check the FULL spec for the feature — read every bullet point

### Permission Enforcement (CRITICAL)
- EVERY API handler MUST call a permission check function
- CI will fail if any endpoint is unprotected
- Exceptions explicitly listed in permission config (health check, public auth only)
- When building a new handler: add permission check FIRST, then implement logic

### Code Conventions
- **TypeScript everywhere** — strict mode (see type safety rules above)
- **Files**: kebab-case | **Components**: PascalCase | **Functions**: camelCase
- **DB tables/columns**: snake_case | **API endpoints**: kebab-case
- **Constants**: UPPER_SNAKE_CASE
- **Imports**: Path aliases `@frontend/`, `@backend/`, `@shared/`
- All tables: `id` (UUID), `created_at`, `updated_at`
- Soft deletes only (`deleted_at` timestamp, never hard delete)
- Every write operation creates an audit log entry
- All routes have Zod validation and are tenant-scoped
- Never modify existing migrations — only add new ones

### Multi-Tenancy
- Schema-per-tenant in PostgreSQL (`tenant_{uuid}`)
- Every query scoped to tenant schema via Drizzle ORM middleware
- Cross-tenant access must be architecturally impossible
- `public` schema holds: tenant registry, auth, billing, system config

### Australian-Specific
- Dates: DD/MM/YYYY in UI, ISO 8601 in API/database
- Currency: AUD with `$` prefix and 2 decimal places
- Phone: E.164 storage (+61...), display with spaces (04XX XXX XXX)
- ABN: 11 digits, validated with check digit algorithm
- States: QLD, NSW, VIC, SA, WA, TAS, NT, ACT
- Timezone: AEST/AEDT default, configurable per tenant

### Security
- Never log sensitive data (passwords, API keys, health information)
- Never store secrets in code — use environment variables
- Health information is sensitive under Privacy Act — handle accordingly
- All file uploads validated (type, size) and scanned

### Testing
- Every feature ships with tests — unit, integration, and E2E where applicable
- Business logic (pricing, permissions, compliance) MUST have tests
- No mocking the database — use test database
- External services (Xero, Maps, AI, SMS) mocked at HTTP boundary

### After Completing Any Task
1. Run: `pnpm lint && pnpm type-check && pnpm test`
2. ALL checks must pass — zero type errors, zero lint errors, zero test failures
3. Update `CHANGELOG.md`
4. Update `DECISION-LOG.md` if decisions were made
5. Commit with conventional format: `type(scope): description`
   - Default to `fix:` for 95% of commits
   - Use `feat:` only for brand new features
   - Scopes: frontend, backend, shared, pdf-templates, db, infra, docs

### Git Workflow
- `main` = production-ready (protected)
- `develop` = integration branch
- Feature branches: `feature/{ticket-id}-{short-description}`
- Fix branches: `fix/{ticket-id}-{short-description}`
- Squash merge into develop

## Slash Commands

These live in `.claude/commands/` and mirror SafeSpec's workflow.

### `/checks` — End-of-Session Checks
Runs all quality checks, updates documentation, commits, and pushes:
1. Run `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build` — report all results
2. Update `CHANGELOG.md` with session summary (what was built, decisions made, known issues, what's next)
3. Update `DECISION-LOG.md` if any decisions were made
4. Check if any other docs are now stale and update them
5. Stage files, create conventional commit, push to GitHub
6. Print session summary with commit link

### `/continue` — Resume Development
Picks up where the last session left off with an honest status assessment:
1. Read `CHANGELOG.md` and `DECISION-LOG.md` for recent activity
2. Check `git log` and `git status` for uncommitted work
3. Assess FULL project completion — compare code against ALL spec docs (00-22), checking every feature group
4. For each area, honestly assess: not started / scaffolded / partially complete / complete
5. Identify half-built features missing business logic, workflows, validation, or integration
6. Report to user with overall completion, half-built features, and recommended next priority
7. Default suggestion: FINISH incomplete features before starting new ones

### `/audit [file/area]` — Code Review
Reviews code for type safety, permission checks, tenant scoping, test coverage, and convention compliance.

### `/create-handler [name]` — Scaffold API Handler
Creates a new Fastify route handler with: Zod validation, permission check, tenant scoping, audit logging, error handling, and a test file. Everything wired up correctly from the start.

### `/create-component [name]` — Scaffold React Component
Creates a new component following shadcn/ui patterns, with proper TypeScript types, and a test file.

## Skills

Skills live in `.claude/skills/` and provide domain-specific guidance.

### `shadcn` — shadcn/ui Component Guide
Mirrors SafeSpec's shadcn skill. Provides correct component usage, form patterns, styling rules, icon handling, and CLI workflow. Ensures agents use shadcn/ui correctly instead of guessing.

### `drizzle` — Drizzle ORM Patterns
Schema-per-tenant patterns, migration conventions, query building, relation definitions, and tenant isolation middleware.

### `fastify` — Fastify Route Patterns
Route registration, plugin structure, hook lifecycle, schema validation, error handling, and authentication/permission middleware.

### `testing` — Test Patterns
How to write unit tests (Vitest), integration tests (API routes against test DB), and E2E tests (Playwright). Includes test database setup, seeding, and cleanup patterns.

## Plugins

Configured in `.claude/settings.json` — mirrors SafeSpec's plugin set plus Nexum-specific additions:

- **frontend-design** — shadcn/ui component management and design guidance
- **context7** — Documentation lookup for libraries and frameworks
- **github** — GitHub operations (PRs, issues, code search)
- **playwright** — E2E test running and browser automation
- **claude-md-management** — CLAUDE.md maintenance and updates
- **skill-creator** — Create and manage agent skills
- **semgrep** — Static analysis for security and code quality
- **postman** — API testing and documentation

## Key Documentation
| Doc | When to Read |
|-----|-------------|
| `docs/00-PROJECT-OVERVIEW.md` | Starting any work |
| `docs/01-CORE-IDENTITY.md` | Multi-tenancy, company model |
| `docs/02-BUSINESS-ENTITIES.md` | Customers, contractors, suppliers |
| `docs/06-JOB-SYSTEM.md` | Job lifecycle and workflow |
| `docs/08-DOCKETS.md` | Daysheet and docket processing |
| `docs/09-PRICING-ENGINE.md` | Pricing, rates, margins |
| `docs/10-INVOICING-RCTI.md` | Invoice and RCTI generation |
| `docs/11-XERO-INTEGRATION.md` | Xero sync |
| `docs/12-COMPLIANCE-SAFETY.md` | SafeSpec integration |
| `docs/14-PORTAL.md` | Contractor/customer portal |
| `docs/15-DOCUMENTS.md` | File management and DO Spaces |
| `docs/16-AI-AUTOMATION.md` | AI features and workflow engine |
| `docs/18-ADMINISTRATION.md` | Permissions, roles, audit |
| `docs/21-TECHNICAL-ARCHITECTURE.md` | Infrastructure, stack, API design |
| `docs/22-DEVELOPMENT-WORKFLOW.md` | Conventions, testing, CI/CD |
| `DECISION-LOG.md` | All architectural decisions |
````
