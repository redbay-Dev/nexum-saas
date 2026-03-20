-- Migration: 0003_materials_disposal
-- Materials & Disposal tables (doc 05)

-- Material Categories (two-level hierarchy)
CREATE TABLE IF NOT EXISTS "material_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(100) NOT NULL,
  "type" varchar(30) NOT NULL,
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "material_subcategories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "category_id" uuid NOT NULL REFERENCES "material_categories"("id"),
  "name" varchar(100) NOT NULL,
  "description" text,
  "density_factor" numeric(8, 4),
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "material_subcategories_category_id_idx" ON "material_subcategories" ("category_id");

-- Tenant Materials (own stockpile)
CREATE TABLE IF NOT EXISTS "tenant_materials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "subcategory_id" uuid REFERENCES "material_subcategories"("id"),
  "unit_of_measure" varchar(20) NOT NULL,
  "address_id" uuid REFERENCES "addresses"("id"),
  "description" text,
  "density_factor" numeric(8, 4),
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "compliance" jsonb,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "tenant_materials_subcategory_id_idx" ON "tenant_materials" ("subcategory_id");
CREATE INDEX IF NOT EXISTS "tenant_materials_address_id_idx" ON "tenant_materials" ("address_id");
CREATE INDEX IF NOT EXISTS "tenant_materials_status_idx" ON "tenant_materials" ("status");

-- Supplier Materials (buy-side)
CREATE TABLE IF NOT EXISTS "supplier_materials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "supplier_id" uuid NOT NULL REFERENCES "companies"("id"),
  "supplier_name" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "subcategory_id" uuid REFERENCES "material_subcategories"("id"),
  "unit_of_measure" varchar(20) NOT NULL,
  "address_id" uuid REFERENCES "addresses"("id"),
  "supplier_product_code" varchar(50),
  "purchase_price" numeric(12, 2),
  "minimum_order_qty" numeric(12, 2),
  "description" text,
  "density_factor" numeric(8, 4),
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "compliance" jsonb,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "supplier_materials_supplier_id_idx" ON "supplier_materials" ("supplier_id");
CREATE INDEX IF NOT EXISTS "supplier_materials_subcategory_id_idx" ON "supplier_materials" ("subcategory_id");
CREATE INDEX IF NOT EXISTS "supplier_materials_address_id_idx" ON "supplier_materials" ("address_id");
CREATE INDEX IF NOT EXISTS "supplier_materials_status_idx" ON "supplier_materials" ("status");

-- Customer Materials (sell-side)
CREATE TABLE IF NOT EXISTS "customer_materials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "customer_id" uuid NOT NULL REFERENCES "companies"("id"),
  "customer_name" varchar(255) NOT NULL,
  "name" varchar(255) NOT NULL,
  "subcategory_id" uuid REFERENCES "material_subcategories"("id"),
  "unit_of_measure" varchar(20) NOT NULL,
  "address_id" uuid REFERENCES "addresses"("id"),
  "sale_price" numeric(12, 2),
  "description" text,
  "density_factor" numeric(8, 4),
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "compliance" jsonb,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "customer_materials_customer_id_idx" ON "customer_materials" ("customer_id");
CREATE INDEX IF NOT EXISTS "customer_materials_subcategory_id_idx" ON "customer_materials" ("subcategory_id");
CREATE INDEX IF NOT EXISTS "customer_materials_address_id_idx" ON "customer_materials" ("address_id");
CREATE INDEX IF NOT EXISTS "customer_materials_status_idx" ON "customer_materials" ("status");

-- Disposal Materials (accept/supply at disposal sites)
CREATE TABLE IF NOT EXISTS "disposal_materials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "address_id" uuid NOT NULL REFERENCES "addresses"("id"),
  "name" varchar(255) NOT NULL,
  "subcategory_id" uuid REFERENCES "material_subcategories"("id"),
  "unit_of_measure" varchar(20) NOT NULL,
  "material_mode" varchar(10) NOT NULL,
  "tip_fee" numeric(12, 2),
  "environmental_levy" numeric(12, 2),
  "minimum_charge" numeric(12, 2),
  "sale_price" numeric(12, 2),
  "description" text,
  "density_factor" numeric(8, 4),
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "compliance" jsonb,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "disposal_materials_address_id_idx" ON "disposal_materials" ("address_id");
CREATE INDEX IF NOT EXISTS "disposal_materials_subcategory_id_idx" ON "disposal_materials" ("subcategory_id");
CREATE INDEX IF NOT EXISTS "disposal_materials_material_mode_idx" ON "disposal_materials" ("material_mode");
CREATE INDEX IF NOT EXISTS "disposal_materials_status_idx" ON "disposal_materials" ("status");

-- Disposal Site Settings
CREATE TABLE IF NOT EXISTS "disposal_site_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "address_id" uuid NOT NULL REFERENCES "addresses"("id"),
  "operating_hours" text,
  "accepted_materials" text,
  "rejected_materials" text,
  "epa_licence_number" varchar(100),
  "epa_licence_expiry" varchar(10),
  "waste_codes" text,
  "account_terms" text,
  "credit_limit" numeric(12, 2),
  "pre_approval_required" boolean NOT NULL DEFAULT false,
  "accounts_contact_name" varchar(255),
  "accounts_contact_phone" varchar(20),
  "accounts_contact_email" varchar(255),
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "disposal_site_settings_address_id_idx" ON "disposal_site_settings" ("address_id");

-- Seed default material categories
INSERT INTO "material_categories" ("name", "type", "sort_order") VALUES
  ('Fill', 'fill', 0),
  ('Soil', 'soil', 1),
  ('Sand', 'sand', 2),
  ('Rock', 'rock', 3),
  ('Aggregate', 'aggregate', 4),
  ('Road Base', 'road_base', 5),
  ('Concrete & Demolition', 'concrete_demolition', 6),
  ('Asphalt', 'asphalt', 7),
  ('Recycled', 'recycled', 8),
  ('Mulch & Organic', 'mulch_organic', 9),
  ('Hazardous / Regulated', 'hazardous_regulated', 10),
  ('Specialty', 'specialty', 11);
