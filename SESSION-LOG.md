# Nexum Rebuild — Session Log

This file tracks all discussions, decisions, and progress across sessions. Any new agent continuing this work should read this file first.

---

## Session 1 — 19 March 2026

**Agent:** Claude Opus 4.6 (Cowork mode)
**Context:** Ryan wants to rebuild Nexum as a modern web-based SaaS, modelled on the SafeSpec project architecture (pnpm monorepo, Turborepo, Fastify, Drizzle, React + shadcn/ui).

### What was done:
1. Deep research of entire Nexum codebase (~700+ files, 151 handlers, 199 migrations, 233 tables, 1,120+ IPC functions)
2. Analysed SafeSpec repo via browser (pnpm monorepo with packages: backend, frontend, shared, pdf-templates)
3. Created initial `NEXUM-REBUILD-PLAN.md` with full feature audit, architecture comparison, and phased rebuild strategy
4. Verified the plan against the codebase — found ~30% more features than initially documented (AI/Gemini integration, advanced financial workflows, document management per entity, business projects, detailed compliance sub-modules, performance/ranking, infrastructure services)
5. Updated plan with Appendix A covering all missing features

### Key decisions made:
- **Greenfield build** — not a migration, start fresh informed by Nexum
- **Follow SafeSpec architecture** — monorepo, same patterns, same conventions
- **Both DX and UX equally prioritised**
- **Output format:** Markdown documentation in `docs/`
- **No SQL in docs** — leave database design to future implementation agents
- **No timelines** — keep docs focused on what the system does, not when
- **Q&A approach** — discuss each area with Ryan before documenting, keep/change/drop decisions recorded

### What Ryan wants:
- Go through each area of the system section by section
- Discuss what to bring over from Nexum, what to change, what to drop
- Create detailed docs about what the new Nexum should be
- Follow SafeSpec's documentation and project structure patterns
- Record everything for agent continuity (this file)

### SafeSpec reference:
- Repo: github.com/redbay-Dev/safespec (private)
- Structure: pnpm monorepo + Turborepo
- Packages: backend (Fastify), frontend (React + Vite + shadcn/ui), shared (Zod schemas), pdf-templates (Handlebars)
- DB: PostgreSQL with Drizzle ORM, schema-per-tenant multi-tenancy
- Auth: Better Auth (self-hosted)
- Queue: BullMQ (Redis)
- PDF: Puppeteer + Handlebars
- Docs: Numbered 00-11 covering every aspect
- Has .claude folder with slash commands (Ryan will share as needed)

### Nexum features to discuss (suggested order):
Each needs a dedicated doc after Q&A discussion:

1. **Core Identity & Multi-tenancy** — Companies, tenants, the dual-table problem, what changes
2. **Business Entities** — Customers, contractors, suppliers, contacts, addresses
3. **Drivers & Employees** — Profiles, licences, qualifications, portal access
4. **Assets & Fleet** — Vehicles, categories, mass limits, maintenance, documents
5. **Materials & Disposal** — Material types, pricing, compliance, disposal sites
6. **Job System** — Creation, lifecycle, workflow states, the v1/v2 question
7. **Scheduling & Allocation** — Resource scheduling, conflict detection, drag-drop
8. **Docket Processing** — Upload, review, approval, verification
9. **Pricing Engine** — Rates, markups, party-specific pricing, margin tracking
10. **Invoicing & RCTI** — Invoice generation, RCTI, remittance, payment tracking
11. **Xero Integration** — Contact sync, invoice push, payment reconciliation
12. **Compliance & Safety** — NHVAS, WHS, CoR, fatigue, drug testing, defects, prestarts
13. **SMS & Communications** — Multi-provider SMS, templates, conversations
14. **Email & Notifications** — Email service, in-app notifications, real-time updates
15. **Portal** — External access for contractors/drivers
16. **Documents & Attachments** — File management across all entities
17. **AI & Automation** — Gemini integration, job parsing, job review
18. **Reporting & Analytics** — Financial reports, compliance reports, performance metrics
19. **Administration** — Users, roles, permissions, audit, settings, configuration
20. **Map Planning** — Route planning, backhaul detection, geofencing

### What's next:
- Start Q&A on section 1 (or whichever Ryan wants to start with)
- After discussion, create the numbered doc
- Repeat for each section
- Ryan will share SafeSpec's .claude config and slash commands when relevant

### Docs completed this session:
- **00-PROJECT-OVERVIEW.md** — Approved
- **01-CORE-IDENTITY.md** — Approved
- **02-BUSINESS-ENTITIES.md** — Approved (after corrections)
- **03-DRIVERS-EMPLOYEES.md** — Approved
- **04-ASSETS-FLEET.md** — Approved (after corrections: mass mgmt from external compliance system, no fallback, trailer removal, pre-start flexibility)
- **05-MATERIALS-DISPOSAL.md** — Approved (after corrections: keep separate tables per source, sub rates fixed only, no unit conversion, density factor is new not existing)
- **06-JOB-SYSTEM.md** — Approved (DB-first real-time, draft by default, simplified lifecycle, tenant-configurable job types, section-level collaboration, AI provider-flexible)
- **07-SCHEDULING.md** — Approved (after corrections: route/backhaul integrated, line+multiline views, extensive search app-wide, separate windows, subcategory matching, context-aware status, AI auto-allocation, all factors overridable)
- **08-DOCKETS.md** — Approved (daysheets as primary work record separate from dockets as supporting evidence, AI OCR reading with confidence scores, auto+batch processing, overage system rebuilt with tolerance tiers and pattern detection, daysheet feeds company driver timesheets)

### Key corrections from Ryan on doc 02:
- Credit terms and charge types must be **tenant-configurable**, not hardcoded
- Contractor self-service docs: tenant retains **full override** — can upload on behalf of, edit, replace anything the contractor submits
- Customer credit system needs **full account management**: hold/stop, credits on account (overpayments, adjustments, goodwill)
- Contractors need **account items** beyond RCTI: extra charges (parking, fuel), reversals, transparent statements
- Onboarding packs: referenced real FTG subcontractor pack (17 sections) and WHS document library (30+ policies across 6 categories)
- DriverX is a **React Native** app, gets its own full doc (doc 20)

### Mounted folders this session:
- `C:\Users\ryans\FARRELL TRANSPORT\FARRELL TRANSPORT - I.T\Print` → `/mnt/Print`
  - Contains: Contractor Pack (onboarding PDFs), Onboarding (user onboarding pack with HTML parts), WHS documents, Policies & Procedures, Statements, Tenders, Marketing
- `C:\Users\ryans\FARRELL TRANSPORT\FARRELL TRANSPORT - WHS` → `/mnt/FARRELL TRANSPORT - WHS`
  - Contains: 6 WHS categories with 30+ policy PDFs, induction checklists, incident forms, corrective action registers

- **09-PRICING-ENGINE.md** — Approved (all 6 methods + 5 behaviours carry forward, customer rate cards with auto-apply, multi-level margin thresholds, rate review workflow, fuel surcharges as separate lines, credits as negative pricing lines, job type pricing defaults, daysheet-to-pricing flow)

- **10-INVOICING-RCTI.md** — Approved (all scheduling/grouping carry forward, split invoicing completed, full RCTI workflow + deductions, AR approval + credit system as-is, remittance all essential, plus supplier invoices AP, statements, dispute handling, batch billing runs, PDF preview)

- **11-XERO-INTEGRATION.md** — Approved (complete overhaul, bidirectional sync, dynamic account mapping, webhooks + polling fallback, credit note sync, dynamic tax rates, tracking categories, reconciliation dashboard)

- **12-COMPLIANCE-SAFETY.md** — Approved (SafeSpec owns ALL compliance, Nexum = status checks + gates + data push + cached display, no compliance override, includes SafeSpec development note with API requirements and implementation priority)

- **13-COMMUNICATIONS.md** — Approved (unified comms service, push as primary real-time, SMS standardised to 1–2 providers, email for formal only, WebSocket replaces PostgreSQL NOTIFY, rethought notification types, unified templates, communication log)

- **14-PORTAL.md** — Approved (same-app portal routes, contractor + customer roles only, drivers use DriverX, contractors get full self-management with document approval workflow, customers get full self-service including job requests + financials + reporting + disputes, Better Auth unified, Sales CRM noted as future module)

- **15-DOCUMENTS.md** — Approved (human-readable S3 paths by entity name, standard file naming convention, full document manager UI with folder tree + file operations + bulk actions, version control, metadata auto-sync, sharing, expiry tracking, PDF generation, audit logging)

- **16-AI-AUTOMATION.md** — Approved (provider-flexible AI, 8 AI features all tenant-configurable, BullMQ for all background jobs, lightweight workflow engine for tenant-configurable automation rules)

- **17-REPORTING-ANALYTICS.md** — Approved (all reports carry forward, dashboard, custom report builder, scheduled delivery, AI-powered reporting)

- **18-ADMINISTRATION.md** — Approved (two admin levels, granular permissions with improved UX, development enforcement, enhanced audit, session management, onboarding wizard)

- **19-MAP-PLANNING.md** — Approved (Google Maps, real-time GPS, geofencing, route planning, backhaul with AI learning, regions)

- **20-DRIVERX.md** — Approved (separate repo, React Native, full driver hub, offline-first, API contract with versioning, push notifications)

- **21-TECHNICAL-ARCHITECTURE.md** — Approved (DigitalOcean exclusively Sydney region, pnpm + Turborepo monorepo mirroring SafeSpec, Fastify + Drizzle ORM + Better Auth + BullMQ + WebSocket, schema-per-tenant multi-tenancy, API-first with REST + OpenAPI + webhooks, shared dev server with SafeSpec, Stripe billing, monitoring/observability, ABN Lookup API)

- **22-DEVELOPMENT-WORKFLOW.md** — Approved (mirror SafeSpec git workflow exactly, comprehensive testing from day one with Vitest + Playwright, full CI pipeline with permission audit enforcement, CLAUDE.md with slash commands + skills + plugins + strict type enforcement as #1 rule)

### ALL 23 DOCUMENTS (00-22) NOW COMPLETE AND APPROVED

### Decisions made this session: DEC-001 through DEC-146 (see DECISION-LOG.md)

---
