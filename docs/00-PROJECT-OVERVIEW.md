# 00 — Project Overview

## What Is This Project?

Nexum is a business management platform for the Australian heavy vehicle transport and logistics industry. It manages the complete operational lifecycle: from job creation and resource scheduling through to docket processing, invoicing, compliance, and financial reconciliation.

This document describes the rebuild of Nexum as a modern web-based SaaS, replacing the current Electron desktop application (v0.49.0). The rebuild follows the same architectural patterns established in the SafeSpec project (pnpm monorepo, Turborepo, Fastify, Drizzle ORM, React + shadcn/ui) and is designed so that compliance modules can eventually be shared between the two products.

## Who Is It For?

Nexum serves transport and logistics operators running fleets of all sizes, with a particular focus on companies operating 50+ trucks. These range from single-depot operations with large fleets to multi-depot, multi-region companies with separate teams at each location. The system must handle both without assuming either.

The typical users within these companies are:

- **Dispatchers/Operations** — Creating jobs, scheduling assets and drivers, managing daily workflow
- **Admin/Accounts** — Processing dockets, generating invoices, managing RCTI, reconciling with Xero
- **Compliance Officers** — Managing NHVAS accreditation, WHS obligations, CoR responsibilities, audit preparation
- **Management** — Reporting, analytics, oversight of operations and financials
- **Drivers** (via DriverX native mobile app) — Viewing assigned jobs, submitting dockets, managing their compliance records. DriverX is a separate native mobile app currently in development — Nexum provides the API it consumes
- **Contractors** (via portal) — Accessing their jobs, viewing payments, maintaining compliance documentation

## The Three Pillars

Nexum must excel equally at three things. These are inseparable — the system fails if any one is weak:

### 1. Get Jobs Done and Invoiced Fast
The speed from "customer needs something moved" to "money in the bank" is the core value proposition. Every feature should be evaluated against whether it makes this pipeline faster or slower. If a feature adds steps without adding value to this pipeline, it doesn't belong in the core product.

### 2. Keep Operators Compliant
NHVAS, WHS, Chain of Responsibility, fatigue management, drug and alcohol testing, vehicle maintenance, defect management — Australian heavy vehicle operators face serious regulatory obligations. Non-compliance means fines, loss of accreditation, and in worst cases, criminal liability. The system must make compliance a byproduct of normal operations, not a separate chore.

### 3. Reduce Admin Overhead
Transport operators want to move freight, not push paper. Every manual step that can be automated should be. Docket processing, invoice generation, compliance record keeping, contractor payments — these should happen with minimal human intervention. The system should surface what needs attention, handle the rest automatically.

## Product Shape: Modular with Core + Add-ons

The system is structured as a core product with optional modules that tenants enable based on their needs.

### Core (every tenant gets this)
- **Jobs** — Creation, lifecycle, workflow, completion
- **Business Entities** — Customers, contractors, suppliers, contacts, addresses
- **Scheduling** — Resource allocation, asset and driver assignment, conflict handling
- **Dashboard** — Role-appropriate overview of what needs attention today

### Modules (enabled per tenant)
- **Invoicing** — Invoice generation, credit management, AR tracking
- **RCTI** — Recipient Created Tax Invoices, remittance, contractor payments
- **Xero Integration** — Bidirectional accounting sync
- **Compliance** — NHVAS, WHS, CoR, fatigue, drug testing, defects, prestarts (designed as a shared package that SafeSpec can also consume)
- **SMS** — Multi-provider messaging, templates, conversations
- **Docket Processing** — Digital docket capture, approval workflows, verification
- **Materials Management** — Material types, pricing behaviour, disposal, supplier relationships
- **Map Planning** — Route planning, backhaul detection, geofencing
- **AI Automation** — AI-powered job parsing, review, and automation
- **Reporting & Analytics** — Financial, compliance, and performance reporting
- **Portal** — Web-based external access for contractors (drivers use the DriverX native mobile app instead)

### Why Modular?
- A small operator who manages compliance in spreadsheets and invoices through Xero shouldn't be forced to navigate compliance dashboards and RCTI screens they don't use
- Modules can be priced separately, creating a natural upgrade path
- Teams working on compliance modules can develop independently of teams working on financial modules
- The compliance module specifically needs to be a standalone package so SafeSpec can share it

## Guiding Principles

### 1. Simple by Default, Powerful When Needed
Every screen starts simple. Advanced features are available but not in your face. A dispatcher creating a routine job should be able to do it in under 30 seconds. A compliance officer preparing for an audit should have everything they need in one place. Same system, different depths.

### 2. Automate the Obvious
If the system can figure out the answer without asking the user, it should. Default pricing from rate cards. Auto-suggest assets based on region and availability. Pre-fill compliance records from previous entries. Generate invoices from completed dockets without manual line-item entry.

### 3. No Feature Without a Reason
The current Nexum has features that exist because they were built, not because they were needed. Every feature in the rebuild must answer: "What user problem does this solve?" and "How does this make the job-to-invoice pipeline faster, keep the operator compliant, or reduce their admin?"

### 4. Small Files, Clear Boundaries
No file exceeds its type-specific limit. No component does two things. No service knows about things it shouldn't. When code needs to be changed, developers should know exactly which file to open and be confident that changing it won't break something unrelated.

### 5. Test Everything That Matters
Financial calculations, pricing logic, compliance rules, workflow state transitions — these must have automated tests. A pricing bug that makes it to production can cost a transport company real money. A compliance gap can cost them their accreditation.

### 6. Works on Any Device
Dispatchers are at desks. Drivers are in trucks with phones. Site managers are on tablets. The system must work on all of them. Not "has a mobile app" — the same web interface must be responsive and usable on any screen size.

## Relationship to SafeSpec

SafeSpec and Nexum are separate products serving different but overlapping markets:

- **SafeSpec** focuses on WHS compliance, HVA (Heavy Vehicle Accreditation, the successor to NHVAS), and fleet maintenance as a dedicated compliance SaaS
- **Nexum** is a full business management platform where compliance is one module among many

The shared ground is compliance. The compliance module architecture must be designed as a standalone package (`@redbay/compliance-shared`) that both products can import. This is scoped under `@redbay` (not `@nexum` or `@safespec`) because it belongs to neither product — it's shared infrastructure owned by Redbay Development. This means:

- Compliance schemas, services, and UI components live in their own package
- Both SafeSpec and Nexum consume this package
- Legislation updates, form template changes, and regulatory requirement updates are made once and flow to both products
- The compliance package has its own test suite, independent of either product

This shared-package approach is a key architectural requirement that influences how the monorepo is structured and how compliance features are built.

## What's Different from Current Nexum

| Aspect | Current Nexum | New Nexum |
|--------|--------------|-----------|
| **Deployment** | Electron desktop app installed on each machine | Web-based SaaS accessible from any browser |
| **Architecture** | Monolithic single project with IPC handlers | Monorepo with separate backend, frontend, shared packages |
| **Backend** | Electron main process with 1,120+ IPC handlers | Fastify REST API with grouped routes and Zod validation |
| **Database** | Raw SQL with manual parameter indexing | Drizzle ORM with type-safe queries and generated migrations |
| **Multi-tenancy** | `company_id` column filtering on every query | Schema-per-tenant isolation |
| **Testing** | None | Vitest + Testing Library + Playwright from day one |
| **Product shape** | Everything-at-once monolith | Modular core + optional add-ons |
| **User experience** | Complex pages showing everything | Progressive disclosure — simple by default, advanced when needed |
| **Real-time** | Three overlapping systems (LISTEN/NOTIFY, polling, sync service) | WebSocket with cache invalidation |
| **File sizes** | Files up to 5,000 lines | Hard limits enforced by linting |
| **Portal** | Separate system | Contractor portal = same app with role-based views; Driver access = DriverX native mobile app consuming Nexum's API |
| **Compliance** | Built into Nexum only | Shared package usable by both Nexum and SafeSpec |

## Known User Pain Points to Solve

From experience with current Nexum users:

1. **Too many screens and clicks** — Simple tasks require too many steps. The UI presents all options at once instead of guiding users through common workflows.
2. **Things are hard to find** — Features exist but users can't discover them or remember where they are. Navigation doesn't match how users think about their work.
3. **Performance and reliability** — The Electron app has performance issues and sync problems. A properly architected web app with server-side processing eliminates this class of issues.
4. **Desktop-only access** — Field staff, drivers, and site managers can't access the system from mobile devices. The limited portal doesn't cover their needs.
5. **Feature overwhelm** — Users see complexity they don't need. A compliance officer shouldn't see pricing configuration. A dispatcher shouldn't see audit logs. The modular approach and role-based dashboards address this directly.

---

*Status: Approved — reviewed and approved by Ryan*
*Created: 2026-03-19 | Session 1*
