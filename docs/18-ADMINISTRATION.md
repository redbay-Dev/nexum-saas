# 18 — Administration

> Users, roles, permissions, tenant settings, platform admin, audit logging, and session management.

## Overview

Administration operates at two levels: **platform admin** (Redbay managing all tenants, subscriptions, and system configuration) and **tenant admin** (each tenant managing their own users, roles, settings, and preferences). Granular permission control is essential but the UX must be dramatically improved over Nexum's confusing interface. Permissions are a first-class development concern — every feature, every endpoint, every UI element must enforce permissions from day one.

## Two Admin Levels

### Platform Admin

The Redbay platform admin manages the SaaS as a whole. This is a separate admin context from tenant administration.

**Tenant management:**
- Create, suspend, reactivate tenants
- View all tenants with subscription status, user counts, storage usage
- Tenant health dashboard (active users, last login, feature usage)
- Manual tenant configuration overrides (feature flags, limits)

**Subscription & billing:**
- Subscription plan management (which modules are available per plan)
- Tenant subscription status (trial, active, suspended, cancelled)
- Usage tracking per tenant (users, storage, API calls, AI usage)
- Billing integration (if applicable)

**System configuration:**
- Default AI provider and API keys
- Global feature flags
- System-wide notification templates
- SMS/email provider configuration
- S3 storage configuration
- Maintenance mode

**Support tools:**
- Impersonate tenant (view as specific tenant for debugging)
- Tenant data export
- System health monitoring
- Error log review

**Platform admin is NOT accessible to tenants.** It's a separate application or route set with its own authentication and permissions.

### Tenant Admin

Each tenant manages their own users, roles, settings, and configuration. This is the admin that tenant staff use day-to-day.

## User Management

### User Lifecycle

1. **Create** — Admin creates user with name, email, and role. Invitation email sent via Better Auth. User sets their own password on first login.
2. **Active** — User logs in, works, permissions enforced on every action.
3. **Update** — Admin updates profile, role, or specific permission overrides.
4. **Deactivate** — Admin deactivates user. User can no longer log in. Data and audit trail preserved.
5. **Reactivate** — Admin can reactivate a deactivated user.
6. **Delete** — Soft delete. User record retained for audit trail but login is permanently disabled.

No admin can delete their own account. No admin can remove the last admin user.

### User Profile

- Full name, email, phone
- Assigned role
- Active/inactive status
- Last login timestamp
- Profile photo (optional)
- Notification preferences (doc 13)
- Dashboard widget preferences (doc 17)

## Roles & Permissions

### The Problem with Nexum

Nexum's permission system has the right fundamentals (granular permissions, custom roles, per-user overrides) but the UX is confusing. Setting up roles is tedious, understanding what a permission actually controls is unclear, and developers frequently forget to add permission checks on new features. The rebuild keeps granular control but fixes the experience.

### System Roles

Pre-defined roles that cannot be modified or deleted:

- **Owner** — Full access to everything including tenant admin. One per tenant (the person who created the account). Can transfer ownership.
- **Admin** — Full access to everything except ownership transfer and billing. Can manage users, roles, and settings.

### Custom Roles

Tenants create custom roles for their team structure. Common examples:

- **Dispatcher** — Jobs, scheduling, assets, drivers. No financial access.
- **Finance** — Invoicing, accounts, pricing, reporting. No job creation.
- **Operations Manager** — Jobs, scheduling, dockets, operational reports. Limited financial access.
- **Read Only** — View everything, change nothing.

But tenants can name roles whatever they want and assign whatever permissions they need.

### Permission Model

Permissions are hierarchical with clear groupings:

```
jobs
  jobs.view
  jobs.create
  jobs.update
  jobs.delete
  jobs.assign
  jobs.approve

scheduling
  scheduling.view
  scheduling.allocate
  scheduling.auto_allocate

dockets
  dockets.view
  dockets.process
  dockets.approve_overage

pricing
  pricing.view
  pricing.manage
  pricing.override_margin

invoicing
  invoicing.view
  invoicing.generate
  invoicing.send
  invoicing.credit

rcti
  rcti.view
  rcti.manage
  rcti.approve
  rcti.send

accounts
  accounts.view
  accounts.manage
  accounts.approve

entities
  entities.customers.view
  entities.customers.manage
  entities.contractors.view
  entities.contractors.manage
  entities.suppliers.view
  entities.suppliers.manage
  entities.drivers.view
  entities.drivers.manage
  entities.assets.view
  entities.assets.manage

documents
  documents.view
  documents.upload
  documents.download
  documents.delete
  documents.share
  documents.admin

reports
  reports.view
  reports.financial
  reports.operational
  reports.builder
  reports.schedule

ai
  ai.use
  ai.manage

automation
  automation.view
  automation.manage

portal
  portal.manage

admin
  admin.users
  admin.roles
  admin.settings
  admin.audit
```

### Improved Permission UX

**Role builder:**
- Visual permission editor — not a wall of checkboxes
- Permissions grouped by functional area with clear descriptions
- Each permission has a plain-English explanation of what it controls ("Can create new jobs", "Can approve overages above tolerance")
- Toggle entire groups (e.g. "Full jobs access") or individual permissions
- Live preview: "With these permissions, this user CAN do X, Y, Z and CANNOT do A, B, C"
- Role comparison: side-by-side comparison of what two roles can do
- Duplicate existing role as starting point for new one

**Per-user overrides:**
- After assigning a role, admin can grant or restrict specific permissions for individual users
- Grants: give permissions beyond what the role provides
- Restrictions: remove permissions that the role provides
- Overrides are clearly visible (flagged on user profile)
- Override reason required (audit trail)

**Permission templates:**
- Pre-built templates for common roles (Dispatcher, Finance, Ops Manager)
- Tenants can start from a template and customise
- Templates updated with new features as they're added

### Permission Enforcement — Development Rules

**This is critical. Every feature must enforce permissions.**

**Backend enforcement:**
- Every API endpoint/handler checks permissions before executing
- Permission middleware applied to all routes by default — deny unless explicitly permitted
- Permission check is a single function call: `requirePermission(ctx, 'jobs.create')`
- Missing permission checks are caught by automated tests (test that unauthenticated/unpermitted requests are rejected)
- New endpoints without permission checks fail CI

**Frontend enforcement:**
- UI elements hidden when user lacks permission (buttons, menu items, actions)
- Permission-aware components: `<PermissionGate permission="jobs.create">` wraps any UI that requires permission
- Navigation filtered by permissions — users only see pages they can access
- Forms disable fields the user can't edit
- Frontend checks are UX-only — backend is the authority

**Development checklist (enforced in code review and CI):**
- Every new handler has a permission check
- Every new UI action has a PermissionGate
- Every new permission is added to the permission registry with description
- Permission tests exist for every endpoint
- No "TODO: add permissions later" — permissions are part of the feature, not an afterthought

## Tenant Settings

### Company Profile

- Company name, trading name, ABN, ACN
- Address, phone, email, website
- Logo (used in portal, invoices, reports, email headers)
- Business hours per day (affects scheduling)

### Regional Settings

- Timezone (affects all date displays and scheduling)
- Date format preference
- Currency (AUD default, configurable for future expansion)

### Financial Settings

- Default tax rate (GST 10% default, configurable for special cases)
- Financial year start month
- Invoice number prefix and sequence
- Quote number prefix and sequence
- RCTI number prefix and sequence
- Default payment terms (days)
- Credit limit defaults

### Feature Toggles

Tenant-level control over which features are active:
- AI features (doc 16 — individual toggles per AI capability)
- Portal features (doc 14 — contractor portal, customer portal, individual feature toggles)
- Automation features (doc 16 — workflow engine, specific automation rules)
- Module access (based on subscription plan)
- SafeSpec integration (doc 12 — enabled when subscribed)

### Integration Settings

- Xero connection and configuration (doc 11)
- SafeSpec connection (doc 12)
- AI provider configuration (doc 16)
- SMS provider configuration (doc 13)

### Notification Settings

- Which events generate notifications (doc 13)
- Default notification channels per event type
- Quiet hours configuration
- Escalation rules

## Active Session Management

### Session Monitoring

Admin can see all active sessions for their tenant:
- User name, login time, last activity
- Device/browser identification
- IP address
- Activity status (active now, idle, stale)

### Session Actions

- Terminate a specific session (force logout)
- Terminate all sessions for a user (force full logout)
- Cleanup stale sessions (configurable timeout — default 24 hours of inactivity)
- View session history (who logged in when, from where)

### Security

- Maximum concurrent sessions per user (configurable, default unlimited)
- Session timeout after inactivity (configurable, default 8 hours)
- Automatic logout on password change
- IP-based anomaly detection (optional — alert on login from unusual location)

## Audit Logging

### What's Logged

Every significant action in the system is logged:

**User actions:**
- Login/logout events (with IP, device, success/failure)
- User created, updated, deactivated, deleted
- Role assigned or changed
- Permission overrides applied

**Data changes:**
- Entity created, updated, deleted (customers, contractors, drivers, assets, materials)
- Job created, updated, status changed
- Pricing modified
- Invoice generated, sent, paid
- RCTI created, approved, sent
- Document uploaded, shared, deleted

**Settings changes:**
- Company settings modified
- Role permissions updated
- Feature toggles changed
- Integration settings modified

**System events:**
- Scheduled jobs executed (billing runs, report delivery, compliance checks)
- Xero sync events
- AI operations (job creation, review)
- Workflow engine rule triggers

### Audit Log Fields

Each log entry contains:
- Timestamp
- User who performed the action
- Action category and type
- Entity affected (type and ID)
- Old values and new values (what changed)
- IP address and session information
- Additional metadata (context-specific)

### Audit Log UI

- Searchable and filterable log viewer
- Filter by user, action type, entity, date range
- Full-text search across log entries
- Timeline view for entity-specific history ("show me everything that happened to Job #1234")
- Activity dashboard showing action patterns and volume

### Retention & Export

- Configurable retention periods per action type
- Archive before delete option
- Export to CSV or JSON for compliance
- Compliance-ready export formats (timestamped, tamper-evident)
- Minimum retention: 2 years for financial actions, 1 year for operational, 90 days for system events

### Immutability

Audit logs cannot be modified or deleted by any user including admins. Retention policy cleanup is the only deletion mechanism, and it's logged separately.

## Data Management

### Data Export

Tenants can export their data:
- Full tenant data export (all entities, jobs, financials, documents)
- Entity-specific export (all customers, all jobs for a period, etc.)
- Export formats: CSV, JSON
- Queued as background job for large exports (BullMQ)
- Download link sent via notification when ready

### Data Retention

- Configurable per data type
- Soft-delete with recovery period before permanent deletion
- Compliance minimums enforced (can't set retention below legal requirements)
- Storage impact reporting (how much space would cleanup free)

## Onboarding

### Tenant Setup Wizard

New tenants go through a guided setup:
1. Company profile (name, ABN, address, logo)
2. Regional settings (timezone, date format)
3. Financial settings (tax rate, invoice prefix, payment terms)
4. Create first admin user (or use signup credentials)
5. Optional: connect Xero, enable SafeSpec
6. Optional: import existing data (customers, contractors from CSV)
7. Invite team members

The wizard can be revisited from settings to complete skipped steps.

### Team Onboarding

- Bulk user invitation (paste email list)
- Template role selection during invite
- Welcome email with login instructions
- Optional guided tour for new users (in-app walkthrough of key features)
