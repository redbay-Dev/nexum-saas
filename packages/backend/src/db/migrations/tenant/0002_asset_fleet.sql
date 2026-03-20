-- Asset Categories (tenant-configurable)
CREATE TABLE IF NOT EXISTS "asset_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "type" varchar(20) NOT NULL,
  "industry_type" varchar(20) NOT NULL DEFAULT 'transport',
  "enable_specifications" boolean NOT NULL DEFAULT true,
  "enable_weight_specs" boolean NOT NULL DEFAULT false,
  "enable_mass_scheme" boolean NOT NULL DEFAULT false,
  "enable_engine_hours" boolean NOT NULL DEFAULT false,
  "enable_capacity_fields" boolean NOT NULL DEFAULT false,
  "enable_registration" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

-- Asset Subcategories
CREATE TABLE IF NOT EXISTS "asset_subcategories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid NOT NULL REFERENCES "asset_categories"("id"),
  "name" varchar(100) NOT NULL,
  "vehicle_configuration" varchar(100),
  "default_volume" numeric(10, 2),
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "asset_subcategories_category_id_idx" ON "asset_subcategories" USING btree ("category_id");

-- Assets
CREATE TABLE IF NOT EXISTS "assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_number" varchar(50),
  "category_id" uuid NOT NULL REFERENCES "asset_categories"("id"),
  "subcategory_id" uuid REFERENCES "asset_subcategories"("id"),
  "ownership" varchar(20) NOT NULL DEFAULT 'tenant',
  "contractor_company_id" uuid REFERENCES "companies"("id"),
  "status" varchar(20) NOT NULL DEFAULT 'available',
  "registration_number" varchar(20),
  "registration_state" varchar(3),
  "registration_expiry" varchar(10),
  "make" varchar(100),
  "model" varchar(100),
  "year" integer,
  "vin" varchar(50),
  "tare_weight" numeric(10, 2),
  "gvm" numeric(10, 2),
  "gcm" numeric(10, 2),
  "vehicle_configuration" varchar(100),
  "mass_scheme" varchar(50),
  "body_material" varchar(100),
  "side_height" numeric(6, 2),
  "body_type" varchar(100),
  "equipment_fitted" jsonb,
  "capacity" numeric(10, 2),
  "capacity_unit" varchar(20),
  "engine_hours" numeric(10, 1),
  "engine_hours_date" varchar(10),
  "odometer" numeric(10, 0),
  "odometer_date" varchar(10),
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "deleted_at" timestamp with time zone
);

CREATE INDEX IF NOT EXISTS "assets_category_id_idx" ON "assets" USING btree ("category_id");
CREATE INDEX IF NOT EXISTS "assets_subcategory_id_idx" ON "assets" USING btree ("subcategory_id");
CREATE INDEX IF NOT EXISTS "assets_status_idx" ON "assets" USING btree ("status");
CREATE INDEX IF NOT EXISTS "assets_ownership_idx" ON "assets" USING btree ("ownership");
CREATE INDEX IF NOT EXISTS "assets_contractor_company_id_idx" ON "assets" USING btree ("contractor_company_id");
CREATE INDEX IF NOT EXISTS "assets_registration_number_idx" ON "assets" USING btree ("registration_number");

-- Default Pairings (truck-trailer)
CREATE TABLE IF NOT EXISTS "default_pairings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "truck_id" uuid NOT NULL REFERENCES "assets"("id"),
  "trailer_id" uuid NOT NULL REFERENCES "assets"("id"),
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "default_pairings_truck_id_idx" ON "default_pairings" USING btree ("truck_id");
CREATE INDEX IF NOT EXISTS "default_pairings_trailer_id_idx" ON "default_pairings" USING btree ("trailer_id");

-- Seed default asset categories
INSERT INTO "asset_categories" ("name", "type", "industry_type", "enable_specifications", "enable_weight_specs", "enable_mass_scheme", "enable_engine_hours", "enable_capacity_fields", "enable_registration", "sort_order")
VALUES
  ('Trucks', 'truck', 'transport', true, true, true, false, false, true, 0),
  ('Trailers', 'trailer', 'transport', true, true, true, false, false, true, 1),
  ('Equipment', 'equipment', 'construction', true, false, false, true, true, true, 2),
  ('Tools', 'tool', 'general', false, false, false, false, false, false, 3);
