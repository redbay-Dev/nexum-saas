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
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "invoiced",
  "cancelled",
  "declined",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

// ── Job Priorities ──
export const JOB_PRIORITIES = ["low", "medium", "high"] as const;

export type JobPriority = (typeof JOB_PRIORITIES)[number];

// ── Job Location Types ──
export const JOB_LOCATION_TYPES = ["pickup", "delivery"] as const;

export type JobLocationType = (typeof JOB_LOCATION_TYPES)[number];

// ── Job Pricing Line Types ──
export const JOB_PRICING_LINE_TYPES = ["revenue", "cost"] as const;

export type JobPricingLineType = (typeof JOB_PRICING_LINE_TYPES)[number];

// ── Job Pricing Rate Types ──
export const JOB_PRICING_RATE_TYPES = [
  "per_hour",
  "per_tonne",
  "per_cubic_metre",
  "per_km",
  "per_load",
  "flat",
] as const;

export type JobPricingRateType = (typeof JOB_PRICING_RATE_TYPES)[number];

// ── Job Pricing Categories ──
export const JOB_PRICING_CATEGORIES = [
  "hire",
  "cartage",
  "tip_fee",
  "material",
  "subcontractor",
  "equipment",
  "labour",
  "fuel_levy",
  "other",
] as const;

export type JobPricingCategory = (typeof JOB_PRICING_CATEGORIES)[number];

// ── Job Assignment Types ──
export const JOB_ASSIGNMENT_TYPES = [
  "asset",
  "driver",
  "contractor",
] as const;

export type JobAssignmentType = (typeof JOB_ASSIGNMENT_TYPES)[number];

// ── Job Assignment Statuses ──
export const JOB_ASSIGNMENT_STATUSES = [
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type JobAssignmentStatus = (typeof JOB_ASSIGNMENT_STATUSES)[number];

// ── Project Statuses ──
export const PROJECT_STATUSES = [
  "active",
  "completed",
  "on_hold",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

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

// ── Daysheet States (doc 08 workflow: submitted → review → reconciled → processed) ──
export const DAYSHEET_STATUSES = [
  "submitted",
  "review",
  "reconciled",
  "processed",
  "rejected",
] as const;

export type DaysheetStatus = (typeof DAYSHEET_STATUSES)[number];

// ── Daysheet Submission Channels ──
export const DAYSHEET_SUBMISSION_CHANNELS = [
  "driverx",
  "portal",
  "staff_entry",
  "auto_generated",
] as const;

export type DaysheetSubmissionChannel = (typeof DAYSHEET_SUBMISSION_CHANNELS)[number];

// ── Docket States (doc 08: uploaded → matched → reconciled → filed) ──
export const DOCKET_STATUSES = [
  "uploaded",
  "matched",
  "reconciled",
  "filed",
] as const;

export type DocketStatus = (typeof DOCKET_STATUSES)[number];

// ── Docket Types ──
export const DOCKET_TYPES = [
  "weighbridge_ticket",
  "tip_receipt",
  "delivery_receipt",
  "collection_receipt",
] as const;

export type DocketType = (typeof DOCKET_TYPES)[number];

// ── Charge Statuses ──
export const CHARGE_STATUSES = [
  "pending",
  "approved",
  "invoiced",
  "void",
] as const;

export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

// ── Overage Types ──
export const OVERAGE_TYPES = [
  "payload",
  "volume",
  "contract_limit",
] as const;

export type OverageType = (typeof OVERAGE_TYPES)[number];

// ── Overage Severity ──
export const OVERAGE_SEVERITIES = [
  "minor",
  "significant",
  "critical",
] as const;

export type OverageSeverity = (typeof OVERAGE_SEVERITIES)[number];

// ── Overage Approval Statuses ──
export const OVERAGE_APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "auto_approved",
] as const;

export type OverageApprovalStatus = (typeof OVERAGE_APPROVAL_STATUSES)[number];

// ── Asset Categories ──
export const ASSET_CATEGORIES = [
  "truck",
  "trailer",
  "equipment",
  "tool",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

// ── Asset Operational Status ──
export const ASSET_STATUSES = [
  "available",
  "in_use",
  "maintenance",
  "inspection",
  "repairs",
  "grounded",
  "retired",
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

// ── Asset Ownership ──
export const ASSET_OWNERSHIP_TYPES = [
  "tenant",
  "contractor",
] as const;

export type AssetOwnershipType = (typeof ASSET_OWNERSHIP_TYPES)[number];

// ── Industry Types (for category configuration) ──
export const INDUSTRY_TYPES = [
  "transport",
  "construction",
  "general",
] as const;

export type IndustryType = (typeof INDUSTRY_TYPES)[number];

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

// ── Material Categories (system-seeded defaults) ──
export const MATERIAL_CATEGORY_TYPES = [
  "fill",
  "soil",
  "sand",
  "rock",
  "aggregate",
  "road_base",
  "concrete_demolition",
  "asphalt",
  "recycled",
  "mulch_organic",
  "hazardous_regulated",
  "specialty",
] as const;

export type MaterialCategoryType = (typeof MATERIAL_CATEGORY_TYPES)[number];

// ── Material Source Types ──
export const MATERIAL_SOURCE_TYPES = [
  "tenant",
  "supplier",
  "customer",
  "disposal",
] as const;

export type MaterialSourceType = (typeof MATERIAL_SOURCE_TYPES)[number];

// ── Material Modes (disposal sites) ──
export const MATERIAL_MODES = [
  "disposal",
  "supply",
] as const;

export type MaterialMode = (typeof MATERIAL_MODES)[number];

// ── Material Flow Types (in jobs) ──
export const MATERIAL_FLOW_TYPES = [
  "supply",
  "disposal",
  "buyback",
  "transfer",
  "delivery",
] as const;

export type MaterialFlowType = (typeof MATERIAL_FLOW_TYPES)[number];

// ── Material Pricing Behaviours ──
export const MATERIAL_PRICING_BEHAVIOURS = [
  "transport_revenue",
  "material_cost",
  "material_resale",
  "buyback",
  "tracking_only",
] as const;

export type MaterialPricingBehaviour = (typeof MATERIAL_PRICING_BEHAVIOURS)[number];

// ── Units of Measure ──
export const UNITS_OF_MEASURE = [
  "tonne",
  "cubic_metre",
  "load",
  "hour",
  "kilometre",
] as const;

export type UnitOfMeasure = (typeof UNITS_OF_MEASURE)[number];

// ── Material Status ──
export const MATERIAL_STATUSES = [
  "active",
  "inactive",
] as const;

export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

// ── DG Classes ──
export const DG_CLASSES = [
  "1", "2", "3", "4", "5", "6", "7", "8", "9",
] as const;

export type DgClass = (typeof DG_CLASSES)[number];

// ── Packing Groups ──
export const PACKING_GROUPS = [
  "I", "II", "III",
] as const;

export type PackingGroup = (typeof PACKING_GROUPS)[number];

// ── Job Pricing Sources ──
export const JOB_PRICING_SOURCES = [
  "manual",
  "material",
  "tip_fee",
  "subcontractor",
  "rate_card",
  "markup_rule",
  "surcharge",
] as const;

export type JobPricingSource = (typeof JOB_PRICING_SOURCES)[number];

// ── Credit Types ──
export const CREDIT_TYPES = [
  "overpayment",
  "goodwill",
  "rate_correction",
  "reversal",
] as const;

export type CreditType = (typeof CREDIT_TYPES)[number];

// ── Markup Rule Types ──
export const MARKUP_RULE_TYPES = ["percentage", "fixed"] as const;

export type MarkupRuleType = (typeof MARKUP_RULE_TYPES)[number];

// ── Surcharge Types ──
export const SURCHARGE_TYPES = ["percentage", "fixed"] as const;

export type SurchargeType = (typeof SURCHARGE_TYPES)[number];

// ── Margin Threshold Levels ──
export const MARGIN_THRESHOLD_LEVELS = [
  "global",
  "category",
  "customer",
  "material_type",
] as const;

export type MarginThresholdLevel = (typeof MARGIN_THRESHOLD_LEVELS)[number];

// ── Price Change Sources ──
export const PRICE_CHANGE_SOURCES = [
  "manual",
  "bulk",
  "csv_import",
] as const;

export type PriceChangeSource = (typeof PRICE_CHANGE_SOURCES)[number];

// ── Quote Pricing Modes ──
export const QUOTE_PRICING_MODES = [
  "lock_at_quote",
  "update_on_acceptance",
] as const;

export type QuotePricingMode = (typeof QUOTE_PRICING_MODES)[number];

// ── Deallocation Reasons ──
export const DEALLOCATION_REASONS = [
  "reassignment",
  "no_longer_needed",
  "compliance_issue",
  "breakdown",
  "weather",
  "customer_request",
  "other",
] as const;

export type DeallocationReason = (typeof DEALLOCATION_REASONS)[number];

// ── User Account Status ──
export const USER_STATUSES = ["active", "deactivated"] as const;

export type UserAccountStatus = (typeof USER_STATUSES)[number];

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
