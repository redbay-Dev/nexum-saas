-- Phase 6: Price History & Versioning
-- Track all material price changes with effective dates and bulk update grouping

CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(30) NOT NULL,
  entity_id UUID NOT NULL,
  previous_price NUMERIC(12,4),
  new_price NUMERIC(12,4) NOT NULL,
  effective_date DATE NOT NULL,
  change_source VARCHAR(20) NOT NULL,
  changed_by TEXT NOT NULL,
  bulk_update_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX price_history_entity_idx ON price_history(entity_type, entity_id);
CREATE INDEX price_history_effective_date_idx ON price_history(effective_date);
CREATE INDEX price_history_bulk_update_id_idx ON price_history(bulk_update_id);
