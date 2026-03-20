CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"date_of_birth" varchar(10),
	"phone" varchar(20),
	"email" varchar(255),
	"home_address" text,
	"position" varchar(100) NOT NULL,
	"employment_type" varchar(20) NOT NULL,
	"start_date" varchar(10) NOT NULL,
	"department" varchar(100),
	"is_driver" boolean DEFAULT false NOT NULL,
	"contractor_company_id" uuid,
	"emergency_contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "licences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"licence_class" varchar(5) NOT NULL,
	"licence_number" varchar(50) NOT NULL,
	"state_of_issue" varchar(3) NOT NULL,
	"expiry_date" varchar(10) NOT NULL,
	"conditions" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"certificate_number" varchar(100),
	"issued_date" varchar(10) NOT NULL,
	"expiry_date" varchar(10) NOT NULL,
	"conditions" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qualification_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"has_expiry" boolean DEFAULT true NOT NULL,
	"requires_evidence" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qualifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"qualification_type_id" uuid NOT NULL,
	"reference_number" varchar(100),
	"state_of_issue" varchar(3),
	"issued_date" varchar(10),
	"expiry_date" varchar(10),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_contractor_company_id_companies_id_fk" FOREIGN KEY ("contractor_company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "licences" ADD CONSTRAINT "licences_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicals" ADD CONSTRAINT "medicals_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualifications" ADD CONSTRAINT "qualifications_qualification_type_id_qualification_types_id_fk" FOREIGN KEY ("qualification_type_id") REFERENCES "public"."qualification_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employees_status_idx" ON "employees" USING btree ("status");--> statement-breakpoint
CREATE INDEX "employees_is_driver_idx" ON "employees" USING btree ("is_driver");--> statement-breakpoint
CREATE INDEX "employees_contractor_company_id_idx" ON "employees" USING btree ("contractor_company_id");--> statement-breakpoint
CREATE INDEX "licences_employee_id_idx" ON "licences" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "medicals_employee_id_idx" ON "medicals" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "qualifications_employee_id_idx" ON "qualifications" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "qualifications_type_id_idx" ON "qualifications" USING btree ("qualification_type_id");