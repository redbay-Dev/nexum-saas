-- Doc 01 completion: entry point media, region default resources
-- Entry points: add media JSONB column for photos, maps, diagrams
ALTER TABLE entry_points ADD COLUMN IF NOT EXISTS media jsonb;

-- Regions: add default asset and driver ID arrays
ALTER TABLE regions ADD COLUMN IF NOT EXISTS default_asset_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE regions ADD COLUMN IF NOT EXISTS default_driver_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
