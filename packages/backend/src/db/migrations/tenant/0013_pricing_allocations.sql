-- Phase 8: Pricing Allocations + Hourly Rate Fields
-- Multi-customer job splits and overtime rate support

CREATE TABLE pricing_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_line_id UUID NOT NULL REFERENCES job_pricing_lines(id),
  customer_id UUID NOT NULL REFERENCES companies(id),
  amount NUMERIC(14,2) NOT NULL,
  percentage NUMERIC(8,4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX pricing_allocations_line_id_idx ON pricing_allocations(pricing_line_id);
CREATE INDEX pricing_allocations_customer_id_idx ON pricing_allocations(customer_id);

-- Hourly rate fields on jobs
ALTER TABLE jobs ADD COLUMN overtime_rate NUMERIC(12,4);
ALTER TABLE jobs ADD COLUMN overtime_threshold_hours NUMERIC(6,2);
