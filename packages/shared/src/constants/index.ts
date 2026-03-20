// ── Australian States ──
export const AUSTRALIAN_STATES = [
  "QLD",
  "NSW",
  "VIC",
  "SA",
  "WA",
  "TAS",
  "NT",
  "ACT",
] as const;

export type AustralianState = (typeof AUSTRALIAN_STATES)[number];

// ── Tenant Status ──
export const TENANT_STATUSES = [
  "onboarding",
  "active",
  "suspended",
  "cancelled",
  "deleted",
] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];

// ── Subscription Plans ──
export const SUBSCRIPTION_PLANS = [
  "starter",
  "professional",
  "enterprise",
] as const;

export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

// ── User Roles ──
export const USER_ROLES = [
  "owner",
  "admin",
  "dispatcher",
  "finance",
  "compliance",
  "read_only",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

// ── Portal Roles ──
export const PORTAL_ROLES = ["contractor", "customer"] as const;

export type PortalRole = (typeof PORTAL_ROLES)[number];

// ── Company Roles ──
export const COMPANY_ROLES = [
  "customer",
  "contractor",
  "supplier",
] as const;

export type CompanyRole = (typeof COMPANY_ROLES)[number];

// ── Company Status ──
export const COMPANY_STATUSES = [
  "active",
  "on_hold",
  "archived",
] as const;

export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

// ── Job Lifecycle States ──
export const JOB_STATUSES = [
  "draft",
  "quoted",
  "confirmed",
  "in_progress",
  "completed",
  "invoiced",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

// ── Invoice States ──
export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// ── RCTI States ──
export const RCTI_STATUSES = [
  "pending",
  "approved",
  "sent",
  "paid",
  "void",
] as const;

export type RctiStatus = (typeof RCTI_STATUSES)[number];

// ── Daysheet States ──
export const DAYSHEET_STATUSES = [
  "unprocessed",
  "reviewed",
  "approved",
  "rejected",
] as const;

export type DaysheetStatus = (typeof DAYSHEET_STATUSES)[number];

// ── Docket States ──
export const DOCKET_STATUSES = [
  "pending",
  "verified",
  "disputed",
  "resolved",
] as const;

export type DocketStatus = (typeof DOCKET_STATUSES)[number];

// ── Asset Categories ──
export const ASSET_CATEGORIES = [
  "truck",
  "trailer",
  "equipment",
  "other",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

// ── Pricing Behaviour Types ──
export const PRICING_BEHAVIOURS = [
  "per_tonne",
  "per_cubic_metre",
  "per_load",
  "per_hour",
  "fixed",
] as const;

export type PricingBehaviour = (typeof PRICING_BEHAVIOURS)[number];

// ── Address Types ──
export const ADDRESS_TYPES = [
  "office",
  "job_site",
  "quarry",
  "depot",
  "disposal_site",
  "storage",
] as const;

export type AddressType = (typeof ADDRESS_TYPES)[number];

// ── Contact Status ──
export const CONTACT_STATUSES = ["active", "inactive"] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number];

// ── Entry Point Status ──
export const ENTRY_POINT_STATUSES = [
  "active",
  "temporarily_closed",
  "seasonal",
] as const;

export type EntryPointStatus = (typeof ENTRY_POINT_STATUSES)[number];

// ── Employee Status ──
export const EMPLOYEE_STATUSES = [
  "active",
  "on_leave",
  "suspended",
  "terminated",
] as const;

export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

// ── Employment Type ──
export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "casual",
  "salary",
  "wages",
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

// ── Licence Classes (Australian heavy vehicle) ──
export const LICENCE_CLASSES = [
  "C",
  "LR",
  "MR",
  "HR",
  "HC",
  "MC",
] as const;

export type LicenceClass = (typeof LICENCE_CLASSES)[number];

// ── Modules ──
export const MODULES = [
  "invoicing",
  "rcti",
  "xero",
  "compliance",
  "sms",
  "docket_processing",
  "materials",
  "map_planning",
  "ai_automation",
  "reporting",
  "portal",
] as const;

export type Module = (typeof MODULES)[number];

// ── Audit Action Types ──
export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "RESTORE",
  "STATUS_CHANGE",
  "LOGIN",
  "LOGOUT",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
