-- Daysheets & Dockets (doc 08) — primary work records and external supporting documents

-- Daysheets: the driver's working record of what they did
CREATE TABLE IF NOT EXISTS "daysheets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id"),
  "assignment_id" uuid REFERENCES "job_assignments"("id"),
  "driver_id" uuid REFERENCES "employees"("id"),
  "asset_id" uuid REFERENCES "assets"("id"),
  "work_date" varchar(10) NOT NULL,
  "submission_channel" varchar(20) NOT NULL DEFAULT 'staff_entry',
  "status" varchar(20) NOT NULL DEFAULT 'submitted',
  "load_count" integer,
  "total_quantity" numeric(12,4),
  "total_gross_weight" numeric(12,4),
  "total_tare_weight" numeric(12,4),
  "total_net_weight" numeric(12,4),
  "start_time" varchar(5),
  "end_time" varchar(5),
  "hours_worked" numeric(6,2),
  "overtime_hours" numeric(6,2),
  "break_minutes" integer,
  "total_billable_hours" numeric(6,2),
  "pickup_location_id" uuid REFERENCES "job_locations"("id"),
  "delivery_location_id" uuid REFERENCES "job_locations"("id"),
  "is_auto_processed" boolean NOT NULL DEFAULT false,
  "processed_at" timestamp with time zone,
  "processed_by" text,
  "rejection_reason" text,
  "notes" text,
  "internal_notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "daysheets_job_id_idx" ON "daysheets" ("job_id");
CREATE INDEX IF NOT EXISTS "daysheets_driver_id_idx" ON "daysheets" ("driver_id");
CREATE INDEX IF NOT EXISTS "daysheets_asset_id_idx" ON "daysheets" ("asset_id");
CREATE INDEX IF NOT EXISTS "daysheets_work_date_idx" ON "daysheets" ("work_date");
CREATE INDEX IF NOT EXISTS "daysheets_status_idx" ON "daysheets" ("status");
CREATE INDEX IF NOT EXISTS "daysheets_assignment_id_idx" ON "daysheets" ("assignment_id");

-- Daysheet loads: individual loads within a daysheet
CREATE TABLE IF NOT EXISTS "daysheet_loads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "daysheet_id" uuid NOT NULL REFERENCES "daysheets"("id"),
  "load_number" integer NOT NULL,
  "material_source_type" varchar(20),
  "material_source_id" uuid,
  "material_name" varchar(255),
  "unit_of_measure" varchar(20),
  "quantity" numeric(12,4),
  "gross_weight" numeric(12,4),
  "tare_weight" numeric(12,4),
  "net_weight" numeric(12,4),
  "docket_number" varchar(100),
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "daysheet_loads_daysheet_id_idx" ON "daysheet_loads" ("daysheet_id");

-- Dockets: external supporting documents (weighbridge tickets, tip receipts, etc.)
CREATE TABLE IF NOT EXISTS "dockets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id"),
  "daysheet_id" uuid REFERENCES "daysheets"("id"),
  "docket_type" varchar(30) NOT NULL,
  "docket_number" varchar(100),
  "status" varchar(20) NOT NULL DEFAULT 'uploaded',
  "issuer_name" varchar(255),
  "issue_date" varchar(10),
  "material_name" varchar(255),
  "quantity" numeric(12,4),
  "unit_of_measure" varchar(20),
  "gross_weight" numeric(12,4),
  "tare_weight" numeric(12,4),
  "net_weight" numeric(12,4),
  "tip_fee" numeric(12,2),
  "environmental_levy" numeric(12,2),
  "ai_confidence" jsonb,
  "ai_processed" boolean NOT NULL DEFAULT false,
  "has_discrepancy" boolean NOT NULL DEFAULT false,
  "discrepancy_notes" text,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "dockets_job_id_idx" ON "dockets" ("job_id");
CREATE INDEX IF NOT EXISTS "dockets_daysheet_id_idx" ON "dockets" ("daysheet_id");
CREATE INDEX IF NOT EXISTS "dockets_status_idx" ON "dockets" ("status");
CREATE INDEX IF NOT EXISTS "dockets_docket_type_idx" ON "dockets" ("docket_type");

-- Docket files: uploaded images/documents linked to dockets
CREATE TABLE IF NOT EXISTS "docket_files" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "docket_id" uuid NOT NULL REFERENCES "dockets"("id"),
  "file_name" varchar(500) NOT NULL,
  "file_size" integer NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "storage_key" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "docket_files_docket_id_idx" ON "docket_files" ("docket_id");

-- Charges: created from daysheet processing (bridges work to invoicing)
CREATE TABLE IF NOT EXISTS "charges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "daysheet_id" uuid NOT NULL REFERENCES "daysheets"("id"),
  "job_id" uuid NOT NULL REFERENCES "jobs"("id"),
  "pricing_line_id" uuid REFERENCES "job_pricing_lines"("id"),
  "line_type" varchar(10) NOT NULL,
  "party_id" uuid REFERENCES "companies"("id"),
  "party_name" varchar(255),
  "category" varchar(20) NOT NULL,
  "description" text,
  "rate_type" varchar(20) NOT NULL,
  "quantity" numeric(12,4) NOT NULL DEFAULT 0,
  "unit_rate" numeric(12,4) NOT NULL DEFAULT 0,
  "total" numeric(14,2) NOT NULL DEFAULT 0,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "is_override" boolean NOT NULL DEFAULT false,
  "override_reason" text,
  "invoice_id" uuid,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "charges_daysheet_id_idx" ON "charges" ("daysheet_id");
CREATE INDEX IF NOT EXISTS "charges_job_id_idx" ON "charges" ("job_id");
CREATE INDEX IF NOT EXISTS "charges_pricing_line_id_idx" ON "charges" ("pricing_line_id");
CREATE INDEX IF NOT EXISTS "charges_status_idx" ON "charges" ("status");

-- Overages: detected when actual quantities exceed limits
CREATE TABLE IF NOT EXISTS "overages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "daysheet_id" uuid NOT NULL REFERENCES "daysheets"("id"),
  "daysheet_load_id" uuid REFERENCES "daysheet_loads"("id"),
  "job_id" uuid NOT NULL REFERENCES "jobs"("id"),
  "overage_type" varchar(20) NOT NULL,
  "severity" varchar(20) NOT NULL,
  "actual_value" numeric(12,4) NOT NULL,
  "limit_value" numeric(12,4) NOT NULL,
  "overage_amount" numeric(12,4) NOT NULL,
  "overage_percent" numeric(8,4) NOT NULL,
  "approval_status" varchar(20) NOT NULL DEFAULT 'pending',
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "approval_notes" text,
  "driver_id" uuid REFERENCES "employees"("id"),
  "asset_id" uuid REFERENCES "assets"("id"),
  "material_name" varchar(255),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "overages_daysheet_id_idx" ON "overages" ("daysheet_id");
CREATE INDEX IF NOT EXISTS "overages_job_id_idx" ON "overages" ("job_id");
CREATE INDEX IF NOT EXISTS "overages_approval_status_idx" ON "overages" ("approval_status");
CREATE INDEX IF NOT EXISTS "overages_driver_id_idx" ON "overages" ("driver_id");
CREATE INDEX IF NOT EXISTS "overages_asset_id_idx" ON "overages" ("asset_id");
