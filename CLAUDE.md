# CLAUDE.md — Nexum Project Guide for AI Agents

## Project Identity
- **Name**: Nexum
- **Owner**: Ryan Stagg (Redbay Development)
- **What**: Multi-tenant SaaS for Australian transport, earthmoving, civil construction, and logistics companies
- **Products**: Nexum (web app) + DriverX (React Native mobile app, separate repo)
- **Architecture**: Mirrors SafeSpec — same stack, same conventions, same tooling

## Tech Stack (verified compatible 2026-03-19)
- **Frontend**: React 19 + TypeScript 5.9 + Vite 8 + Tailwind CSS 4 + shadcn/ui (v4)
- **Backend**: Node.js 24 LTS + Fastify 5 + TypeScript 5.9
- **Database**: PostgreSQL 15 with schema-per-tenant multi-tenancy (Drizzle ORM 0.45)
- **Validation**: Zod 4 (shared frontend/backend, feeds OpenAPI generation via fastify-type-provider-zod v6)
- **PDF Engine**: Puppeteer 24 + Handlebars 4.7 on dedicated service
- **Job Queue**: BullMQ 5 (Redis 7-backed)
- **Auth**: Better Auth 1.5 (self-hosted, TypeScript-native)
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
    commands/          # Slash commands (/checks, /continue, /audit, /create-handler, /create-component)
    skills/            # Agent skills (shadcn, drizzle, fastify, testing)
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

## OpShield Platform
- **Path**: `/home/redbay/OpShield` (sibling directory: `../OpShield/`)
- **What**: Central platform layer — owns auth (Better Auth SSO), tenant provisioning, billing (Stripe), public website, platform admin
- **Relationship**: OpShield provisions tenants and manages subscriptions. Nexum delegates auth to OpShield. OpShield does NOT contain any business logic.
- **Architecture doc**: `docs/24-OPSHIELD-PLATFORM.md` (exists in all three repos)
- **Key rule**: Nexum works independently — it just needs an auth endpoint. OpShield is invisible to end users.
- **Ports**: OpShield API 3000, frontend 5170

## Sister Project: SafeSpec
- **Path**: `/home/redbay/saas-project` (sibling directory: `../saas-project/`)
- **What**: Compliance & WHS management SaaS (NHVAS, WHS, mass, fatigue, maintenance, defects, pre-starts)
- **Relationship**: SafeSpec owns all compliance. Nexum consumes compliance status via API. Both share the same architecture, and `@redbay/compliance-shared` package. Both delegate auth to OpShield.
- **Integration doc**: `docs/SAFESPEC-INTEGRATION-NOTE.md` (exists in both repos)
- **Key rule**: SafeSpec works independently of Nexum. The Nexum connection is optional.
- **Version differences**: Nexum uses newer versions (Zod 4, Tailwind 4, Vite 8, Vitest 4, ESLint 10). See DEC-147 through DEC-153 in DECISION-LOG.md.

## Critical Rules

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
2. Read `docs/DECISION-LOG.md` for recent decisions
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
4. Update `docs/DECISION-LOG.md` if decisions were made
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
2. Update `CHANGELOG.md` with session summary (what was built, decisions made, known issues, what's next, what's STILL MISSING)
3. Update `docs/DECISION-LOG.md` if any decisions were made
4. Check if any other docs are now stale and update them
5. Stage files, create conventional commit, push to GitHub
6. Print session summary with commit link

### `/continue` — Resume Development
Picks up where the last session left off with an honest status assessment:
1. Read `CHANGELOG.md` and `docs/DECISION-LOG.md` for recent activity
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
Route registration, plugin structure, hook lifecycle, schema validation with Zod 4, error handling, and authentication/permission middleware.

### `testing` — Test Patterns
How to write unit tests (Vitest 4), integration tests (API routes against test DB), and E2E tests (Playwright 1.58). Includes test database setup, seeding, and cleanup patterns.

## Plugins

Configured in `.claude/settings.json`:

- **frontend-design** — shadcn/ui component management and design guidance
- **context7** — Documentation lookup for libraries and frameworks
- **github** — GitHub operations (PRs, issues, code search)
- **playwright** — E2E test running and browser automation
- **claude-md-management** — CLAUDE.md maintenance and updates
- **skill-creator** — Create and manage agent skills
- **semgrep** — Static analysis for security and code quality
- **postman** — API testing and documentation
- **chrome-devtools-mcp** — Browser debugging

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
| `docs/23-UI-UX-DESIGN.md` | Navigation, layout, components, brand colours, interaction patterns |
| `docs/24-OPSHIELD-PLATFORM.md` | OpShield platform architecture |
| `docs/DECISION-LOG.md` | All architectural decisions |
