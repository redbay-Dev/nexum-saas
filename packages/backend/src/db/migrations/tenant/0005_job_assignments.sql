-- Job Assignments — actual allocations of assets, drivers, and contractors to jobs
CREATE TABLE IF NOT EXISTS "job_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL REFERENCES "jobs"("id"),
  "assignment_type" varchar(20) NOT NULL,
  "asset_id" uuid REFERENCES "assets"("id"),
  "employee_id" uuid REFERENCES "employees"("id"),
  "contractor_company_id" uuid REFERENCES "companies"("id"),
  "requirement_id" uuid REFERENCES "job_asset_requirements"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'assigned',
  "planned_start" timestamp with time zone,
  "planned_end" timestamp with time zone,
  "actual_start" timestamp with time zone,
  "actual_end" timestamp with time zone,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "job_assignments_job_id_idx" ON "job_assignments" ("job_id");
CREATE INDEX IF NOT EXISTS "job_assignments_asset_id_idx" ON "job_assignments" ("asset_id");
CREATE INDEX IF NOT EXISTS "job_assignments_employee_id_idx" ON "job_assignments" ("employee_id");
CREATE INDEX IF NOT EXISTS "job_assignments_contractor_company_id_idx" ON "job_assignments" ("contractor_company_id");
CREATE INDEX IF NOT EXISTS "job_assignments_status_idx" ON "job_assignments" ("status");
