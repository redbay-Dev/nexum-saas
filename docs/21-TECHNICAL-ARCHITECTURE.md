# 21 — Technical Architecture

> Stack, infrastructure, authentication, multi-tenancy, API design, and deployment — mirroring SafeSpec's architecture on DigitalOcean.

## Principles

1. **Single cloud provider (DigitalOcean)** — simplicity over multi-cloud. All infrastructure in DO Sydney region for Australian data residency.
2. **TypeScript everywhere** — frontend, backend, ORM, validation, shared schemas.
3. **Schema-per-tenant multi-tenancy** — structural isolation, not just access control.
4. **Async by default** — all heavy operations (PDF, email, SMS, AI, Xero sync) via BullMQ job queue.
5. **API-first** — the REST API is a core product surface, not an afterthought. DriverX, the portal, and future integrations all consume it.
6. **Mirror SafeSpec patterns** — same stack, same conventions, same tooling. Developers move between projects without relearning.

## Application Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | React 19 + TypeScript 5.9 + Vite 8 + Tailwind CSS 4 + shadcn/ui (v4) | React for data-heavy operational dashboards. shadcn/ui provides production-quality components copied into the codebase — fully owned, no import dependency. Tailwind v4 uses CSS-first config with `@tailwindcss/vite` plugin — no PostCSS or autoprefixer needed. |
| **Backend API** | Node.js 24 LTS + Fastify 5 + TypeScript 5.9 | Fastify is faster than Express with lower overhead. Full TypeScript. Schema validation via Zod at all boundaries. `fastify-type-provider-zod` v6 for type-safe route schemas. |
| **Database ORM** | Drizzle ORM 0.45 | TypeScript-native, lightweight, excellent PostgreSQL support, schema-per-tenant compatible. `drizzle-zod` for schema↔Zod integration. |
| **Validation** | Zod 4 | Shared frontend/backend validation schemas. Feeds into OpenAPI generation via `fastify-type-provider-zod` v6. Note: SafeSpec currently uses Zod 3 — the future `@redbay/compliance-shared` package should be built on Zod 4. |
| **PDF Engine** | Puppeteer 24 + Handlebars 4.7 | Headless Chrome renders HTML/CSS templates to pixel-perfect PDF. Templates use Handlebars variables resolved from database. Async via BullMQ. |
| **Job Queue** | BullMQ 5 (Redis-backed) | All async work: PDF generation, SMS, email, push notifications, AI requests, Xero sync, compliance checks, report generation, billing runs, system maintenance. Persistent, retryable, monitorable via Bull Board. |
| **API Documentation** | OpenAPI 3.0 + Scalar (`@scalar/api-reference` 1.49) | Route schemas (Zod) auto-generate OpenAPI spec. Interactive docs at `/api/docs`. |
| **Authentication** | OpShield (JWT/JWKS via `jose` 6) | Auth delegated to OpShield platform. Nexum validates JWTs locally against OpShield's JWKS endpoint. No local auth tables — user identity comes from OpShield. All data stays in Australian infrastructure (OpShield is self-hosted). |
| **Real-time** | WebSocket (via `@fastify/websocket` 11) + Redis pub/sub | WebSocket for browser push. Redis pub/sub for scaling across multiple server instances. |

## Monorepo Structure

pnpm 10 workspaces + Turborepo 2.8 — same as SafeSpec.

```
nexum/
  packages/
    frontend/          # React + Vite + TypeScript
    backend/           # Fastify + TypeScript
    shared/            # Shared Zod schemas, types, constants
    pdf-templates/     # Handlebars HTML/CSS templates for invoices, RCTIs, quotes, statements, reports
  docs/                # All project documentation (numbered for reading order)
  docker/              # Docker compose for dev services
  scripts/             # Dev scripts, migrations, seeding
  turbo.json           # Turborepo pipeline config
  pnpm-workspace.yaml  # Workspace definitions
```

### Package Responsibilities

**`@nexum/frontend`**
- React 19 application with routing (React Router 7), state management (Zustand 5), server state (TanStack Query 5), and UI components
- Portal routes (`/portal/contractor/`, `/portal/customer/`)
- Platform admin routes (separate route set)
- Google Maps integration
- WebSocket client for real-time updates

**`@nexum/backend`**
- Fastify server with route handlers
- Drizzle ORM database layer
- BullMQ job workers
- WebSocket server
- Xero integration service
- AI service layer (provider-flexible)
- File upload handling (S3/Spaces)

**`@nexum/shared`**
- Zod validation schemas (shared between frontend and backend)
- TypeScript type definitions
- Constants (permission keys, status enums, etc.)
- Utility functions used by both packages

**`@nexum/pdf-templates`**
- Handlebars HTML/CSS templates for each document type
- Invoice, RCTI, quote, statement, report templates
- Tenant branding injection points
- Template preview tooling

### Shared Package for DriverX

A published npm package (`@nexum/driver-api-types` or similar) containing:
- API request/response types for DriverX endpoints
- Shared validation schemas for driver-submitted data
- Status enums and constants
- Consumed by both the backend and the DriverX React Native repo

## Infrastructure — DigitalOcean Exclusively

All services deployed in **Sydney region (SGP1 or SYD1)** for Australian data residency.

| Service | DO Product | Purpose |
|---------|-----------|---------|
| **Application** | DO App Platform | Node.js API + compiled React frontend. Auto SSL, CI/CD from GitHub, auto-scaling. |
| **PDF Generation** | DO Droplet (dedicated) | Puppeteer (headless Chrome). Isolated from API to prevent resource contention. |
| **Database** | DO Managed PostgreSQL | Primary database. Schema-per-tenant. Managed backups, automated failover. |
| **Cache/Queue** | DO Managed Redis | BullMQ job queue, session cache, WebSocket pub/sub, API rate limiting, compliance status cache. |
| **Object Storage** | DO Spaces (S3-compatible) | Documents, docket photos, generated PDFs, asset photos. Human-readable paths (doc 15). CDN enabled for static frontend assets. |

### Development Environment

Mirrors SafeSpec's setup:
- **Development PC:** Ubuntu 24.04 LTS + VSCode + Claude Code
- **Runtime:** Node.js 24.14.0 LTS, pnpm 10.32.1
- **Dev Server:** Linux machine (shared with SafeSpec at `../saas-project/`)
- **Shared Docker services** (already running, reuse for Nexum):
  - PostgreSQL 15 on port 5432 — create Nexum database
  - Redis 7.4 on port 6379 — use separate DB number or key prefix (requires auth)
  - MinIO on port 9000 (S3-compatible for local dev) — create Nexum bucket
  - MailHog on port 1025/8025 — email testing
  - Traefik reverse proxy
- Do NOT spin up duplicate Postgres/Redis/MinIO containers — use the shared ones
- Environment variables in `.env.development` (never commit)

### Production Scaling

Start small, scale as needed:
- **App Platform:** Start with Basic plan, scale horizontally (multiple instances behind load balancer)
- **PostgreSQL:** Start with Basic 1GB, scale to production tier as tenant count grows
- **Redis:** Start with Basic plan
- **PDF Droplet:** 2–4GB RAM (Puppeteer is memory-hungry)
- **Spaces:** Pay per usage

Scaling triggers:
- API response time > 200ms p95 → add App Platform instances
- Database CPU > 70% sustained → scale up PostgreSQL
- Redis memory > 80% → scale up Redis
- Queue backlog growing → add more BullMQ workers (additional App Platform workers)

## Authentication & Security

### OpShield Auth (Delegated)

Authentication is delegated to OpShield (see `docs/24-OPSHIELD-PLATFORM.md` and `docs/07-AUTH-ARCHITECTURE.md` in OpShield repo):
- OpShield runs the single Better Auth 1.5 instance for the entire Redbay platform
- Nexum validates OpShield-issued JWTs locally via JWKS endpoint (`jose` library)
- Local session cookie (`opshield_token`) set after JWT validation, 7-day TTL
- No auth tables in Nexum's database — user identity comes from OpShield
- Login/signup/password-reset all redirect to OpShield

### Authentication Features

- **Email + password** — Handled by OpShield
- **2FA — TOTP** — Mandatory for all users, with 30-day device trust. Handled by OpShield.
- **Microsoft SSO** — Per-tenant Azure AD integration. Handled by OpShield.
- **Biometric** — DriverX only (fingerprint/face via device)
- **Magic links** — Optional for portal users (passwordless login via email link, via OpShield)
- **SSO across products** — Single OpShield session works for both Nexum and SafeSpec

### Role-Based Access

OpShield manages identity (who you are). Nexum manages authorisation (what you can do):
- User roles stored in `tenant_users` table (public schema)
- Permission checks on every API endpoint
- Portal roles (contractor, customer) determine route access
- Platform admin is a separate role set in the public schema

### API Key Authentication

For integrations and DriverX:
- Users/admins generate scoped API keys from settings
- Keys hashed in database (never stored plaintext)
- Scopes control endpoint and data access (read-only, read-write, per-module)
- Rate limited per key

### Security Practices

- TLS enforced on all connections
- Secrets via DO environment variables, never in code
- Never log sensitive data (passwords, API keys, health information)
- All file uploads validated (type, size) and scanned
- CORS configured per environment
- Rate limiting at Redis layer (per IP, per API key, per tenant)
- Privacy Act 1988 (Cth) compliance — health info as sensitive data

## Multi-Tenancy

### Schema-Per-Tenant

Each tenant gets its own PostgreSQL schema (`tenant_{uuid}`):
- Structural isolation — cross-tenant access is architecturally prevented at the ORM layer
- Every query scoped to tenant schema via Drizzle ORM middleware
- Cannot accidentally query another tenant's data

### Public Schema

The `public` schema holds shared data:
- Tenant registry (tenant ID, name, subscription status, plan, settings, OpShield tenant ID)
- Tenant-user mapping (OpShield user ID → tenant, with role and cached display name/email)
- Platform admin configuration
- System-wide settings

Note: Auth tables (users, sessions, accounts) live in OpShield's database, not Nexum's.

### Tenant Lifecycle

1. **Onboarding:** New tenant triggers → schema creation, default data seeding (templates, notification defaults, system roles), welcome email, setup wizard
2. **Active:** Normal operation within their schema
3. **Suspended:** Tenant can log in but data is read-only (e.g. failed payment)
4. **Cancelled:** Schema preserved for data export period, then archived
5. **Deleted:** Schema dropped after retention period

### Tenant Settings

Stored in the public schema tenant registry:
- Company profile (ABN, address, logo)
- Subscription plan and features
- AI provider configuration
- Integration settings (Xero, SafeSpec)
- Feature toggles
- Notification preferences

## API Design

### REST API

All API endpoints under versioned prefix:

```
/api/v1/
  /auth/          # Auth callback, logout, identity (/me) — login via OpShield redirect
  /jobs/          # Job CRUD and lifecycle
  /scheduling/    # Allocation and scheduling
  /dockets/       # Docket and daysheet management
  /pricing/       # Pricing engine
  /invoicing/     # Invoice generation and management
  /rcti/          # RCTI lifecycle
  /entities/      # Customers, contractors, suppliers, drivers, assets, materials
  /documents/     # Document management
  /reports/       # Report generation and delivery
  /ai/            # AI features (job creation, review, queries)
  /portal/        # Portal-specific endpoints
  /driver/        # DriverX-specific endpoints
  /admin/         # Tenant admin endpoints
  /xero/          # Xero integration endpoints
  /notifications/ # Notification preferences and history
  /webhooks/      # Incoming webhooks (Xero, SafeSpec)
```

### API Standards

- JSON request/response bodies
- Zod validation on all inputs (auto-400 on validation failure)
- Consistent error format: `{ error: string, code: string, details?: object }`
- Pagination: cursor-based for lists (`?cursor=xxx&limit=50`)
- Filtering: query parameters (`?status=active&customer_id=xxx`)
- Sorting: `?sort=created_at&order=desc`
- Partial responses: `?fields=id,name,status` (optional)

### API Versioning

- URL prefix versioning: `/api/v1/`, `/api/v2/`
- Breaking changes require new version
- Old versions supported for minimum 12 months after deprecation
- Non-breaking changes (new fields, new endpoints) added to current version

### Rate Limiting

- Per API key, per IP, per tenant
- Enforced at Redis layer
- Rate limit headers in every response (`X-RateLimit-Remaining`, `X-RateLimit-Reset`)

**Rate limit tiers:**
- **External API keys** — 1,000 requests/hour per key (higher limits on premium plans)
- **Internal session-based (web app)** — 5,000 requests/hour per user session (higher because the SPA makes many small requests)
- **DriverX authenticated clients** — 10,000 requests/hour per device (GPS pings at 30-second intervals = 120/hour per driver, plus load captures, pre-starts, and sync requests)
- **GPS ingestion endpoint** (`/api/v1/driver/gps`) — Separate rate bucket, effectively unlimited for authenticated DriverX clients (throttled only to prevent abuse, not normal operation). This endpoint is optimised for high-throughput writes with minimal processing overhead.

### Webhooks (Outbound)

Nexum sends webhooks for key events:
- Job created, updated, completed
- Invoice generated, paid
- RCTI approved, sent
- Allocation created, changed
- Document uploaded, expiring
- HMAC signature on payload for verification
- Retry with exponential backoff on failure
- Webhook management in tenant admin (add/remove endpoints, view delivery logs)

### Webhooks (Inbound)

Nexum receives webhooks from:
- **Xero** — Payment notifications, contact updates
- **SafeSpec** — Compliance status changes, cache invalidation
- Verified via provider-specific signature validation

## Real-Time Architecture

### WebSocket

Fastify WebSocket plugin for real-time browser communication:

**Channels:**
- `jobs:{tenant_id}` — Job status changes, new jobs
- `scheduling:{tenant_id}` — Allocation changes, scheduling updates
- `notifications:{user_id}` — User-specific notifications
- `map:{tenant_id}` — GPS position updates, geofence events
- `portal:contractor:{entity_id}` — Contractor portal updates
- `portal:customer:{entity_id}` — Customer portal updates

**Authentication:**
- WebSocket connection authenticates via the same session cookie used by REST API requests
- On connection, the server validates the session cookie, extracts tenant ID and user ID, and subscribes to the appropriate channels
- If the session expires while a WebSocket is connected, the server sends a `session_expired` message and closes the connection — the client redirects to login
- DriverX authenticates WebSocket connections via Bearer token in the handshake headers (same API key used for REST requests)
- Unauthenticated WebSocket connections are immediately closed

**Reconnection:**
- Client auto-reconnects with exponential backoff: 1s, 2s, 4s, 8s, capped at 30s
- On reconnection, the client sends a `last_event_id` timestamp — the server replays any missed events from a short-lived Redis stream (5-minute retention)
- If disconnected longer than the replay window, the client performs a full state refresh

**Scaling:**
- Redis pub/sub distributes messages across multiple App Platform instances
- Each instance subscribes to relevant channels
- Event replay on reconnection uses Redis Streams (separate from pub/sub) with 5-minute TTL

### Server-Sent Events (Alternative)

For simpler one-way streaming (e.g. long-running report generation progress), SSE can supplement WebSocket where bidirectional isn't needed.

## Data Architecture

### Database Design Principles

- All tables: `id` (UUID), `created_at`, `updated_at`
- Soft deletes only — `deleted_at` timestamp, never hard delete user data
- Every write operation creates an audit log entry
- All routes must have Zod schema validation and be tenant-scoped
- Indexes on all foreign keys and commonly queried fields
- JSONB for flexible metadata (document metadata, custom fields)

### Drizzle ORM

- Schema definitions in TypeScript
- Migrations generated from schema changes
- Schema-per-tenant middleware handles tenant scoping transparently
- Query builder for complex queries, raw SQL escape hatch when needed
- Connection pooling via `postgres` driver

### Schema-Per-Tenant Migration Strategy

When a new migration is added, it must be applied to every existing tenant schema — not just new tenants.

**Migration runner:**
- A dedicated BullMQ job (`migrate-all-tenants`) that iterates all active tenant schemas and applies pending migrations sequentially
- Runs automatically on application startup (after the public schema is migrated)
- Each tenant migration is wrapped in its own transaction — if tenant 47 fails, tenants 1–46 are committed and tenants 48+ still run
- Failed tenant migrations are logged with the error and tenant ID, and flagged for manual retry
- A `schema_migrations` tracking table in each tenant schema records which migrations have been applied

**Rollback strategy:**
- Drizzle migrations are forward-only by convention — no auto-rollback
- If a migration fails on some tenants, fix the migration issue and re-run (the runner skips already-applied migrations)
- For critical failures: a manual rollback script can be written and applied per-tenant via admin tooling
- Never modify a migration that has already been applied to any tenant — create a new corrective migration instead

**New tenant provisioning:**
- Tenant provisioning is a serialised BullMQ job (not an inline API operation) to prevent concurrent schema creation conflicts
- The job creates the schema, runs all migrations from scratch, and seeds default data (roles, notification defaults, templates)
- If provisioning fails mid-way, the partially created schema is dropped and the job can be retried cleanly

**Development workflow:**
```bash
pnpm db:migrate           # Migrate public schema + all tenant schemas
pnpm db:migrate:public    # Migrate public schema only
pnpm db:migrate:tenants   # Migrate all tenant schemas only
pnpm db:migrate:tenant <id>  # Migrate a specific tenant schema
```

### Data Residency

All data stays in DigitalOcean Sydney region:
- Database (DO Managed PostgreSQL — Sydney)
- Object storage (DO Spaces — Sydney)
- Cache/queue (DO Managed Redis — Sydney)
- Application (DO App Platform — Sydney)
- Backups (DO automated backups — same region)

## External Integrations

| Integration | Connection | Purpose |
|------------|-----------|---------|
| **Xero** | OAuth 2.0 + webhooks | Bidirectional accounting sync (doc 11) |
| **SafeSpec** | API + webhooks + shared auth | Compliance status, operational data (doc 12) |
| **Google Maps** | API key | Map display, directions, geocoding, places (doc 19) |
| **ABR (ABN Lookup)** | API key (SOAP/XML) | Australian Business Register — auto-populate company details from ABN (doc 02) |
| **AI Providers** | API key (Gemini, OpenAI, Anthropic) | Provider-flexible AI features (doc 16) |
| **SMS Provider** | API key | SMS delivery (1–2 providers, doc 13) |
| **SMTP2GO** | API key | Transactional email delivery |
| **APNs / FCM** | Certificates/keys | DriverX push notifications |
| **Stripe** | API key + webhooks | Subscription billing (if applicable) |

## Billing (Tenant Subscriptions)

- Stripe Billing for subscription management
- Webhook-driven plan status updates
- Stripe Customer created on tenant onboarding
- Supports: plan upgrades/downgrades, failed payment handling, invoice generation
- Plan determines available modules and feature toggles
- Usage-based billing components (AI usage, storage, SMS) tracked per tenant

## Monitoring & Observability

- **Application logs:** Structured JSON logging, shipped to centralised log management
- **Error tracking:** Sentry or similar for exception monitoring with source maps
- **Uptime monitoring:** External health check on API endpoints
- **Queue monitoring:** Bull Board for BullMQ queue visibility
- **Database monitoring:** DO Managed PostgreSQL metrics (connections, query time, storage)
- **Performance:** API response time tracking, slow query logging
- **Alerting:** Notification on error spikes, queue backlog, database issues, certificate expiry

## Australian-Specific Standards

Following SafeSpec conventions:
- **Dates:** DD/MM/YYYY in UI, ISO 8601 in API/database
- **Currency:** AUD with `$` prefix and 2 decimal places
- **Phone:** E.164 storage (+61...), display with spaces (04XX XXX XXX)
- **ABN:** 11 digits, validated with check digit algorithm
- **States:** QLD, NSW, VIC, SA, WA, TAS, NT, ACT
- **Timezone:** AEST/AEDT default, configurable per tenant
- **GST:** 10% default, configurable (doc 11 dynamic tax rates from Xero)
