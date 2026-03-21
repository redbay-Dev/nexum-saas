-- 0006: Pricing depth, scheduling deallocation
-- Adds variation tracking and source tracking to pricing lines.
-- Adds deallocation fields to job assignments.

-- Pricing line enrichment
ALTER TABLE job_pricing_lines ADD COLUMN planned_quantity numeric(12,4);
ALTER TABLE job_pricing_lines ADD COLUMN planned_unit_rate numeric(12,4);
ALTER TABLE job_pricing_lines ADD COLUMN planned_total numeric(14,2);
ALTER TABLE job_pricing_lines ADD COLUMN is_variation boolean NOT NULL DEFAULT false;
ALTER TABLE job_pricing_lines ADD COLUMN variation_reason text;
ALTER TABLE job_pricing_lines ADD COLUMN source varchar(20) NOT NULL DEFAULT 'manual';
ALTER TABLE job_pricing_lines ADD COLUMN source_reference_id uuid;

-- Scheduling deallocation
ALTER TABLE job_assignments ADD COLUMN deallocation_reason varchar(30);
ALTER TABLE job_assignments ADD COLUMN completed_loads integer;
