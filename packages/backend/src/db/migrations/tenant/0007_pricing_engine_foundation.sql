-- Phase 1: Pricing Engine Foundation
-- Extend job_pricing_lines for credits, snapshots, and automation tracing
-- Extend organisation for quote pricing mode and rate review config

-- Credit support
ALTER TABLE job_pricing_lines ADD COLUMN credit_type varchar(20);
ALTER TABLE job_pricing_lines ADD COLUMN original_line_id uuid REFERENCES job_pricing_lines(id);

-- Snapshot & immutability
ALTER TABLE job_pricing_lines ADD COLUMN snapshot_at timestamptz;

-- Rate card tracing
ALTER TABLE job_pricing_lines ADD COLUMN used_customer_pricing boolean NOT NULL DEFAULT false;
ALTER TABLE job_pricing_lines ADD COLUMN rate_card_entry_id uuid;

-- Automation tracing
ALTER TABLE job_pricing_lines ADD COLUMN surcharge_id uuid;
ALTER TABLE job_pricing_lines ADD COLUMN markup_rule_id uuid;

-- Margin override
ALTER TABLE job_pricing_lines ADD COLUMN margin_override_reason text;

-- Organisation pricing configuration
ALTER TABLE organisation ADD COLUMN quote_pricing_mode varchar(30) NOT NULL DEFAULT 'lock_at_quote';
ALTER TABLE organisation ADD COLUMN stale_rate_threshold_days integer NOT NULL DEFAULT 180;
