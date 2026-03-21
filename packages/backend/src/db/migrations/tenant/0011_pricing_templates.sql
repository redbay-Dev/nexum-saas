-- Phase 5: Pricing Templates
-- Reusable pricing line sets that can be applied to any job

CREATE TABLE pricing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE pricing_template_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES pricing_templates(id) ON DELETE CASCADE,
  line_type VARCHAR(10) NOT NULL,
  category VARCHAR(20) NOT NULL,
  description TEXT,
  rate_type VARCHAR(20) NOT NULL,
  unit_rate NUMERIC(12,4),
  quantity NUMERIC(12,4),
  party_id UUID REFERENCES companies(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pricing_template_lines_template_id_idx ON pricing_template_lines(template_id);
