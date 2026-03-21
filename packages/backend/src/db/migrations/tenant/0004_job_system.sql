-- Migration: 0004_job_system
-- Job system tables: job_types, projects, jobs, job_locations, job_materials,
-- job_asset_requirements, job_pricing_lines, job_status_history
-- Ref: docs/06-JOB-SYSTEM.md

-- ── Job Types ──
CREATE TABLE IF NOT EXISTS "job_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(100) NOT NULL,
  "code" varchar(20) NOT NULL,
  "description" text,
  "is_system" boolean NOT NULL DEFAULT false,
  "visible_sections" jsonb,
  "required_fields" jsonb,
  "available_pricing_methods" jsonb,
  "defaults" jsonb,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

-- Seed system defaults
INSERT INTO "job_types" ("name", "code", "is_system", "visible_sections", "sort_order") VALUES
  ('Transport', 'TRANSPORT', true, '{"locations": true, "materials": true, "assetRequirements": true, "pricing": true, "scheduling": true}', 0),
  ('Disposal', 'DISPOSAL', true, '{"locations": true, "materials": true, "assetRequirements": true, "pricing": true, "scheduling": true}', 1),
  ('Hire', 'HIRE', true, '{"locations": false, "materials": false, "assetRequirements": true, "pricing": true, "scheduling": true}', 2),
  ('On-site', 'ONSITE', true, '{"locations": true, "materials": true, "assetRequirements": true, "pricing": true, "scheduling": true}', 3);

-- ── Projects ──
CREATE TABLE IF NOT EXISTS "projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_number" varchar(20) NOT NULL,
  "name" varchar(255) NOT NULL,
  "customer_id" uuid REFERENCES "companies"("id"),
  "start_date" varchar(10),
  "end_date" varchar(10),
  "sales_rep_id" uuid REFERENCES "employees"("id"),
  "project_lead_id" uuid REFERENCES "employees"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "projects_customer_id_idx" ON "projects" ("customer_id");
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects" ("status");

-- ── Jobs ──
CREATE TABLE IF NOT EXISTS "jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_number" varchar(20) NOT NULL,
  "name" varchar(255) NOT NULL,
  "job_type_id" uuid NOT NULL REFERENCES "job_types"("id"),
  "customer_id" uuid REFERENCES "companies"("id"),
  "project_id" uuid REFERENCES "projects"("id"),
  "po_number" varchar(100),
  "priority" varchar(10) NOT NULL DEFAULT 'medium',
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "sales_rep_id" uuid REFERENCES "employees"("id"),
  "job_lead_id" uuid REFERENCES "employees"("id"),
  "scheduled_start" timestamp with time zone,
  "scheduled_end" timestamp with time zone,
  "actual_start" timestamp with time zone,
  "actual_end" timestamp with time zone,
  "is_multi_day" boolean NOT NULL DEFAULT false,
  "minimum_charge_hours" numeric(6, 2),
  "external_notes" text,
  "internal_notes" text,
  "cancellation_reason" text,
  "metadata" jsonb,
  "created_by" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "jobs_job_type_id_idx" ON "jobs" ("job_type_id");
CREATE INDEX IF NOT EXISTS "jobs_customer_id_idx" ON "jobs" ("customer_id");
CREATE INDEX IF NOT EXISTS "jobs_project_id_idx" ON "jobs" ("project_id");
CREATE INDEX IF NOT EXISTS "jobs_status_idx" ON "jobs" ("status");
CREATE INDEX IF NOT EXISTS "jobs_priority_idx" ON "jobs" ("priority");
CREATE INDEX IF NOT EXISTS "jobs_scheduled_start_idx" ON "jobs" ("scheduled_start");

-- ── Job Locations ──
CREATE TABLE IF NOT EXISTS "job_locations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id" uuid NOT NULL REFERENCES "jobs"("id"),
  "location_type" varchar(10) NOT NULL,
  "address_id" uuid NOT NULL REFERENCES "addresses"("id"),
  "entry_point_id" uuid REFERENCES "entry_points"("id"),
  "sequence" integer NOT NULL DEFAULT 0,
  "contact_name" varchar(255),
  "contact_phone" varchar(20),
  "instructions" text,
  "tip_fee" numeric(12, 2),
  "arrival_time" timestamp with time zone,
  "departure_time" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "job_locations_job_id_idx" ON "job_locations" ("job_id");
CREATE INDEX IF NOT EXISTS "job_locations_address_id_idx" ON "job_locations" ("address_id");

-- ── Job Materials (snapshots) ──
CREATE TABLE IF NOT EXISTS "job_materials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id" uuid NOT NULL REFERENCES "jobs"("id"),
  "material_source_type" varchar(20) NOT NULL,
  "material_source_id" uuid NOT NULL,
  "material_name_snapshot" varchar(255) NOT NULL,
  "material_category_snapshot" varchar(100),
  "material_compliance_snapshot" jsonb,
  "quantity" numeric(12, 4),
  "unit_of_measure" varchar(20),
  "flow_type" varchar(20),
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "job_materials_job_id_idx" ON "job_materials" ("job_id");

-- ── Job Asset Requirements ──
CREATE TABLE IF NOT EXISTS "job_asset_requirements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id" uuid NOT NULL REFERENCES "jobs"("id"),
  "asset_category_id" uuid NOT NULL REFERENCES "asset_categories"("id"),
  "asset_subcategory_id" uuid REFERENCES "asset_subcategories"("id"),
  "quantity" integer NOT NULL DEFAULT 1,
  "payload_limit" numeric(10, 2),
  "special_requirements" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "job_asset_requirements_job_id_idx" ON "job_asset_requirements" ("job_id");
CREATE INDEX IF NOT EXISTS "job_asset_requirements_category_id_idx" ON "job_asset_requirements" ("asset_category_id");

-- ── Job Pricing Lines ──
CREATE TABLE IF NOT EXISTS "job_pricing_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id" uuid NOT NULL REFERENCES "jobs"("id"),
  "line_type" varchar(10) NOT NULL,
  "party_id" uuid REFERENCES "companies"("id"),
  "party_name" varchar(255),
  "category" varchar(20) NOT NULL,
  "description" text,
  "rate_type" varchar(20) NOT NULL,
  "quantity" numeric(12, 4) NOT NULL DEFAULT 0,
  "unit_rate" numeric(12, 4) NOT NULL DEFAULT 0,
  "total" numeric(14, 2) NOT NULL DEFAULT 0,
  "is_locked" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "job_pricing_lines_job_id_idx" ON "job_pricing_lines" ("job_id");
CREATE INDEX IF NOT EXISTS "job_pricing_lines_line_type_idx" ON "job_pricing_lines" ("line_type");

-- ── Job Status History ──
CREATE TABLE IF NOT EXISTS "job_status_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "job_id" uuid NOT NULL REFERENCES "jobs"("id"),
  "from_status" varchar(20),
  "to_status" varchar(20) NOT NULL,
  "changed_by" text NOT NULL,
  "reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "job_status_history_job_id_idx" ON "job_status_history" ("job_id");
