-- Phase 2: Customer Rate Cards
-- Per-customer negotiated rate cards with effective date ranges

CREATE TABLE customer_rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX customer_rate_cards_customer_id_idx ON customer_rate_cards(customer_id);
CREATE INDEX customer_rate_cards_active_idx ON customer_rate_cards(is_active) WHERE is_active = true;

CREATE TABLE customer_rate_card_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_card_id UUID NOT NULL REFERENCES customer_rate_cards(id) ON DELETE CASCADE,
  material_subcategory_id UUID REFERENCES material_subcategories(id),
  category VARCHAR(20) NOT NULL,
  rate_type VARCHAR(20) NOT NULL,
  unit_rate NUMERIC(12,4) NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX rate_card_entries_rate_card_id_idx ON customer_rate_card_entries(rate_card_id);
CREATE INDEX rate_card_entries_subcategory_idx ON customer_rate_card_entries(material_subcategory_id);
