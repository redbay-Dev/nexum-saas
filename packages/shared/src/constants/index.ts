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

// ── Invoice States (doc 10: Draft → Verified → Sent → Paid) ──
export const INVOICE_STATUSES = [
  "draft",
  "verified",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "rejected",
  "cancelled",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// ── RCTI States (doc 10: Draft → Accumulating → Ready → Pending Approval → Approved → Sent → Paid) ──
export const RCTI_STATUSES = [
  "draft",
  "accumulating",
  "ready",
  "pending_approval",
  "approved",
  "sent",
  "partially_paid",
  "paid",
  "cancelled",
  "disputed",
] as const;

export type RctiStatus = (typeof RCTI_STATUSES)[number];

// ── Invoice Scheduling Frequencies (per-customer) ──
export const INVOICE_SCHEDULING_FREQUENCIES = [
  "on_completion",
  "daily",
  "weekly",
  "fortnightly",
  "monthly",
] as const;

export type InvoiceSchedulingFrequency = (typeof INVOICE_SCHEDULING_FREQUENCIES)[number];

// ── Invoice Grouping Modes (per-customer) ──
export const INVOICE_GROUPING_MODES = [
  "per_job",
  "per_po",
  "per_project",
  "per_site",
  "combine_all",
] as const;

export type InvoiceGroupingMode = (typeof INVOICE_GROUPING_MODES)[number];

// ── RCTI Payment Frequencies ──
export const RCTI_PAYMENT_FREQUENCIES = [
  "weekly",
  "bi_monthly",
  "monthly",
] as const;

export type RctiPaymentFrequency = (typeof RCTI_PAYMENT_FREQUENCIES)[number];

// ── RCTI Line Types ──
export const RCTI_LINE_TYPES = ["charge", "deduction"] as const;

export type RctiLineType = (typeof RCTI_LINE_TYPES)[number];

// ── Deduction Categories ──
export const DEDUCTION_CATEGORIES = [
  "yard_parking",
  "fuel_usage",
  "overload_penalty",
  "tip_fee_adjustment",
  "driver_error",
  "other",
] as const;

export type DeductionCategory = (typeof DEDUCTION_CATEGORIES)[number];

// ── Payment Methods ──
export const PAYMENT_METHODS = [
  "eft",
  "cheque",
  "cash",
  "credit_card",
  "other",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// ── Invoice Sequence Types ──
export const SEQUENCE_TYPES = ["invoice", "rcti", "credit_note"] as const;

export type SequenceType = (typeof SEQUENCE_TYPES)[number];

// ── AR Approval Statuses ──
export const AR_APPROVAL_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

export type ArApprovalStatus = (typeof AR_APPROVAL_STATUSES)[number];

// ── Invoice Dispute Statuses ──
export const DISPUTE_STATUSES = [
  "open",
  "investigating",
  "resolved",
  "closed",
] as const;

export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

// ── Dispute Resolution Types ──
export const DISPUTE_RESOLUTION_TYPES = [
  "explanation_accepted",
  "credit_note_issued",
  "invoice_replaced",
  "adjustment_applied",
] as const;

export type DisputeResolutionType = (typeof DISPUTE_RESOLUTION_TYPES)[number];

// ── Credit Transaction Types ──
export const CREDIT_TRANSACTION_TYPES = [
  "invoice_created",
  "payment_received",
  "job_completed",
  "job_cancelled",
  "manual_adjustment",
] as const;

export type CreditTransactionType = (typeof CREDIT_TRANSACTION_TYPES)[number];

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

// ══════════════════════════════════════════════════════════════════
// ── Document Management Constants (doc 15) ──
// ══════════════════════════════════════════════════════════════════

// ── Document Statuses ──
export const DOCUMENT_STATUSES = [
  "active",
  "expired",
  "pending_approval",
  "archived",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

// ── Document Types (by purpose) ──
export const DOCUMENT_TYPES = [
  "licence",
  "medical",
  "dg_certificate",
  "qualification",
  "induction",
  "registration",
  "ctp_insurance",
  "comprehensive_insurance",
  "roadworthy",
  "weight_certificate",
  "pbs_approval",
  "service_record",
  "photo",
  "public_liability",
  "workers_comp",
  "nhvas",
  "agreement",
  "abn_certificate",
  "weighbridge_ticket",
  "tip_receipt",
  "delivery_note",
  "attachment",
  "price_list",
  "invoice_pdf",
  "rcti_pdf",
  "quote_pdf",
  "statement_pdf",
  "report_pdf",
  "other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// ── Document Entity Types (what the document belongs to) ──
export const DOCUMENT_ENTITY_TYPES = [
  "employee",
  "asset",
  "company",
  "job",
  "address",
  "invoice",
  "rcti",
] as const;

export type DocumentEntityType = (typeof DOCUMENT_ENTITY_TYPES)[number];

// ── Storage Tiers ──
export const STORAGE_TIERS = [
  "hot",
  "warm",
  "cold",
  "archive",
] as const;

export type StorageTier = (typeof STORAGE_TIERS)[number];

// ── Document Access Methods ──
export const DOCUMENT_ACCESS_METHODS = [
  "direct",
  "public_link",
  "xero",
  "api",
  "portal",
] as const;

export type DocumentAccessMethod = (typeof DOCUMENT_ACCESS_METHODS)[number];

// ══════════════════════════════════════════════════════════════════
// ── Communications Constants (doc 13) ──
// ══════════════════════════════════════════════════════════════════

// ── Notification Channels ──
export const NOTIFICATION_CHANNELS = [
  "push",
  "in_app",
  "sms",
  "email",
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// ── Notification Categories ──
export const NOTIFICATION_CATEGORIES = [
  "scheduling",
  "job_lifecycle",
  "accounts",
  "credit",
  "compliance",
  "system",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

// ── Email Queue Statuses ──
export const EMAIL_STATUSES = [
  "pending",
  "queued",
  "sent",
  "delivered",
  "failed",
  "bounced",
] as const;

export type EmailStatus = (typeof EMAIL_STATUSES)[number];

// ── SMS Statuses ──
export const SMS_STATUSES = [
  "pending",
  "queued",
  "sent",
  "delivered",
  "failed",
] as const;

export type SmsStatus = (typeof SMS_STATUSES)[number];

// ── Notification Statuses ──
export const NOTIFICATION_STATUSES = [
  "unread",
  "read",
  "dismissed",
] as const;

export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

// ── Communication Types (events that trigger notifications) ──
export const COMMUNICATION_TYPES = [
  // Scheduling
  "job_needs_allocation",
  "job_requires_attention",
  "duplicate_booking",
  "contractor_unconfirmed",
  "asset_maintenance_due",
  // Job lifecycle
  "job_status_changed",
  "job_issue_reported",
  "job_variation",
  // Accounts
  "job_ready_for_invoicing",
  "docket_pending_verification",
  "invoice_overdue",
  "rcti_pending_approval",
  "payment_received",
  "supplier_invoice_received",
  // Credit
  "credit_warning",
  "credit_limit_exceeded",
  "credit_stop_applied",
  "credit_stop_removed",
  "over_limit_approval_requested",
  // Compliance
  "entity_approaching_noncompliance",
  "entity_noncompliant",
  // System
  "system_announcement",
  "integration_error",
] as const;

export type CommunicationType = (typeof COMMUNICATION_TYPES)[number];

// ══════════════════════════════════════════════════════════════════
// ── Xero Integration Constants (doc 11) ──
// ══════════════════════════════════════════════════════════════════

// ── Xero Connection Statuses ──
export const XERO_CONNECTION_STATUSES = [
  "connected",
  "disconnected",
  "expired",
  "error",
] as const;

export type XeroConnectionStatus = (typeof XERO_CONNECTION_STATUSES)[number];

// ── Xero Sync Resource Types ──
export const XERO_SYNC_TYPES = [
  "contact",
  "invoice",
  "bill",
  "credit_note",
  "payment",
  "chart_of_accounts",
  "tax_rates",
  "tracking_categories",
] as const;

export type XeroSyncType = (typeof XERO_SYNC_TYPES)[number];

// ── Xero Sync Directions ──
export const XERO_SYNC_DIRECTIONS = [
  "push",
  "pull",
] as const;

export type XeroSyncDirection = (typeof XERO_SYNC_DIRECTIONS)[number];

// ── Xero Sync Statuses ──
export const XERO_SYNC_STATUSES = [
  "pending",
  "synced",
  "failed",
  "skipped",
] as const;

export type XeroSyncStatus = (typeof XERO_SYNC_STATUSES)[number];

// ── Xero Tax Types (Australian standard) ──
export const XERO_TAX_TYPES = [
  "OUTPUT",
  "INPUT",
  "EXEMPTOUTPUT",
  "EXEMPTINPUT",
  "BASEXCLUDED",
  "GSTONIMPORTS",
] as const;

export type XeroTaxType = (typeof XERO_TAX_TYPES)[number];

// ── Xero Account Types ──
export const XERO_ACCOUNT_TYPES = [
  "REVENUE",
  "DIRECTCOSTS",
  "EXPENSE",
  "OVERHEADS",
  "CURRENT",
  "FIXED",
  "CURRLIAB",
  "TERMLIAB",
  "EQUITY",
] as const;

export type XeroAccountType = (typeof XERO_ACCOUNT_TYPES)[number];

// ── Batch Billing Run Statuses ──
export const BILLING_RUN_STATUSES = [
  "pending",
  "previewing",
  "generating",
  "generated",
  "verifying",
  "sending",
  "completed",
  "failed",
] as const;

export type BillingRunStatus = (typeof BILLING_RUN_STATUSES)[number];
