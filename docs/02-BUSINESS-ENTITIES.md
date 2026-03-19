# 02 — Business Entities

This document covers the detail of each business entity type: customers, contractors, and suppliers. The underlying company model (unified table with role tags, tabbed UI) is defined in doc 01. This document focuses on what each role carries, how entities are onboarded, and what changes from Nexum.

## Customers

A customer is any company that hires the tenant to move materials or perform transport work. They are the source of jobs and the destination of invoices.

### Customer-specific data
- **Credit terms:** Payment terms and credit limit. The specific term options (7 days, 14 days, 30 days, EOM, etc.) should be tenant-configurable — not hardcoded. Different tenants operate with different payment structures.
- **Default pricing:** Link to a rate card or pricing template that auto-populates when creating jobs for this customer. Can be overridden per job.
- **Invoice preferences:** How they want to receive invoices (email, portal, post), preferred format, billing contact, PO number requirements
- **Job sites:** The customer's addresses where work is performed (linked via address model — see doc 01). A customer with 20 construction sites has 20 address records.
- **Job history:** All jobs created for this customer, accessible from the customer profile
- **Financial summary:** Outstanding balance, credit usage, payment history

### Customer credit system
The credit system goes beyond just setting a limit. It needs to be a full account management capability:

- **Credit limit:** Maximum outstanding amount. Tenant-configurable per customer.
- **Credit hold:** Temporarily block new jobs for this customer. Existing jobs continue but no new work is created. Used when a customer is behind on payments.
- **Credit stop:** Hard stop — no new jobs, flags existing in-progress work for review. Used for serious payment issues.
- **Credits on account:** The ability to apply credits to a customer's account. Credits can come from overpayments, disputes, adjustments, or goodwill. Credits reduce the outstanding balance and can be applied against future invoices.
- **Credit status visibility:** The customer's credit status (clear, approaching limit, on hold, stopped) must be visible wherever the customer is referenced — in job creation, on the dashboard, in the customer list. A dispatcher should see immediately if a customer has credit issues before creating a job.

### Customer in the UI
The customer tab on a company record shows: credit status at a glance (with clear/hold/stop indicators), active jobs, recent invoices, credits on account, their sites on a map, and their rate card. A dispatcher creating a job for this customer should be able to see everything they need without leaving the job creation flow.

## Contractors

A contractor is an external operator who performs transport work on behalf of the tenant. They bring their own assets (trucks/trailers) and often their own drivers. The relationship is complex — contractors need rates, payments, compliance tracking, and resource management.

All three aspects of contractor management are equally important and must work together:

### 1. Rates and Payments
- **Rate cards:** What the tenant pays the contractor for different types of work. Can be per-tonne, per-load, per-hour, or per-km. Rates can be material-specific, route-specific, or general.
- **Payment terms:** How and when the contractor gets paid
- **RCTI preferences:** Whether they receive RCTI (Recipient Created Tax Invoices), their remittance details, bank account for payments
- **Payment history:** Full record of what's been paid, what's pending, what's in dispute

### 2. Compliance Status
- **Insurance:** Public liability, vehicle insurance, workers comp — with expiry tracking and alerts
- **Licences and accreditations:** NHVAS accreditation, relevant licences, accreditation status
- **Compliance documents:** Uploaded certificates, policies, and evidence
- **Compliance status flag:** At a glance, is this contractor compliant to work? This must be visible wherever a contractor is referenced — in scheduling, in job assignment, in the contractor list. If a contractor's insurance has expired, the system should warn before assigning them work.

### Contractor self-service document management
Contractors must be able to manage their own documentation independently through the portal. This is critical for keeping compliance data current without burdening the tenant's admin staff.

- **Contractors upload and update:** Via the portal, contractors upload insurance certificates, licence copies, accreditation evidence, vehicle registration documents, and any other required documentation.
- **Tenant can manage independently too:** The tenant has full override capability. Tenant staff can upload documents on behalf of a contractor, edit or replace anything the contractor has submitted, and manage a contractor's documentation directly if needed. The contractor self-service doesn't remove the tenant's ability to do it themselves — it supplements it.
- **Tenant approval workflow:** When a contractor uploads or updates a document, it doesn't go live immediately. The relevant tenant staff member receives a notification (email + in-app) and must review and approve the change.
- **History tracking:** Every document version is retained. The system tracks who uploaded what (contractor or tenant staff), when it was approved, who approved it, and what the previous version was. Full audit trail regardless of who made the change.
- **Expiry alerts to both parties:** When a document is approaching expiry, both the contractor (via portal/email) and the relevant tenant staff (via notification) are alerted. The contractor can upload a renewal, the tenant approves it.
- **Notifications to relevant staff:** Document uploads, approvals, and expiry alerts are routed to the appropriate tenant staff — not broadcast to everyone. The system needs configurable notification routing based on document type and contractor.

### Contractor account items
Contractors have a financial account with the tenant that goes beyond just RCTI payments. The tenant may need to:

- **Add charges to a contractor's account:** Items like truck parking fees, fuel supplied, admin charges, damage recoveries, or any other costs the tenant passes on to the contractor.
- **Reverse or credit RCTI deductions:** If a deduction was made incorrectly (e.g., wrong fuel charge, disputed parking fee), the tenant needs to reverse or credit it on the contractor's account.
- **Account statement:** The contractor should be able to see a clear statement of their account: RCTI payments, deductions, additional charges, credits, and net balance. Visible through the portal.
- **Configurable charge types:** The types of extra charges (parking, fuel, equipment hire, etc.) should be tenant-configurable. Different operators have different cost structures they pass through to contractors.

This keeps the contractor financial relationship clean and transparent — the contractor can see exactly what they're being paid and what's being deducted, and the tenant has a clear record of all transactions.

### 3. Available Resources
- **Contractor assets:** The trucks, trailers, and equipment a contractor can provide. These appear in the scheduling system alongside the tenant's own fleet.
- **Contractor drivers:** Drivers employed by the contractor who may operate in the tenant's system

### Contractor asset improvements over Nexum
In Nexum, contractor assets have multiple problems: poor visibility into what's actually available vs what's in the system, messy compliance/documentation tracking on contractor vehicles, and unclear availability that makes scheduling difficult. The rebuild must address:

- **Clear availability status:** Each contractor asset has an explicit availability state (available, in use, unavailable, under maintenance). Contractors should be able to update this via the portal.
- **Compliance parity with tenant assets:** Contractor assets need the same registration, insurance, and inspection tracking as the tenant's own fleet. Expired rego or insurance makes the asset unschedulable.
- **Scheduling integration:** Contractor assets must schedule as smoothly as tenant-owned assets. The scheduler shouldn't care who owns the truck — it cares whether the truck is available, compliant, and in the right region.
- **Contractor visibility:** Contractors should be able to see (via portal) what assets of theirs are in the tenant's system and update availability, documents, and details.

## Suppliers

A supplier provides materials to the tenant's operations. They operate quarries, processing plants, and storage facilities. The supplier model in Nexum is solid and carries forward with a cleaner implementation.

### Supplier-specific data
- **Material catalog:** What materials this supplier provides, with pricing per material
- **Supply sites:** The supplier's addresses where materials are sourced from (quarries, plants, yards). Materials are linked to these addresses, not to the supplier directly — this is the correct Nexum pattern preserved.
- **Supply pricing:** What the tenant pays for materials from this supplier. Can vary by material, volume, and site.
- **Delivery terms:** Whether the supplier delivers or the tenant collects, lead times, minimum orders

### Supplier and disposal overlap
Suppliers and disposal sites are often the same entity. A quarry supplies materials AND accepts waste/fill. This is handled naturally by the unified company model — the same company has both a supplier role and a customer role (or a specific "disposal" flag). The address-level material tracking handles what goes in and what comes out at each site.

## Onboarding Workflows

Both customers and contractors go through an onboarding process when added to the system. This is not just "create the record" — there are setup steps required before the entity is fully operational.

### Onboarding checklists are configurable per tenant
Each tenant defines their own onboarding requirements. A large operator with strict compliance needs will have a longer checklist than a small operator. The system provides sensible defaults but the tenant controls what's required.

### ABN Lookup (Australian Business Register)

When creating any business entity, the system integrates with the Australian Business Register (ABR) API to auto-populate company details from their ABN.

**Two lookup modes:**
- **Search by name** — Type a business name, optionally filter by state, get matching businesses with ABN, entity type, trading name, location
- **Search by ABN** — Enter an 11-digit ABN, get full business details including entity name, legal name, trading names, entity type, GST registration status, and business address

**Auto-population:** When a user selects a result from the ABN search, the system pre-fills the company form — entity type, GST status, trading name, postcode, state. Reduces manual entry and ensures ABN accuracy.

**Where it's used:** Customer creation, contractor creation, supplier creation — anywhere a business entity is being added. The ABN search is integrated directly into the company form as a search-as-you-type dropdown.

**API details:** ABR XML Search API. API key stored encrypted per tenant in integration settings. Usage tracked for monitoring.

### Customer onboarding (typical steps)
1. Basic details: company name, ABN, trading name (auto-populated via ABN lookup)
2. Contacts: primary contact, accounts contact, site contacts
3. Addresses: head office, job sites
4. Credit setup: payment terms, credit limit, approval if required
5. Pricing: assign a rate card or set up custom pricing
6. Invoice preferences: delivery method, billing contact, PO requirements

### Contractor onboarding (typical steps)
Contractor onboarding is significantly more involved than customer onboarding. Real-world onboarding packs (e.g., the FTG Subcontractor Onboarding Pack) include 17+ sections covering legal, compliance, financial, and operational requirements. The system must support digitising this entire workflow. A typical onboarding flow covers:

1. **Document checklist** — What's required before the contractor can start work
2. **Business and contact details** — Company name, ABN, trading name, key contacts (operations, accounts, emergency)
3. **Insurance details** — Public liability, vehicle insurance, workers comp certificates with expiry dates and declarations
4. **RCTI agreement** — Formal agreement for Recipient Created Tax Invoices, signed digitally
5. **GST compliance** — GST registration status and compliance letter
6. **Direct payment / EFT details** — Bank account details for payments
7. **Operator/driver information** — Details for each driver/operator the contractor will supply, including emergency contacts
8. **Licences and certifications** — Driver/heavy vehicle licence details, experience records, medical fitness declarations, construction induction cards (blue/white card), operator tickets and competencies
9. **Vehicle registration** — Registration details for each vehicle the contractor will operate, including rego, VIN, GVM/GCM, configuration type
10. **Plant and machinery** — If applicable, details of plant, buckets, attachments, safety features
11. **Accreditation and compliance** — NHVAS status, fatigue management compliance, mass management, maintenance management
12. **Subcontractor declaration** — Formal declaration of obligations and commitments
13. **Chain of Responsibility (CoR) declaration** — CoR obligations, incident and hazard reporting commitments
14. **Guarantee and indemnity** — Legal indemnity agreement
15. **Agency agreement** — Terms covering services, obligations, fees, insurance requirements, confidentiality, termination
16. **Terms and conditions** — Full terms and conditions of the subcontract arrangement

Not every tenant will require all of these — the checklist is configurable. But the system must support this level of detail when needed. The onboarding system should support digital form completion, e-signatures, document uploads, and progress tracking.

### WHS and contractor onboarding packs
The tenant has extensive document libraries that support onboarding and ongoing compliance. For reference, the current FTG document library includes:

**WHS Document Structure (6 categories):**
1. Policies and Procedures — 30+ documents covering safety, fatigue, mass, maintenance, CoR, drug & alcohol, environmental, training, emergency response, subcontractor management, and more
2. Risk and Hazard Management — Corrective actions register
3. Incident Management — Incident report forms
4. Inductions and Onboarding — Separate checklists for drivers, operations staff, and subcontractors, plus a subcontractor onboarding checklist
5. Training and Competency
6. WHS System and Governance — Policy development guides, WHS system requirements

**Print/Contractor Pack:** The full subcontractor onboarding pack as PDF and HTML, plus user onboarding packs for Nexum itself (with separate HTML parts for each section — cover, TOC, getting started, NHVAS, pre-starts, defects, mass management, fatigue, PBS, contractors, etc.)

The system should support:
- **PDF template generation:** Generating onboarding pack documents pre-filled with known data (company details, contact info, etc.)
- **Digital completion:** Contractors filling in forms and signing digitally through the portal, rather than printing and scanning
- **Pack management:** The tenant defines which documents are included in their onboarding pack. Different contractor types might get different packs.
- **Policy acknowledgement:** Contractors and drivers must acknowledge policies (e.g., WHS policy, CoR declaration) as part of onboarding. The system tracks who has acknowledged what and when.
- **Induction checklists:** Separate configurable checklists for different roles (driver induction, operations induction, subcontractor induction) with completion tracking

### Onboarding status
Each entity has an onboarding status visible in the UI:
- **Incomplete** — Not all required steps are done. The entity can be used for basic operations but may be blocked from certain actions (e.g., a contractor without insurance can't be scheduled).
- **Complete** — All required onboarding steps are done. Fully operational.
- **Requires attention** — Onboarding was complete but something has expired or changed (e.g., insurance expired).

The onboarding checklist is not a one-time thing — it's a living status. If a contractor's insurance expires, their onboarding status drops back to "requires attention" automatically.

## Company Status Lifecycle

Every company (regardless of role) has a status:

- **Active** — Normal operating state
- **On hold** — Temporarily paused. Jobs can't be created, but existing data is preserved. Used for credit issues, compliance lapses, or business disputes.
- **Archived** — No longer active. Hidden from lists and dropdowns by default. All historical data preserved for reporting and audit. Soft delete — never hard deleted.

Archiving a company with outstanding invoices or incomplete jobs should warn the user and require confirmation.

## What's Different from Nexum

| Aspect | Nexum | Rebuild |
|--------|-------|---------|
| Tenant in companies table | Yes (source of bugs) | No — tenant is organisation profile only |
| Entity roles | Boolean flags on one record | Same concept, cleaner implementation with tabbed UI |
| Customer credit | Basic credit limit | Full credit system: limits, hold/stop, credits on account |
| Contractor documents | Managed by tenant staff only | Contractor self-service via portal with tenant approval workflow and full history |
| Contractor account | RCTI payments only | Full account with extra charges (parking, fuel), credits, reversals, statements |
| Contractor assets | Poor visibility, compliance gaps, scheduling friction | Clear availability states, compliance parity, smooth scheduling |
| Onboarding | Create and go | Configurable digital onboarding packs with e-signatures, PDF pre-fill, progress tracking |
| Onboarding status | Not tracked | Living status — expires if compliance lapses |
| Disposal sites | Separate handling | Natural overlap via supplier+customer roles on same entity |
| Company status | Basic active/inactive | Active / On hold / Archived with warnings for outstanding work |
| Credit/payment terms | Hardcoded options | Tenant-configurable term types |

---

*Status: Approved — reviewed and approved by Ryan*
*Created: 2026-03-19 | Session 1*
