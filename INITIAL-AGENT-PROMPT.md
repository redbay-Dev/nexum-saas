# Nexum Rebuild — Initial Agent Prompt (Claude Code)

> Copy this prompt into your first Claude Code session to kick off the Nexum rebuild. It assumes the agent is working in the `/home/redbay/Nexum-SaaS` directory and has access to the `docs/` folder and the SafeSpec sister project at `../saas-project/`.

---

## The Prompt

```
You are beginning the build phase of the Nexum rebuild — a multi-tenant SaaS for Australian heavy vehicle transport and logistics. All documentation has been written and approved. Your job is to implement it.

## BEFORE YOU WRITE ANY CODE

1. Read `SESSION-LOG.md` — it has full context from the documentation phase
2. Read `docs/00-PROJECT-OVERVIEW.md` — understand what this system is
3. Read `docs/01-CORE-IDENTITY.md` — the tenant model is foundational
4. Read `docs/21-TECHNICAL-ARCHITECTURE.md` — your stack, infrastructure, and constraints
5. Read `docs/22-DEVELOPMENT-WORKFLOW.md` — conventions, testing, CI/CD, and the full CLAUDE.md for the new repo
6. Read `docs/DECISION-LOG.md` — every architectural decision with rationale (146 decisions)
7. Study the SafeSpec reference project at `../saas-project/` — mirror its monorepo structure, conventions, and patterns exactly

## REFERENCE PROJECT (SISTER PROJECT)

SafeSpec lives at `../saas-project/` (sibling directory on the same dev server). These two projects are built by the same team, share the same architecture, and integrate at runtime via APIs. Mirror:
- Its monorepo structure (pnpm workspaces + Turborepo)
- Its package layout (`packages/frontend`, `packages/backend`, `packages/shared`, `packages/pdf-templates`)
- Its `.claude/` directory structure (commands, skills, settings)
- Its coding conventions and patterns
- Its Drizzle ORM setup and migration patterns
- Its Fastify route structure and plugin organisation
- Its Better Auth configuration

DO NOT copy SafeSpec code. Study the patterns, then implement Nexum's own version.

## PHASE 1: SCAFFOLD THE MONOREPO

Create the Nexum monorepo from scratch with this structure:

```
nexum/
  packages/
    frontend/          # React + Vite + TypeScript + Tailwind CSS + shadcn/ui
    backend/           # Fastify + TypeScript
    shared/            # Shared Zod schemas, types, constants
    pdf-templates/     # Handlebars HTML/CSS templates
  .claude/
    commands/          # Slash commands (from doc 22: /checks, /continue, /audit, /create-handler, /create-component)
    skills/            # Agent skills (shadcn, drizzle, fastify, testing)
    settings.json      # Plugin configuration
  docs/                # Project documentation
  docker/              # Docker compose for dev services (reference shared services, don't duplicate)
  scripts/             # Dev scripts, migrations, seeding
  turbo.json           # Turborepo pipeline config
  pnpm-workspace.yaml  # Workspace definitions
  CLAUDE.md            # The CLAUDE.md from doc 22 (critical — this guides all future agent sessions)
  CHANGELOG.md         # Start with initial scaffold entry
  DECISION-LOG.md      # Copy from docs, continue adding
  .gitignore
  .env.example         # Template for .env.development (never commit actual .env)
  tsconfig.base.json   # Shared TypeScript config (strict: true, NO exceptions)
```

### For each package, set up:

**@nexum/shared** (build first — other packages depend on it):
- Zod 4 validation schemas (start with tenant, organisation, company, contact, address, region schemas). Note: Zod 4 syntax differs from v3 — use `z.email()` not `z.string().email()`, `z.interface()` for objects, etc.
- TypeScript type definitions derived from Zod (`z.infer<>` — never define types separately)
- Constants (permission keys, status enums for job lifecycle, invoice states, RCTI states)
- Utility functions (ABN validation, Australian phone formatting, date formatting)
- Path aliases configured (`@shared/`)

**@nexum/backend**:
- Fastify 5 server with TypeScript 5.9
- `fastify-type-provider-zod` v6 for type-safe route schemas (requires Zod 4)
- Drizzle ORM 0.45 configuration with schema-per-tenant middleware
- Better Auth 1.5 setup (self-hosted, sessions in PostgreSQL)
- BullMQ 5 queue configuration with Redis connection (ioredis 5)
- `@fastify/websocket` 11 plugin setup
- `@scalar/api-reference` for interactive API docs at `/api/docs` (replaces @fastify/swagger-ui)
- Route structure matching doc 21's API design (`/api/v1/auth/`, `/api/v1/jobs/`, etc.)
- Permission middleware (deny by default — every route must declare permissions)
- Tenant scoping middleware (sets schema search path from session)
- Health check endpoint (the only unauthenticated route besides auth)
- Error handling (consistent format: `{ error, code, details }`)
- Zod 4 validation on all routes (auto-400 on failure)
- Audit logging middleware (every write creates a log entry)
- Path aliases configured (`@backend/`)

**@nexum/frontend**:
- React 19 + Vite 8 + TypeScript 5.9
- Tailwind CSS 4 with `@tailwindcss/vite` plugin (CSS-first config — no `tailwind.config.js`, no PostCSS, no autoprefixer)
- shadcn/ui v4 (`npx shadcn@latest init` — copies components into codebase)
- `tw-animate-css` for animations (replaces `tailwindcss-animate` which is Tailwind v3 only)
- Zustand 5 for client state management
- TanStack Query 5 for server state
- React Router 7 for routing (unified package — `react-router`, not `react-router-dom`). Portal routes: `/portal/contractor/`, `/portal/customer/`
- WebSocket client for real-time updates
- Authentication integration (Better Auth 1.5 client)
- Path aliases configured (`@frontend/`)

**@nexum/pdf-templates**:
- Handlebars template structure
- Base layout with tenant branding injection points
- Build tooling (compile templates)

### Tooling:
- `turbo.json` (Turborepo 2.8) with pipeline: build, lint, type-check, test, test:unit, test:integration, test:e2e, dev
- ESLint 10 (flat config) with `@typescript-eslint/strict-type-checked` (typescript-eslint 8.57)
- Prettier 3.8
- Husky 9 pre-commit hooks running `pnpm lint && pnpm type-check && pnpm test`
- Vitest 4 configuration for unit and integration tests (compatible with Vite 8)
- Playwright 1.58 configuration for E2E tests

### .claude/ directory:
Create the slash commands from doc 22:
- `/checks` — Run all quality checks, update docs, commit, push
- `/continue` — Resume development with honest status assessment against all spec docs
- `/audit [file/area]` — Code review for type safety, permissions, tenant scoping, tests, conventions
- `/create-handler [name]` — Scaffold Fastify route with Zod validation, permissions, tenant scoping, audit logging, tests
- `/create-component [name]` — Scaffold React component with shadcn/ui patterns, TypeScript types, tests

Create skills:
- `shadcn/` — Mirror SafeSpec's shadcn skill
- `drizzle/` — Schema-per-tenant patterns, migration conventions, query building
- `fastify/` — Route patterns, plugin structure, hook lifecycle, auth/permission middleware
- `testing/` — Unit test (Vitest), integration test (API routes + test DB), E2E (Playwright) patterns

## PHASE 2: DATABASE FOUNDATION

After the scaffold is solid and `pnpm build` succeeds:

1. **Public schema** — `tenants` table, Better Auth tables (users, sessions, accounts), platform admin config, billing/subscription
2. **Tenant schema template** — The base schema every tenant gets:
   - `organisation` (tenant's business identity — ABN, logo, addresses, bank details)
   - `companies` (customers, contractors, suppliers with role flags)
   - `contacts` (linked to company and/or address)
   - `addresses` (with geolocation, regions, entry points, materials)
   - `regions`
   - `roles` and `permissions`
   - `audit_log`
3. **Tenant provisioning** — Serialised BullMQ job (not inline API) that creates schema, runs all migrations, seeds defaults. See doc 21 "Schema-Per-Tenant Migration Strategy" for the full pattern.
4. **Schema-per-tenant middleware** — Drizzle middleware that sets search path from session, AND filters `WHERE deleted_at IS NULL` for soft-delete transparency
5. **Migration runner** — A `migrate-all-tenants` BullMQ job that applies pending migrations to every active tenant schema on startup. Each tenant in its own transaction. Failed tenants logged and flagged for retry.

All tables follow the rules from CLAUDE.md:
- `id` (UUID), `created_at`, `updated_at`
- `deleted_at` for soft deletes
- Indexes on all foreign keys
- JSONB for flexible metadata where appropriate

## PHASE 3: AUTHENTICATION & CORE API

1. **Better Auth** — Email/password login, session management, 2FA (TOTP), cookie-based sessions
2. **User management** — Create user, assign to tenant, assign roles
3. **Permission system** — Role-based with per-user overrides, checked on every endpoint
4. **Tenant admin** — Basic settings, organisation profile

## AFTER PHASES 1-3 ARE SOLID

Then begin feature implementation. Priority order based on the "three pillars" (doc 00):

1. **Business Entities** (doc 02) — Companies, contacts, addresses, regions. This is the foundation everything references.
2. **Drivers & Employees** (doc 03) — Driver profiles, qualifications, employee records.
3. **Assets & Fleet** (doc 04) — Asset records, categories/subcategories, default pairings.
4. **Materials & Disposal** (doc 05) — Material catalog, disposal sites, four source tables.
5. **Job System** (doc 06) — Job creation, lifecycle, types, locations, requirements.
6. **Scheduling** (doc 07) — Resource allocation, recommendation engine, compliance gates.
7. **Dockets** (doc 08) — Daysheets, docket processing, charge creation.
8. **Pricing Engine** (doc 09) — Pricing lines, rate cards, markup rules, margin tracking.
9. **Invoicing & RCTI** (doc 10) — Invoice generation, RCTI workflow, credit management.
10. **Xero Integration** (doc 11) — OAuth, contact sync, invoice/bill sync, payment webhooks.

Each feature must ship with:
- Zod schemas in `@shared/`
- API routes with permission checks, tenant scoping, Zod validation, audit logging
- Unit tests for business logic
- Integration tests for API endpoints (happy path + error path minimum)
- Frontend components following shadcn/ui patterns

## CRITICAL RULES (FROM CLAUDE.md)

1. **TypeScript strict mode, NO `any`, NO `as` assertions, NO `@ts-ignore`** — This is rule #1. Fix the type, don't silence the error.
2. **Every API endpoint has permission checks** — CI will fail if missing.
3. **Every API endpoint is tenant-scoped** — Via middleware, not manual `WHERE` clauses.
4. **Finish what you start** — One fully working feature beats five scaffolded ones. Check every bullet in the spec doc.
5. **Never modify existing migrations** — Only add new ones.
6. **Soft deletes only** — `deleted_at` timestamp, never hard delete.
7. **Audit every write** — Every mutation creates an audit log entry.
8. **Australian standards** — DD/MM/YYYY in UI, AUD with $, E.164 phone, validated ABN.
9. **Commit convention** — `fix:` for 95% of commits, `feat:` only for genuinely new features.
10. **`pnpm lint && pnpm type-check && pnpm test` must pass** before any commit.

## ERROR HANDLING & SEED DATA

Doc 22 now includes detailed error handling patterns and seed data strategy. Read these sections carefully:

- **Error Handling & Degraded Mode Patterns** — Standard error response format, database transaction rules, external service failure modes (Xero, SafeSpec, AI, SMS, Maps), BullMQ job failure handling, and WebSocket disconnection recovery
- **Seed Data Strategy** — Two test tenants with specific data shapes that exercise real business scenarios. Use `pnpm db:seed` for development, `pnpm db:seed:test` for test suite.

These patterns must be implemented from day one, not retrofitted.

## DEV ENVIRONMENT

- Development PC: Ubuntu 24.04 LTS + VSCode + Claude Code
- Node.js: 24.14.0 LTS (already installed)
- pnpm: 10.32.1 (already installed)
- Dev Server: Linux machine (shared with SafeSpec at `../saas-project/`)
- Shared Docker services ALREADY RUNNING (do NOT duplicate):
  - PostgreSQL 15 on port 5432 — create a `nexum_dev` database
  - Redis 7.4 on port 6379 — use separate DB number or key prefix `nexum:` (requires auth password)
  - MinIO on port 9000 — create a `nexum` bucket
  - MailHog on port 1025/8025
- `.env.development` for connection strings (never commit)

## PACKAGE VERSIONS (verified compatible 2026-03-19)

All versions below have been cross-checked for peer dependency compatibility. Use these exact ranges:

**Frontend:**
- `react` / `react-dom`: ^19.2.4
- `vite`: ^8.0.1 with `@vitejs/plugin-react`
- `tailwindcss`: ^4.2.2 with `@tailwindcss/vite` (NO PostCSS, NO autoprefixer, NO tailwind.config.js)
- `shadcn`: v4.0.8 CLI (`npx shadcn@latest init`)
- `tw-animate-css`: latest (replaces tailwindcss-animate for TW v4)
- `zustand`: ^5.0.12
- `@tanstack/react-query`: ^5.91.0
- `react-router`: ^7.13.1 (unified — do NOT install react-router-dom separately)

**Backend:**
- `fastify`: ^5.8.2
- `fastify-type-provider-zod`: ^6.1.0 (requires Zod ≥4.1.5)
- `@fastify/websocket`: ^11.2.0
- `@fastify/cors`: ^11.2.0
- `@fastify/multipart`: ^9.4.0
- `@fastify/swagger`: ^9.7.0
- `@scalar/api-reference`: ^1.49.1
- `better-auth`: ^1.5.5
- `bullmq`: ^5.71.0
- `ioredis`: ^5.10.0
- `postgres`: ^3.4.8
- `drizzle-orm`: ^0.45.1 with `drizzle-kit`: ^0.31.10
- `drizzle-zod`: ^0.8.3
- `puppeteer`: ^24.39.1
- `handlebars`: ^4.7.8
- `nodemailer`: ^8.0.3
- `@aws-sdk/client-s3`: ^3.1009.0

**Shared:**
- `zod`: ^4.3.6
- `typescript`: ^5.9.3

**Tooling (devDependencies):**
- `turbo`: ^2.8.19
- `vitest`: ^4.1.0
- `@playwright/test`: ^1.58.2
- `eslint`: ^10.0.3
- `@typescript-eslint/eslint-plugin`: ^8.57.1
- `@typescript-eslint/parser`: ^8.57.1
- `prettier`: ^3.8.1
- `husky`: ^9.1.7
- `tsup`: ^8.4.0
- `tsx`: ^4.19.0

## START NOW

Begin with Phase 1. Scaffold the monorepo. Make `pnpm install`, `pnpm build`, `pnpm lint`, `pnpm type-check`, and `pnpm test` all pass with zero errors before moving to Phase 2.

Use `/checks` after completing each phase to verify everything is clean.
Use `/continue` at the start of each new session to assess progress honestly.

Read the docs. Follow the patterns. Build it right.
```

---

## Usage Notes

### How to use this prompt

1. Open VS Code with Claude Code in the target directory for the new Nexum repo (e.g., `/home/redbay/Nexum-SaaS`)
2. Paste the prompt above into the Claude Code chat
3. The agent will scaffold the monorepo, referencing the docs and SafeSpec (`../saas-project/`) for patterns
4. After Phase 1, verify the scaffold manually — check that the structure matches SafeSpec's patterns
5. Continue with Phases 2–3 in the same or subsequent sessions using `/continue`

### What to have ready

- The `docs/` folder accessible (the agent needs to read all 23 docs)
- The SafeSpec sister project accessible at `../saas-project/`
- The dev server running with shared Docker services (PostgreSQL, Redis, MinIO, MailHog)
- A fresh GitHub repo created for the Nexum project

### Session management

Each Claude Code session has limited context. Use:
- **`/continue`** at the start of every new session — it reads CHANGELOG.md and assesses progress against ALL spec docs
- **`/checks`** at the end of every session — it runs quality checks, updates docs, commits, and pushes
- **CHANGELOG.md** — the agent updates this after every task, listing what was built AND what's still missing
- **DECISION-LOG.md** — continues from the 146 existing decisions

### Expected session flow

- **Session 1:** Phase 1 scaffold — monorepo, packages, tooling, .claude/ commands and skills, CLAUDE.md
- **Session 2:** Phase 2 — Public schema, tenant schema template, provisioning, schema-per-tenant middleware
- **Session 3:** Phase 3 — Better Auth, user management, permission system, tenant admin
- **Sessions 4+:** Feature implementation in priority order (entities → drivers → assets → materials → jobs → scheduling → dockets → pricing → invoicing → Xero)

Each feature area is a multi-session effort. The `/continue` command ensures honest progress tracking.
