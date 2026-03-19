# Nexum Rebuild — Documentation Hub

## For Agents
Read `SESSION-LOG.md` first. It contains all context, decisions, and progress from previous sessions.

### Sister Project: SafeSpec
- **Path**: `/home/redbay/saas-project` (sibling directory: `../saas-project/`)
- **What**: Compliance & WHS management SaaS (NHVAS, WHS, mass, fatigue, maintenance, defects, pre-starts)
- **Relationship**: SafeSpec owns all compliance. Nexum consumes compliance status via API. Both share the same architecture, auth system (Better Auth), and `@redbay/compliance-shared` package.
- **Integration doc**: `docs/SAFESPEC-INTEGRATION-NOTE.md` (exists in both repos)

## Document Index

All documentation lives in `docs/`. Documents are numbered for reading order. Each document is written after a Q&A discussion with Ryan — nothing is assumed.

### Status Key
- **Draft** — Written but not reviewed by Ryan
- **Discussed** — Q&A completed, awaiting documentation
- **Approved** — Ryan has reviewed and confirmed
- **Pending** — Not yet discussed

### Core Documents

| # | File | Status | Purpose |
|---|------|--------|---------|
| 00 | `00-PROJECT-OVERVIEW.md` | Approved | What this project is, product vision, guiding principles |
| 01 | `01-CORE-IDENTITY.md` | Approved | Multi-tenancy, company model, what changes from Nexum |
| 02 | `02-BUSINESS-ENTITIES.md` | Approved | Customers, contractors, suppliers, contacts, addresses |
| 03 | `03-DRIVERS-EMPLOYEES.md` | Approved | Profiles, licences, qualifications, portal access |
| 04 | `04-ASSETS-FLEET.md` | Approved | Vehicles, categories, mass limits, maintenance |
| 05 | `05-MATERIALS-DISPOSAL.md` | Approved | Material types, pricing behaviour, disposal sites |
| 06 | `06-JOB-SYSTEM.md` | Approved | Job creation, lifecycle, workflow, projects |
| 07 | `07-SCHEDULING.md` | Approved | Resource scheduling, allocation, conflict handling |
| 08 | `08-DOCKETS.md` | Approved | Daysheets (primary work record), dockets (supporting evidence), AI reading, processing |
| 09 | `09-PRICING-ENGINE.md` | Approved | Pricing methods, behaviours, rate cards, markup rules, margin controls, snapshots |
| 10 | `10-INVOICING-RCTI.md` | Approved | Invoice scheduling, grouping, split invoicing, RCTI periods, deductions, remittance, credit management |
| 11 | `11-XERO-INTEGRATION.md` | Approved | Bidirectional sync, dynamic account mapping, webhooks, credit notes, tracking categories |
| 12 | `12-COMPLIANCE-SAFETY.md` | Approved | SafeSpec owns all compliance, Nexum = status checks, gates, operational data push, SafeSpec dev note |
| 13 | `13-COMMUNICATIONS.md` | Approved | Unified comms service, push/SMS/email channels, WebSocket, notifications, templates |
| 14 | `14-PORTAL.md` | Approved | Same-app portal routes, contractor self-management, customer self-service, Better Auth unified, document approval workflow |
| 15 | `15-DOCUMENTS.md` | Approved | Human-readable S3, standard naming, full document manager, versioning, auto-sync, sharing, PDF generation |
| 16 | `16-AI-AUTOMATION.md` | Approved | Provider-flexible AI, full AI suite (8 features), BullMQ queues, workflow engine, tenant-configurable |
| 17 | `17-REPORTING-ANALYTICS.md` | Approved | All reports carry forward + improved, scheduled delivery, portal access, custom report builder |
| 18 | `18-ADMINISTRATION.md` | Approved | Platform + tenant admin, granular permissions with improved UX, enforced in dev, audit logging, onboarding |
| 19 | `19-MAP-PLANNING.md` | Approved | Google Maps, real-time GPS from DriverX, geofencing, route planning, backhaul with AI learning, regions |
| 20 | `20-DRIVERX.md` | Approved | Separate repo, React Native, full driver hub, offline-first, GPS, pre-starts, API contract |
| 21 | `21-TECHNICAL-ARCHITECTURE.md` | Approved | DO exclusively, SafeSpec-mirrored monorepo, Fastify + Drizzle + Better Auth, schema-per-tenant, API-first |
| 22 | `22-DEVELOPMENT-WORKFLOW.md` | Approved | Git workflow, testing, CI/CD, conventions, CLAUDE.md with slash commands + skills + strict type enforcement |

### Reference Documents

| File | Purpose |
|------|---------|
| `CONVENTIONS.md` | Coding standards, naming conventions, file structure rules |
| `DECISION-LOG.md` | Record of every decision with rationale |
| `SAFESPEC-INTEGRATION-NOTE.md` | Cross-reference for SafeSpec devs — what Nexum needs, API contracts, data flows. Also exists in SafeSpec repo at `../saas-project/docs/SAFESPEC-INTEGRATION-NOTE.md` |

### Rules for Agents

1. **Read SESSION-LOG.md first** — Contains all context from previous sessions
2. **Never assume** — If something isn't documented here, ask Ryan
3. **Record everything** — Every decision goes in DECISION-LOG.md
4. **No SQL** — Leave database implementation to the build phase
5. **No timelines** — Focus on what the system does, not when it ships
6. **Q&A first, document second** — Discuss with Ryan before writing any doc
