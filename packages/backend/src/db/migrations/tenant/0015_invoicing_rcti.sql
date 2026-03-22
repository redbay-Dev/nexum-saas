-- Invoicing & RCTI system (doc 10)
-- Tables: invoice_sequences, customer_invoice_settings, contractor_payment_settings,
--         invoices, invoice_line_items, rcti_batches, rctis, rcti_line_items,
--         payments, credit_transactions, ar_approvals
-- Updates: charges (add rcti_id), organisation (add RCTI config fields)

-- ── Invoice Sequences ──

CREATE TABLE IF NOT EXISTS "invoice_sequences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "sequence_type" varchar(20) NOT NULL,
  "prefix" varchar(20),
  "suffix" varchar(20),
  "next_number" integer NOT NULL DEFAULT 1,
  "min_digits" integer NOT NULL DEFAULT 4,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Seed default sequences
INSERT INTO "invoice_sequences" ("sequence_type", "prefix", "next_number", "min_digits")
VALUES
  ('invoice', 'INV-', 1, 4),
  ('rcti', 'RCTI-', 1, 4),
  ('credit_note', 'CN-', 1, 4);

-- ── Customer Invoice Settings ──

CREATE TABLE IF NOT EXISTS "customer_invoice_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") UNIQUE,
  "invoice_schedule" varchar(20) NOT NULL DEFAULT 'on_completion',
  "invoice_grouping" varchar(20) NOT NULL DEFAULT 'per_job',
  "schedule_day_of_week" integer,
  "schedule_day_of_month" integer,
  "payment_terms_days" integer NOT NULL DEFAULT 30,
  "credit_limit" numeric(14,2),
  "credit_warning_percent" integer NOT NULL DEFAULT 80,
  "credit_stop" boolean NOT NULL DEFAULT false,
  "credit_stop_reason" text,
  "credit_stop_by" text,
  "credit_stop_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "customer_invoice_settings_company_id_idx" ON "customer_invoice_settings" ("company_id");

-- ── Contractor Payment Settings ──

CREATE TABLE IF NOT EXISTS "contractor_payment_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id") UNIQUE,
  "payment_frequency" varchar(20) NOT NULL DEFAULT 'weekly',
  "payment_day_1" integer,
  "payment_day_2" integer,
  "cutoff_time" varchar(5) NOT NULL DEFAULT '17:00',
  "payment_terms_days" integer NOT NULL DEFAULT 7,
  "gst_inclusive" boolean NOT NULL DEFAULT false,
  "require_approval" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "contractor_payment_settings_company_id_idx" ON "contractor_payment_settings" ("company_id");

-- ── Invoices ──

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_number" varchar(50) NOT NULL UNIQUE,
  "customer_id" uuid NOT NULL REFERENCES "companies"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "issue_date" varchar(10) NOT NULL,
  "due_date" varchar(10) NOT NULL,
  "subtotal" numeric(14,2) NOT NULL DEFAULT '0',
  "total" numeric(14,2) NOT NULL DEFAULT '0',
  "amount_paid" numeric(14,2) NOT NULL DEFAULT '0',
  "group_reference" uuid,
  "grouping_mode" varchar(20),
  "project_id" uuid REFERENCES "projects"("id"),
  "po_number" varchar(100),
  "notes" text,
  "internal_notes" text,
  "verified_by" text,
  "verified_at" timestamp with time zone,
  "verification_notes" text,
  "rejected_by" text,
  "rejected_at" timestamp with time zone,
  "rejection_reason" text,
  "sent_at" timestamp with time zone,
  "sent_by" text,
  "paid_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "cancelled_by" text,
  "cancellation_reason" text,
  "xero_invoice_id" varchar(100),
  "pricing_snapshot" jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "invoices_customer_id_idx" ON "invoices" ("customer_id");
CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" ("status");
CREATE INDEX IF NOT EXISTS "invoices_issue_date_idx" ON "invoices" ("issue_date");
CREATE INDEX IF NOT EXISTS "invoices_due_date_idx" ON "invoices" ("due_date");
CREATE INDEX IF NOT EXISTS "invoices_created_at_idx" ON "invoices" ("created_at");

-- ── Invoice Line Items ──

CREATE TABLE IF NOT EXISTS "invoice_line_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id"),
  "line_number" integer NOT NULL,
  "charge_id" uuid REFERENCES "charges"("id"),
  "job_id" uuid REFERENCES "jobs"("id"),
  "description" text NOT NULL,
  "quantity" numeric(12,4) NOT NULL,
  "unit_of_measure" varchar(20),
  "unit_price" numeric(12,4) NOT NULL,
  "line_total" numeric(14,2) NOT NULL,
  "account_code" varchar(20),
  "pricing_snapshot" jsonb,
  "snapshot_at" timestamp with time zone,
  "calculation_method" text,
  "source_job_number" varchar(20),
  "source_docket_number" varchar(100),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "invoice_line_items_invoice_id_idx" ON "invoice_line_items" ("invoice_id");
CREATE INDEX IF NOT EXISTS "invoice_line_items_charge_id_idx" ON "invoice_line_items" ("charge_id");

-- ── RCTI Batches ──

CREATE TABLE IF NOT EXISTS "rcti_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_number" varchar(50) NOT NULL,
  "period_start" varchar(10) NOT NULL,
  "period_end" varchar(10) NOT NULL,
  "contractor_count" integer NOT NULL DEFAULT 0,
  "total_amount" numeric(14,2) NOT NULL DEFAULT '0',
  "generated_by" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- ── RCTIs ──

CREATE TABLE IF NOT EXISTS "rctis" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rcti_number" varchar(50) NOT NULL UNIQUE,
  "contractor_id" uuid NOT NULL REFERENCES "companies"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "period_start" varchar(10) NOT NULL,
  "period_end" varchar(10) NOT NULL,
  "issue_date" varchar(10),
  "due_date" varchar(10),
  "subtotal" numeric(14,2) NOT NULL DEFAULT '0',
  "deductions_total" numeric(14,2) NOT NULL DEFAULT '0',
  "total" numeric(14,2) NOT NULL DEFAULT '0',
  "amount_paid" numeric(14,2) NOT NULL DEFAULT '0',
  "batch_id" uuid REFERENCES "rcti_batches"("id"),
  "notes" text,
  "internal_notes" text,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "approval_notes" text,
  "sent_at" timestamp with time zone,
  "sent_by" text,
  "paid_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "cancelled_by" text,
  "cancellation_reason" text,
  "disputed_at" timestamp with time zone,
  "dispute_reason" text,
  "remittance_emailed_at" timestamp with time zone,
  "xero_bill_id" varchar(100),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "rctis_contractor_id_idx" ON "rctis" ("contractor_id");
CREATE INDEX IF NOT EXISTS "rctis_status_idx" ON "rctis" ("status");
CREATE INDEX IF NOT EXISTS "rctis_period_start_idx" ON "rctis" ("period_start");
CREATE INDEX IF NOT EXISTS "rctis_period_end_idx" ON "rctis" ("period_end");
CREATE INDEX IF NOT EXISTS "rctis_batch_id_idx" ON "rctis" ("batch_id");
CREATE INDEX IF NOT EXISTS "rctis_created_at_idx" ON "rctis" ("created_at");

-- ── RCTI Line Items ──

CREATE TABLE IF NOT EXISTS "rcti_line_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rcti_id" uuid NOT NULL REFERENCES "rctis"("id"),
  "line_number" integer NOT NULL,
  "line_type" varchar(20) NOT NULL DEFAULT 'charge',
  "charge_id" uuid REFERENCES "charges"("id"),
  "job_id" uuid REFERENCES "jobs"("id"),
  "daysheet_id" uuid REFERENCES "daysheets"("id"),
  "description" text NOT NULL,
  "quantity" numeric(12,4) NOT NULL,
  "unit_of_measure" varchar(20),
  "unit_price" numeric(12,4) NOT NULL,
  "line_total" numeric(14,2) NOT NULL,
  "deduction_category" varchar(30),
  "deduction_details" text,
  "asset_registration" varchar(20),
  "material_name" varchar(255),
  "source_job_number" varchar(20),
  "source_docket_number" varchar(100),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "rcti_line_items_rcti_id_idx" ON "rcti_line_items" ("rcti_id");
CREATE INDEX IF NOT EXISTS "rcti_line_items_charge_id_idx" ON "rcti_line_items" ("charge_id");

-- ── Payments ──

CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid REFERENCES "invoices"("id"),
  "rcti_id" uuid REFERENCES "rctis"("id"),
  "payment_date" varchar(10) NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "payment_method" varchar(20) NOT NULL,
  "reference_number" varchar(100),
  "xero_payment_id" varchar(100),
  "notes" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "payments_invoice_id_idx" ON "payments" ("invoice_id");
CREATE INDEX IF NOT EXISTS "payments_rcti_id_idx" ON "payments" ("rcti_id");
CREATE INDEX IF NOT EXISTS "payments_payment_date_idx" ON "payments" ("payment_date");

-- ── Credit Transactions ──

CREATE TABLE IF NOT EXISTS "credit_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "company_id" uuid NOT NULL REFERENCES "companies"("id"),
  "transaction_type" varchar(30) NOT NULL,
  "amount" numeric(14,2) NOT NULL,
  "reference_id" uuid,
  "reference_type" varchar(20),
  "description" text,
  "created_by" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "credit_transactions_company_id_idx" ON "credit_transactions" ("company_id");
CREATE INDEX IF NOT EXISTS "credit_transactions_type_idx" ON "credit_transactions" ("transaction_type");

-- ── AR Approvals ──

CREATE TABLE IF NOT EXISTS "ar_approvals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id") UNIQUE,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "rejected_by" text,
  "rejected_at" timestamp with time zone,
  "rejection_notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ar_approvals_job_id_idx" ON "ar_approvals" ("job_id");
CREATE INDEX IF NOT EXISTS "ar_approvals_status_idx" ON "ar_approvals" ("status");

-- ── Update charges table: add rcti_id column ──

ALTER TABLE "charges" ADD COLUMN IF NOT EXISTS "rcti_id" uuid;
CREATE INDEX IF NOT EXISTS "charges_invoice_id_idx" ON "charges" ("invoice_id");
CREATE INDEX IF NOT EXISTS "charges_rcti_id_idx" ON "charges" ("rcti_id");

-- ── Update organisation table: add RCTI configuration fields ──

ALTER TABLE "organisation" ADD COLUMN IF NOT EXISTS "rcti_payment_frequency" varchar(20) NOT NULL DEFAULT 'weekly';
ALTER TABLE "organisation" ADD COLUMN IF NOT EXISTS "rcti_payment_day_1" integer;
ALTER TABLE "organisation" ADD COLUMN IF NOT EXISTS "rcti_payment_day_2" integer;
ALTER TABLE "organisation" ADD COLUMN IF NOT EXISTS "rcti_cutoff_time" varchar(5) NOT NULL DEFAULT '17:00';
ALTER TABLE "organisation" ADD COLUMN IF NOT EXISTS "rcti_payment_terms_days" integer NOT NULL DEFAULT 7;
ALTER TABLE "organisation" ADD COLUMN IF NOT EXISTS "rcti_auto_generate" boolean NOT NULL DEFAULT false;
ALTER TABLE "organisation" ADD COLUMN IF NOT EXISTS "rcti_require_approval" boolean NOT NULL DEFAULT true;
ALTER TABLE "organisation" ADD COLUMN IF NOT EXISTS "rcti_gst_inclusive" boolean NOT NULL DEFAULT false;
ALTER TABLE "organisation" ADD COLUMN IF NOT EXISTS "rcti_auto_email_on_approval" boolean NOT NULL DEFAULT false;
ALTER TABLE "organisation" ADD COLUMN IF NOT EXISTS "rcti_include_docket_images" boolean NOT NULL DEFAULT false;
ALTER TABLE "organisation" ADD COLUMN IF NOT EXISTS "rcti_email_stagger_seconds" integer NOT NULL DEFAULT 5;
ALTER TABLE "organisation" ADD COLUMN IF NOT EXISTS "rcti_subject_template" text;
ALTER TABLE "organisation" ADD COLUMN IF NOT EXISTS "rcti_body_template" text;
