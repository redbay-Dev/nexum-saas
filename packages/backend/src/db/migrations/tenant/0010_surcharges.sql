-- Phase 4: Surcharges & Levies
-- Auto-applied pricing line additions (fuel levy, environmental surcharge, etc.)

CREATE TABLE surcharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL,
  value NUMERIC(12,4) NOT NULL,
  applies_to JSONB NOT NULL DEFAULT '[]',
  auto_apply BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE surcharge_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surcharge_id UUID NOT NULL REFERENCES surcharges(id),
  previous_value NUMERIC(12,4) NOT NULL,
  new_value NUMERIC(12,4) NOT NULL,
  effective_date DATE NOT NULL,
  changed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX surcharge_history_surcharge_id_idx ON surcharge_history(surcharge_id);
