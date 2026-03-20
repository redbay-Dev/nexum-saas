# 24 — OpShield Platform Architecture

> The central platform that provisions, authenticates, bills, and manages Nexum and SafeSpec as independent but connectable products.

## Overview

**OpShield** is the platform layer that sits above Nexum (operations) and SafeSpec (compliance). It is not a user-facing product in the traditional sense — it's the infrastructure and management layer that enables both products to be sold, provisioned, and managed independently or as a bundle.

Think of it as: Atlassian is to Jira/Confluence what OpShield is to Nexum/SafeSpec.

## The Three-Project Architecture

```
┌──────────────────────────────────────────────────┐
│                    OpShield                       │
│  ──────────────────────────────────────────────   │
│  Public website (marketing, pricing, sign-up)    │
│  Subscription & billing (Stripe)                 │
│  Tenant provisioning (creates schemas in DBs)    │
│  Unified auth (Better Auth SSO — single source)  │
│  Platform admin dashboard (Redbay staff)         │
│  Product registry (which products exist)         │
└────────────┬─────────────────┬───────────────────┘
             │                 │
       ┌─────▼─────┐    ┌─────▼─────┐
       │   Nexum   │    │ SafeSpec  │
       │ Operations│    │Compliance │
       │           │◄──►│           │
       └───────────┘    └───────────┘
         Optional API integration
         (when tenant has both)
```

### Project Locations (dev server)

| Project | Path | Port (API) | Port (Frontend) |
|---------|------|------------|-----------------|
| OpShield | `/home/redbay/OpShield` | 3000 | 5170 |
| SafeSpec | `/home/redbay/saas-project` | 3001 | 5173 |
| Nexum | `/home/redbay/Nexum-SaaS` | 3002 | 5174 |

## What OpShield Owns

### 1. Authentication (Single Source of Truth)

OpShield owns the **single Better Auth instance** that all products trust.

- One user account works across all products
- SSO — log into OpShield, access any product you're subscribed to
- JWTs issued by OpShield, validated locally by products via JWKS endpoint (no per-request callback)
- 2FA (TOTP) mandatory for all users, with 30-day device trust (remembered devices skip 2FA)
- Microsoft SSO supported — tenants can connect their own Azure AD for company-wide SSO
- Password reset, email verification — all handled by OpShield
- User profile (name, email, phone, avatar) lives in OpShield

**How products validate:**
- Nexum and SafeSpec do NOT run their own Better Auth instances
- They validate session tokens against OpShield's auth endpoint
- Products receive the user identity + tenant memberships from OpShield
- Each product still manages its own role/permission assignments internally

**Migration note:** Both Nexum and SafeSpec currently have embedded Better Auth. This will be extracted to OpShield. The Better Auth tables move to OpShield's database.

### 2. Tenant Provisioning

When a customer signs up:

1. **OpShield** creates the tenant record (company name, ABN, plan, billing)
2. **OpShield** provisions database schemas in the relevant product database(s):
   - Buying Nexum → creates `tenant_{uuid}` schema in Nexum's PostgreSQL
   - Buying SafeSpec → creates `tenant_{uuid}` schema in SafeSpec's PostgreSQL
   - Buying both → creates schemas in both databases, links them
3. **OpShield** stores the tenant-to-product mapping
4. **OpShield** sends welcome email with login links to the right product(s)

**Tenant registry (OpShield database):**
```
tenants
├── id (UUID)
├── company_name
├── abn
├── primary_contact_email
├── subscription_plan
├── subscription_status (trial | active | suspended | cancelled)
├── products[] — which products this tenant has access to
├── billing_customer_id (Stripe customer ID)
├── created_at
└── updated_at

tenant_products
├── tenant_id → tenants.id
├── product_id → products.id (nexum | safespec)
├── status (provisioning | active | suspended)
├── provisioned_at
├── schema_name (tenant_{uuid})
└── config (JSONB — product-specific settings)

products
├── id (nexum | safespec)
├── name
├── description
├── base_url
├── api_url
├── active
└── pricing_plans (JSONB)
```

### 3. Billing & Subscriptions (Stripe)

- Stripe Billing for recurring subscriptions
- Support for: Nexum-only, SafeSpec-only, or bundled pricing
- Plan tiers per product (starter, growth, business, enterprise)
- Bundle discount when subscribing to both
- Australian GST handling (Stripe handles this)
- Usage-based billing for overages (users, storage, API calls)
- Subscription lifecycle: trial → active → past_due → suspended → cancelled
- Webhook from Stripe → OpShield → suspend/reactivate tenant in product DBs

### 4. Public Website

The marketing and onboarding face of the platform:

- Product descriptions (Nexum, SafeSpec)
- Pricing pages with plan comparison
- Sign-up flow → select product(s) → create account → provision → redirect to product
- Login page → SSO → redirect to chosen product
- Support/contact pages
- Blog / knowledge base (future)

### 5. Platform Admin Dashboard

For Redbay staff only — not visible to tenants:

- **Tenant management** — create, view, suspend, reactivate, delete tenants
- **Subscription management** — view plans, override limits, apply discounts
- **Product health** — is Nexum up? Is SafeSpec up? API response times
- **Usage analytics** — per-tenant user counts, storage, API calls
- **Support tools** — impersonate tenant, view audit logs, export data
- **Feature flags** — enable/disable features per tenant or globally
- **Revenue dashboard** — MRR, churn, growth (from Stripe data)

## How Products Connect to OpShield

### Auth Flow

```
User → OpShield Login → Better Auth session created
     → Redirect to Nexum (with session token)
     → Nexum validates token against OpShield auth API
     → Nexum loads tenant context from its own DB
     → User is in Nexum
```

### Product-to-Product Navigation

When a tenant has both Nexum and SafeSpec:
- Nexum shows a "SafeSpec" link in the sidebar/header
- Clicking it opens SafeSpec in a new tab — SSO means no re-login
- SafeSpec shows a "Nexum" link similarly
- Both show an "OpShield" link to manage subscription/billing

### API Integration (Nexum ↔ SafeSpec)

This is unchanged from `SAFESPEC-INTEGRATION-NOTE.md`. The products talk directly to each other via API — OpShield is NOT a message broker. OpShield's role is:
1. Telling each product that a tenant exists in the other product
2. Providing the API URL and shared secret for inter-product communication
3. Managing the lifecycle (if a tenant cancels SafeSpec, tell Nexum to disable compliance features)

## Tech Stack

OpShield uses the same stack as Nexum/SafeSpec for consistency:

| Component | Technology |
|-----------|-----------|
| Frontend | React 19 + TypeScript 5.9 + Vite 8 + Tailwind CSS 4 + shadcn/ui |
| Backend | Node.js 24 LTS + Fastify 5 + TypeScript 5.9 |
| Database | PostgreSQL 15 (shared instance, `opshield` database) |
| ORM | Drizzle ORM 0.45 |
| Auth | Better Auth 1.5 (THE auth instance — products delegate to this) |
| Billing | Stripe (subscriptions, invoicing, webhooks) |
| Email | SMTP (MailHog in dev, SMTP2GO in prod) |
| Monorepo | pnpm 10 workspaces + Turborepo 2.8 |
| Hosting | DigitalOcean (Sydney region) |

**Database:** OpShield uses a single flat schema (no multi-tenancy in OpShield itself — it IS the tenant manager). Database name: `opshield_dev` (dev), `opshield` (prod).

**Ports:**
- API: 3000
- Frontend: 5170

**Redis prefix:** `opshield:`

## Development Shared Services

All three projects share the same Docker services on the dev server:

| Service | Port | Notes |
|---------|------|-------|
| PostgreSQL 15 | 5432 | Databases: `opshield_dev`, `nexum_dev`, `safespec_dev` |
| Redis 7.4 | 6379 | Key prefixes: `opshield:`, `nexum:`, `safespec:` |
| MinIO | 9000 | Buckets: `opshield-dev`, `nexum-dev`, `safespec-dev` |
| MailHog | 1025/8025 | Shared for all three |
| Traefik | 80/443 | Reverse proxy |

Do NOT spin up duplicate containers.

## Migration Plan

### Phase 1: Scaffold OpShield (do first)
- Create the monorepo with same structure as Nexum/SafeSpec
- Set up database with tenant registry, product registry, user tables
- Set up Better Auth as THE auth instance
- Basic sign-up → provision flow (CLI/API, no UI yet)

### Phase 2: Extract Auth
- Move Better Auth tables from Nexum and SafeSpec to OpShield
- Update Nexum and SafeSpec to validate sessions against OpShield
- SSO works across all three

### Phase 3: Public Website
- Marketing pages (products, pricing, about)
- Sign-up flow with product selection
- Login with redirect to chosen product
- Account management (billing, profile)

### Phase 4: Billing
- Stripe integration (subscriptions, webhooks)
- Plan management and enforcement
- Usage tracking

### Phase 5: Platform Admin
- Tenant management dashboard
- Revenue analytics
- Support tools

## Nexum Module Architecture (CRITICAL)

Nexum is modular: **Core is always included**, optional modules are individually purchasable.

### Core (Always Included)
- Jobs, Business Entities, Scheduling, Dashboard

### Optional Modules (11 total)
| Module | Monthly Add-On | Notes |
|--------|---------------|-------|
| Invoicing | $29/month | Invoice generation, credit notes, AR |
| RCTI | $19/month | Contractor payments, remittance |
| Xero Integration | $19/month | Bidirectional accounting sync |
| Compliance | $29/month | **Requires active SafeSpec subscription** |
| SMS Messaging | $19/month + usage | Multi-provider messaging |
| Docket Processing | $19/month | Digital docket capture, approval |
| Materials Management | $19/month | Material types, pricing, disposal |
| Map Planning | $19/month | Route planning, geofencing |
| AI Automation | $29/month + usage | Job parsing, smart suggestions |
| Reporting & Analytics | $19/month | Advanced reports, dashboards |
| Portal | $29/month | Contractor/customer web access |

**Optional modules use Core's user allocation** — no separate user counts per module.

### Cross-Product Dependency: Compliance Module

The Nexum `Compliance` module pulls data from SafeSpec. It **cannot be enabled** unless the tenant also has an active SafeSpec subscription (WHS, HVA, or both).

| SafeSpec Module | What Nexum Compliance Shows |
|----------------|---------------------------|
| WHS active | Hazard alerts, incident notifications, SWMS status, inspection compliance |
| HVA active | Driver licence/medical status, fatigue compliance, vehicle registration, CoR |
| Both active | Full compliance dashboard |
| Neither | Compliance module disabled in Nexum |

If a tenant cancels SafeSpec, OpShield notifies Nexum → Nexum disables the compliance module and shows: "SafeSpec subscription required for compliance features."

### Module Enforcement Rules (MUST IMPLEMENT)

Enforcement at three layers:
1. **OpShield (source of truth)** — Tracks which modules each tenant has via `tenant_modules`
2. **Nexum Backend (security boundary)** — API middleware returns 403 for unsubscribed modules
3. **Nexum Frontend (UX convenience)** — Hides nav items, shows upgrade prompts

```typescript
// Example: Nexum route middleware
const requireModule = (moduleId: Module) => {
  return async (request, reply) => {
    const entitlements = await getEntitlements(request.tenantId);
    const module = entitlements.modules[moduleId];
    if (!module || module.status !== 'active') {
      return reply.status(403).send({
        error: 'MODULE_NOT_SUBSCRIBED',
        module: moduleId,
        upgrade_url: `${OPSHIELD_URL}/billing/upgrade?module=${moduleId}`
      });
    }
  };
};

// Core routes — no module check needed
app.get('/api/jobs', { preHandler: [requireAuth] }, getJobs);

// Module-gated routes
app.get('/api/invoices', { preHandler: [requireAuth, requireModule('invoicing')] }, getInvoices);
app.get('/api/rctis', { preHandler: [requireAuth, requireModule('rcti')] }, getRctis);
app.get('/api/compliance/status', { preHandler: [requireAuth, requireModule('compliance')] }, getComplianceStatus);
```

### Pricing (Base + Per-User)

Nexum Core has a base price with included users, then per-user charges for extras.
Optional modules are flat add-ons that share Core's user allocation.

**Core:** Starter $79/mo (5 users, +$8/extra) → Professional $179/mo (15 users, +$6) → Enterprise (custom)
**Modules:** Flat monthly add-ons ($19-29/mo each), no separate user count

**Example:** Professional + Invoicing + RCTI + Xero with 20 users = $179 + (5 × $6) + $29 + $19 + $19 = $276/mo

### User Management Boundary

**OpShield tracks how many user seats are purchased. Nexum manages who those users are.**

- OpShield knows: "This tenant has 15 Nexum seats"
- Nexum knows: "These 15 people are users, with roles: 1 owner, 2 admin, 8 dispatcher, 3 finance, 1 read_only"
- When inviting a user in Nexum, check entitlements API for remaining seats
- If at the limit, show: "User limit reached. Upgrade your plan in OpShield."
- Nexum reports active user counts to OpShield for billing (hourly + on user add/remove)

### Entitlements API

Nexum calls OpShield to check module access and licence limits:

```
GET {OPSHIELD_API_URL}/api/tenants/:tenantId/entitlements

Response includes per-module status, plan, included_users, max_users.
Cache in Redis (TTL: 15 min). Invalidated immediately by OpShield webhook.
```

### OpShield Webhooks Nexum Must Handle

```
POST /api/webhooks/opshield
Events:
  module.activated      → Enable module features
  module.suspended      → Disable write access, show warning
  module.cancelled      → Disable all access (hide from nav, 403 on API)
  module.plan_changed   → Update user limits
  tenant.suspended      → Read-only mode across everything
  tenant.reactivated    → Restore full access
  tenant.deleted        → Begin data retention countdown
```

### Platform Admin Impersonation

Redbay staff (via OpShield Platform Admin) can impersonate any tenant for support:
- Nexum must check for impersonation header/session flag
- Show yellow banner: "⚠️ Impersonating: {company_name} (admin: {admin_email})"
- Audit log all actions with impersonation context
- Session auto-expires after 30 minutes

## What Nexum Keeps

Even with OpShield, Nexum retains:

- **Its own database** with tenant schemas
- **Its own user management** — creates users, assigns roles (owner, admin, dispatcher, finance, compliance, read_only), sets permissions
- **Its own role/permission system** (OpShield doesn't know what a "dispatcher" is)
- **Its own business logic** (jobs, pricing, scheduling — none of that is in OpShield)
- **Its own frontend** (separate React app, separate domain)
- **Its own API** (product-specific routes)

OpShield manages: identity (who you are), tenancy (which company), billing (what's paid for), module entitlements (what's enabled), platform administration, and support ticketing. Nexum manages: users (who can access), roles (what they can do), and all business logic.

## Support Integration

OpShield is the centralized support hub. Nexum needs a **support widget** (help button) that lets users submit tickets:

- Clicking help opens a simple form: subject, category, description, attachments
- Submission sends a structured email to `support@redbay.com.au` with headers:
  - `X-Redbay-Product: nexum`
  - `X-Redbay-Tenant-Id: {tenantId}`
  - `X-Redbay-User-Id: {userId}`
  - `X-Redbay-Category: {category}`
  - `X-Redbay-Page: {currentPath}`
- Fallback: POST to `{OPSHIELD_API_URL}/api/support/tickets`
- Users receive replies via email — they never need to log into OpShield
- Optional: "My Support Tickets" page that reads from OpShield API

See `/home/redbay/OpShield/docs/06-SUPPORT-SYSTEM.md` for full details.

## Environment Variables for OpShield Integration

```env
OPSHIELD_API_URL=http://localhost:3000          # dev
OPSHIELD_AUTH_URL=http://localhost:3000/api/auth
OPSHIELD_WEBHOOK_SECRET=<shared-secret>
OPSHIELD_API_KEY=<nexum-api-key>
```

## Domain Strategy (Production)

| Product | Domain |
|---------|--------|
| OpShield (platform) | TBD (e.g., `app.opshield.com.au` or similar) |
| Nexum | `app.nexum.com.au` |
| SafeSpec | `app.safespec.com.au` |
| Auth | `auth.opshield.com.au` (or embedded in OpShield) |

## Key Design Principles

1. **Products are independent** — Nexum works without SafeSpec. SafeSpec works without Nexum. Both work without knowing OpShield exists (they just need an auth endpoint).

2. **OpShield is invisible to end users** — Users log into "Nexum" or "SafeSpec". OpShield handles auth and billing behind the scenes. The only time users see OpShield is the sign-up page and account/billing management.

3. **No business logic in OpShield** — OpShield doesn't know what a job, driver, hazard, or inspection is. It knows tenants, products, subscriptions, and users.

4. **No user management in OpShield** — Each product manages its own users, roles, and permissions. OpShield only tracks user **counts** for billing (licence seats used vs purchased).

5. **API-only integration between products** — Products never share database access. All communication is via documented APIs with HMAC-signed webhooks.

6. **Products can be sold separately** — The architecture must support a customer buying only Nexum, only SafeSpec, or both. No hidden coupling.

## Reference

- **Full platform docs:** `/home/redbay/OpShield/docs/`
  - `00-PROJECT-OVERVIEW.md` — Platform overview
  - `01-PRODUCT-MODULE-ARCHITECTURE.md` — Module hierarchy, enforcement, sign-up flow
  - `02-TENANT-PROVISIONING.md` — How tenants are created and schemas provisioned
  - `03-INTEGRATION-ARCHITECTURE.md` — How products communicate, webhook security
  - `04-BILLING-PRICING-MODEL.md` — Pricing, Stripe, user licensing
  - `05-PLATFORM-ADMIN.md` — Redbay staff admin dashboard
  - `06-SUPPORT-SYSTEM.md` — Centralized support ticketing, email processing
  - `07-AUTH-ARCHITECTURE.md` — SSO, 2FA, JWT/JWKS, Microsoft SSO, migration plan
  - `08-NOTIFICATIONS-EMAIL.md` — Platform transactional emails
  - `09-PLATFORM-API-CONTRACTS.md` — API versioning, shared types, rate limiting
  - `DECISION-LOG.md` — All architectural decisions (DEC-001 to DEC-018)
- **SafeSpec copy of this doc:** `/home/redbay/saas-project/docs/24-OPSHIELD-PLATFORM.md`
- **Nexum ↔ SafeSpec integration:** `docs/SAFESPEC-INTEGRATION-NOTE.md` (this repo)
