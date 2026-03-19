# 14 — Portal

> External access for contractors and customers within the main Nexum web application.

## Overview

The portal is not a separate application. It's a set of role-based views within the same Nexum web app, accessed via dedicated routes (e.g. `/portal/contractor/`, `/portal/customer/`). Contractor and customer users log in with the same Better Auth system as internal users but see only their portal views based on their role.

This replaces Nexum's separate portal application and separate `portal_users` table. One auth system, one app, role-scoped access.

## Portal Roles

### Contractor Portal

Contractors get full self-service access to manage their relationship with the tenant.

**Driver Management:**
- Add and remove their own drivers (tenant is notified of changes)
- Update driver details, contact info, licence information
- Set driver availability (available, unavailable, on leave — with date ranges)
- Upload driver documents (licences, inductions, medicals) — pending tenant approval before active in system
- View driver job history and performance

**Asset Management:**
- Add and remove their own assets (tenant is notified of changes)
- Update asset details, registration, category/subcategory
- Set asset availability and status
- Upload asset documents (registration, insurance, compliance) — pending tenant approval before active in system
- View asset job history and utilisation

**Financial:**
- View RCTIs — full history with status (draft, approved, sent, paid)
- View deductions with reasons and supporting documents
- View payment history and remittance advice
- Download PDF copies of all financial documents
- View running balance and statement

**Jobs & Operations:**
- View jobs their drivers/assets are allocated to
- See scheduling for their resources (upcoming allocations)
- View completed job details and daysheet summaries
- Submit docket images and data for their drivers' work

**Communications:**
- Receive notifications relevant to their operations (new allocations, RCTI ready, payment received)
- Message thread with tenant (structured, logged communication)

### Customer Portal

Customers get full self-service access to their operational and financial relationship with the tenant.

**Job Requests:**
- Submit new job requests through the portal
- Specify requirements: locations, materials, quantities, dates, asset types needed
- Attach documents (plans, permits, site requirements)
- Tenant receives request, reviews, and converts to a job (or declines with reason)
- Track request status (submitted, under review, quoted, accepted, declined)

**Job Tracking:**
- View all their jobs — active, scheduled, completed
- Real-time status updates on active jobs
- View allocations (which assets/drivers are assigned)
- View daysheet summaries and delivery records
- Filter and search across all jobs

**Project Views:**
- View projects and their constituent jobs
- Project-level progress and summaries
- Material delivery tracking against project quantities

**Financial:**
- View invoices — full history with status
- Download invoice PDFs with attached dockets
- View statements with ageing breakdown
- Accept or dispute invoices (with reason and notes)
- View credit notes
- Accept quotes and convert to jobs

**Reporting:**
- Running reports on jobs, deliveries, and materials
- Project-level reports (quantities delivered, costs, timelines)
- Custom date range filtering
- Export to CSV/PDF

**Documents:**
- Access shared documents (site plans, permits, agreements)
- Download docket images and delivery records

**Communications:**
- Receive notifications (job updates, invoice ready, quote sent)
- Message thread with tenant

### Future: Sales CRM Portal

A sales/CRM portal role is planned as a future module — not part of the initial build. This would provide lead management, pipeline tracking, and sales-focused views. No further detail at this stage.

## Authentication & Access

### Single Auth System

Portal users authenticate through the same Better Auth system as internal users. No separate credentials table or login flow.

**User creation flow:**
1. Tenant creates a portal user in admin, assigns role (contractor or customer)
2. User is linked to their business entity (`business_companies` record)
3. User receives invitation email with setup link
4. User creates their account (or is matched to an existing Better Auth account if they use the same email across tenants)

**Role-based routing:**
- On login, the system checks the user's role
- Internal users → main application
- Contractor users → `/portal/contractor/` views
- Customer users → `/portal/customer/` views
- A user cannot have both internal and portal roles for the same tenant

### Entity Scoping

Portal users are scoped to their linked business entity:
- A contractor user sees only their own drivers, assets, jobs, and financials
- A customer user sees only their own jobs, invoices, projects, and reports
- All queries are filtered by both `company_id` (tenant) AND the linked `business_companies.id`

### Multi-User per Entity

Multiple users can be linked to the same business entity:
- A contractor company might have an operations manager and an accounts person
- A customer might have a project manager and a finance team member
- Each user has their own login, but they see the same entity data
- Future consideration: per-user permission granularity within the entity (e.g. finance user can't see operations, ops user can't see invoices)

## Tenant Control

### Portal Feature Toggles

Tenants control which portal features are enabled:
- Enable/disable contractor portal entirely
- Enable/disable customer portal entirely
- Toggle specific features within each portal (e.g. disable job requests for customers, disable docket submission for contractors)
- Feature toggles are tenant-level settings in admin

### Branding

Tenants can customise the portal appearance:
- Company logo on portal pages
- Primary brand colour
- Custom welcome message
- No full white-labelling in initial build — future consideration

### Notifications

Tenants configure which portal events generate notifications:
- New job request from customer → notify operations team
- Contractor updated driver availability → notify scheduler
- Customer disputed invoice → notify finance team
- RCTI ready for contractor → notify contractor portal users
- Configurable per event type

## Data Visibility Rules

### What Contractors See

| Data | Visibility |
|------|-----------|
| Their drivers | Full details, editable |
| Their assets | Full details, editable |
| Job allocations | Read-only — job details, locations, materials, timing |
| Daysheets | Summary (not raw financial data) |
| RCTIs | Full detail including line items |
| Deductions | Full detail with reasons |
| Payments | Amount, date, remittance reference |
| Other contractors | Nothing — completely isolated |

### What Customers See

| Data | Visibility |
|------|-----------|
| Their jobs | Full operational detail (not cost breakdowns) |
| Their projects | Full detail including material tracking |
| Invoices | Full detail including line items and attached dockets |
| Statements | Full with ageing |
| Quotes | Full detail, accept/decline actions |
| Allocated resources | Asset type and driver name only — no rego, rates, or contractor info |
| Other customers | Nothing — completely isolated |

**Key restriction:** Customers never see cost data, contractor rates, or margin information. They see their own pricing only.

## Real-Time Updates

Portal users receive real-time updates via the same WebSocket infrastructure as internal users (doc 13):
- Job status changes push to customer portal
- New allocations push to contractor portal
- Financial document availability pushes to both
- Portal users subscribe to channels scoped to their entity

## Document Approval Workflow

Documents uploaded by contractors through the portal do not become active in the system immediately. They require tenant approval first.

**How it works:**
- Contractor uploads a document (driver licence, asset registration, insurance certificate, induction, medical, etc.)
- Document enters a "pending approval" state — visible to the contractor as "Awaiting review"
- Tenant receives a notification that a document needs review
- Tenant reviews the document in an approval queue: approve, reject (with reason), or request resubmission
- Only approved documents are active in the system and count toward compliance checks (if SafeSpec is connected)
- Rejected documents show the reason to the contractor so they can resubmit

**Approval queue for tenants:**
- Centralised view of all pending portal document submissions
- Grouped by contractor for efficient batch review
- Document preview without downloading
- One-click approve, reject with reason required
- Notifications to contractor on approval/rejection

This ensures the tenant maintains control over what enters their system while still letting contractors self-serve the upload process.

## Contractor Docket Submission

Contractors can submit docket data for their drivers' work:
- Upload docket images (weighbridge tickets, tip receipts)
- Enter basic docket data (date, job reference, quantities)
- AI docket reading (doc 08) applies to portal-submitted images
- Submitted dockets enter the same processing pipeline as internally-entered dockets
- Contractor sees submission status (submitted, processed, queried)

## Customer Job Requests

The job request workflow:
1. Customer fills out request form (locations, materials, quantities, dates, requirements)
2. Request lands in tenant's queue with customer details
3. Tenant reviews — can convert to job, send quote first, or decline with reason
4. If quoted: customer accepts/declines in portal → accepted quote converts to job
5. Customer tracks the resulting job through the portal

Requests are not jobs until the tenant converts them. They're a structured way for customers to communicate requirements.

## Activity Logging

All portal activity is logged for audit:
- Login/logout events
- Data views (what was accessed)
- Submissions (dockets, job requests, dispute raises)
- Document downloads
- Changes made (contractor self-management actions)

Tenants can review portal activity logs in admin.

## Mobile Responsiveness

The portal must be fully responsive. Contractor operations managers and customer project managers frequently access from mobile devices. The portal routes use the same responsive design system as the main app.

## Migration from Nexum

Nexum's `portal_users` migrate to Better Auth accounts with portal roles. The separate portal authentication is eliminated. Entity links (`linked_entity_id`) map to `business_companies.id` references.
