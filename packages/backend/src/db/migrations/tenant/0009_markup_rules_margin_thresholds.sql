-- Phase 3: Markup Rules + Margin Thresholds
-- Priority-based markup rules for cost-to-revenue auto-generation
-- Multi-level margin thresholds for pricing validation

CREATE TABLE markup_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL,
  markup_percentage NUMERIC(8,4),
  markup_fixed_amount NUMERIC(12,4),
  material_category_id UUID REFERENCES material_categories(id),
  supplier_id UUID REFERENCES companies(id),
  priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX markup_rules_priority_idx ON markup_rules(priority);
CREATE INDEX markup_rules_material_category_idx ON markup_rules(material_category_id);
CREATE INDEX markup_rules_supplier_idx ON markup_rules(supplier_id);

CREATE TABLE margin_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level VARCHAR(20) NOT NULL,
  reference_id UUID,
  minimum_margin_percent NUMERIC(8,4) NOT NULL,
  warning_margin_percent NUMERIC(8,4) NOT NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX margin_thresholds_level_idx ON margin_thresholds(level, reference_id);
