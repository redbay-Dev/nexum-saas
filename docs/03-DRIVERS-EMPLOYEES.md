# 03 — Drivers & Employees

## Overview

Nexum manages people in several contexts. Not every person is a driver, and not every employee is a user of the system. The key distinction:

- **Employees** — Anyone employed by the tenant: drivers, yard staff, mechanics, admin, management. Full employee records with onboarding, compliance, and qualification tracking.
- **Drivers** — A subset of employees who operate vehicles. Drivers carry additional data: licences, medical fitness, vehicle qualifications, timesheets, and access the system via DriverX (native mobile app).
- **Contractor drivers** — Drivers employed by a contractor who operate within the tenant's system. Carry the same core data as tenant drivers but without timesheets (contractor manages their own pay). Tracked for compliance and scheduling purposes.
- **Users** — People with login accounts who access the web interface. Not all employees are users (a driver might only use DriverX), and not all users are employees (a system admin might not be on the payroll).

These are overlapping categories, not exclusive ones. A person can be an employee AND a driver AND a user.

## Employee Management

Every employee of the tenant gets a record in the system regardless of their role. This is the foundation that driver-specific, compliance, and operational data builds on.

### Employee record contents
- Personal details: full name, date of birth, contact phone, email, home address
- Employment details: position/role title, employment type (full-time, part-time, casual, salary, wages), start date, department/team
- Emergency contacts: at least one, with relationship and contact details
- Tax and super: TFN declaration status, superannuation fund details (for payroll export — Nexum doesn't process payroll)
- Status: active, on leave, suspended, terminated

### What Nexum does NOT do
Nexum is not a payroll system and is not an HR system. Pay processing, leave balance management, employment contracts, and performance reviews stay in the tenant's payroll/HR system (typically Xero or a dedicated HR platform). Nexum captures enough employee data for:
- Operational management (who's available, what can they do)
- Compliance tracking (are they qualified, inducted, current on training)
- Timesheet capture (hours classified for payroll export)
- Onboarding workflow (getting new employees set up and compliant)

The boundary is clear: Nexum captures and classifies hours and compliance, then exports to payroll. It doesn't calculate pay or manage leave.

## Employee Onboarding

Employee onboarding follows the same configurable checklist pattern as contractor onboarding (see doc 02). The tenant defines onboarding steps per employee role — a driver's onboarding is different from a yard worker's onboarding.

### Configurable per role
The tenant creates onboarding templates for each position type:
- **Driver onboarding** — Licence verification, medical fitness declaration, vehicle familiarisation, fatigue management training, WHS induction, DriverX setup
- **Yard staff onboarding** — Site induction, equipment training, WHS induction, PPE issue
- **Mechanic onboarding** — Qualifications verification, workshop induction, WHS induction, tool inventory
- **Admin/office onboarding** — System access setup, role-specific training, policy acknowledgements

These are examples — the tenant defines whatever steps make sense for their operation.

### Onboarding status
Same living status model as contractor onboarding:
- **Incomplete** — Not all required steps done. May be blocked from certain duties.
- **Complete** — Fully onboarded and operational.
- **Requires attention** — Something has expired or changed (licence renewal due, training lapsed).

### Induction checklists
The FTG WHS document library includes separate induction checklists for drivers, operations staff, and subcontractors. The system supports:
- Configurable induction checklists per role
- Completion tracking with sign-off (who completed, who verified, when)
- Policy acknowledgement tracking (which policies were acknowledged, when, by whom)
- Re-induction triggers (e.g., after 12 months, after an incident, after a policy change)

## Drivers

A driver is an employee with additional data and capabilities specific to operating vehicles.

### Driver-specific data

**Licences:**
- Heavy vehicle licence class (HR, HC, MC, etc.)
- Licence number, state of issue, expiry date
- Licence conditions or restrictions
- Licence history (previous classes, upgrades)

**Medical fitness:**
- Medical declaration status
- Medical certificate details and expiry
- Any medical conditions affecting driving capability

**Qualifications and competencies (fully configurable by tenant):**
The tenant defines whatever qualification types they need. Common examples:
- Construction induction card (blue/white card) — number, state, expiry
- Operator tickets (forklift, crane, excavator, etc.)
- Dangerous goods licence
- Pilot/escort vehicle certification
- Site-specific inductions (some customer sites require their own induction)
- Fatigue management training
- Load restraint certification
- First aid certification

Each qualification type is defined by the tenant with: name, whether it expires, required evidence (document upload), and any notes. The system tracks current status, expiry dates, and alerts when renewals are due.

**Vehicle qualifications:**
- What vehicle types/configurations this driver is qualified to operate
- Any vehicle-specific restrictions
- Training records for specific vehicles

**Compliance status:**
At a glance: is this driver compliant to work? This aggregates licence validity, medical fitness, required qualifications, and training currency into a single status. Visible in scheduling, job assignment, and driver lists. A driver with an expired medical can't be assigned to a job.

### Contractor drivers

Contractor drivers carry the same core data as tenant drivers: licences, medical, qualifications, compliance status. The key differences:

- **No timesheets** — The contractor manages their own driver pay. Nexum doesn't track contractor driver hours. This is tenant-configurable in case some tenants do want to track contractor driver time for operational purposes.
- **Managed by contractor** — The contractor can manage their driver records via the portal (same self-service model as contractor documents — see doc 02). Tenant retains full override capability.
- **Linked to contractor** — A contractor driver is always associated with their parent contractor company.
- **Same scheduling treatment** — In the scheduler, a contractor driver is treated the same as a tenant driver. The scheduler cares about availability, qualifications, and compliance — not employment status.

## Timesheets

Timesheets track tenant employee driver hours with enough detail to export to a payroll system for award interpretation and pay calculation.

### What timesheets capture
Timesheets are classified into time categories that align with Australian transport award structures:

- **Ordinary hours** — Standard hours within the award's ordinary time band
- **Overtime tier 1** — First tier of overtime (typically first 2-3 hours after ordinary)
- **Overtime tier 2** — Second tier of overtime (after tier 1 threshold)
- **Weekend rates** — Saturday and Sunday work at applicable rates
- **Public holiday** — Work performed on gazetted public holidays
- **Meal breaks** — Paid and unpaid break periods
- **Travel time** — Time travelling to/from sites if applicable under the award
- **Standby/waiting** — Time spent waiting at sites between loads
- **Other** — Tenant-configurable additional categories

### How time is captured
- **From jobs:** Time spent on jobs is captured automatically when a driver starts/completes docket loads via DriverX. Job time feeds into the timesheet.
- **Manual entry:** For non-job time (yard work, training, meetings), drivers or admin can enter time manually.
- **Timesheet review:** A supervisor or admin reviews and approves timesheets before export.

### Award interpretation
Nexum does NOT calculate pay. It captures hours classified into the categories above, then exports the data to the tenant's payroll system. The export includes:
- Driver details
- Date and time records
- Time classifications (ordinary, OT1, OT2, weekend, PH, etc.)
- Associated job references where applicable
- Break records

The payroll system (Xero, MYOB, or dedicated payroll) applies the actual award rates and calculates gross pay. The classification is the value Nexum adds — turning raw hours into payroll-ready categorised time.

### Tenant-configurable
The time categories, overtime thresholds, and classification rules are tenant-configurable. Different tenants may operate under different awards or enterprise agreements with different hour thresholds and categories.

## Driver Access via DriverX

Drivers interact with the system through DriverX (React Native mobile app). Within the context of driver management, DriverX provides:

- **Job visibility** — See assigned jobs, schedule, site details, entry point instructions
- **Docket submission** — Capture and submit delivery dockets with photos from the field
- **Timesheet entry** — Log start/finish times, breaks, non-job time
- **Compliance self-service** — View their own compliance status, upload renewed licences/certificates, complete training acknowledgements
- **Notifications** — Push notifications for new job assignments, schedule changes, entry point updates, compliance expiry alerts

Full DriverX specification is in doc 20.

## Scheduling and Availability

From a scheduling perspective, every driver (tenant or contractor) has:

- **Availability status:** Available, unavailable, on leave, on a job
- **Region assignment:** Which region(s) they typically work in
- **Vehicle qualifications:** What they can drive — the scheduler only offers drivers qualified for the vehicle assigned to a job
- **Compliance gate:** Only compliant drivers appear as available for scheduling

The scheduler doesn't distinguish between tenant and contractor drivers in the allocation UI. A driver is a driver — available, qualified, compliant, in the right region.

## What's Different from Nexum

| Aspect | Nexum | Rebuild |
|--------|-------|---------|
| Scope | Drivers only | Full employee management — any position |
| Employee onboarding | Not structured | Configurable onboarding checklists per role |
| Qualification types | Predefined set | Fully tenant-configurable |
| Contractor drivers | Lighter record | Same data as tenant drivers, minus timesheets (configurable) |
| Timesheets | Basic time tracking | Classified hours with award-aligned categories, payroll export |
| Award interpretation | Not supported | Captures classified hours for payroll export (doesn't calculate pay) |
| Driver compliance | Manual checking | Aggregated compliance status gating scheduling |
| Driver access | Web portal | DriverX native mobile app |
| Employee types | Driver or nothing | Driver, yard staff, mechanic, admin — any role |

---

*Status: Approved — reviewed and approved by Ryan*
*Created: 2026-03-19 | Session 1*
