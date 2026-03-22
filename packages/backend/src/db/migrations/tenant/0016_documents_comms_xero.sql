-- Migration 0016: Documents, Communications, and Xero Integration
-- Covers: doc 15 (Documents), doc 13 (Communications), doc 11 (Xero)

-- ══════════════════════════════════════════════════════════════════
-- ── Document Management (doc 15) ──
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(20) NOT NULL,
  entity_id UUID NOT NULL,
  document_type VARCHAR(30) NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  original_file_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  s3_key TEXT NOT NULL,
  s3_bucket VARCHAR(100) NOT NULL,
  checksum VARCHAR(64),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  storage_tier VARCHAR(10) NOT NULL DEFAULT 'hot',
  current_version INTEGER NOT NULL DEFAULT 1,
  issue_date VARCHAR(10),
  expiry_date VARCHAR(10),
  metadata JSONB,
  notes TEXT,
  uploaded_by TEXT NOT NULL,
  upload_source VARCHAR(20) NOT NULL DEFAULT 'direct',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX documents_entity_idx ON documents (entity_type, entity_id);
CREATE INDEX documents_type_idx ON documents (document_type);
CREATE INDEX documents_status_idx ON documents (status);
CREATE INDEX documents_expiry_date_idx ON documents (expiry_date);
CREATE INDEX documents_created_at_idx ON documents (created_at);

CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  version_number INTEGER NOT NULL,
  file_name VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  s3_key TEXT NOT NULL,
  checksum VARCHAR(64),
  is_current BOOLEAN NOT NULL DEFAULT false,
  uploaded_by TEXT NOT NULL,
  upload_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX document_versions_document_id_idx ON document_versions (document_id);
CREATE INDEX document_versions_current_idx ON document_versions (document_id, is_current) WHERE is_current = true;

CREATE TABLE public_document_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  token VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  expires_at TIMESTAMPTZ NOT NULL,
  max_downloads INTEGER,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX public_document_links_token_idx ON public_document_links (token);
CREATE INDEX public_document_links_document_id_idx ON public_document_links (document_id);

CREATE TABLE document_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id),
  access_method VARCHAR(20) NOT NULL,
  action VARCHAR(20) NOT NULL,
  user_id TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  public_link_id UUID REFERENCES public_document_links(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX document_access_log_document_id_idx ON document_access_log (document_id);
CREATE INDEX document_access_log_created_at_idx ON document_access_log (created_at);

-- ══════════════════════════════════════════════════════════════════
-- ── Communications (doc 13) ──
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  communication_type VARCHAR(50) NOT NULL,
  category VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  action_url TEXT,
  action_label VARCHAR(100),
  entity_type VARCHAR(50),
  entity_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'unread',
  read_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX notifications_user_id_idx ON notifications (user_id);
CREATE INDEX notifications_status_idx ON notifications (user_id, status);
CREATE INDEX notifications_created_at_idx ON notifications (created_at);
CREATE INDEX notifications_category_idx ON notifications (category);

CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  global_enabled BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  sms_enabled BOOLEAN NOT NULL DEFAULT true,
  in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_start VARCHAR(5),
  quiet_hours_end VARCHAR(5),
  channel_overrides JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_addresses JSONB NOT NULL,
  cc_addresses JSONB,
  bcc_addresses JSONB,
  subject VARCHAR(500) NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  attachments JSONB,
  entity_type VARCHAR(50),
  entity_id UUID,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  stagger_delay_ms INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX email_queue_status_idx ON email_queue (status);
CREATE INDEX email_queue_scheduled_at_idx ON email_queue (scheduled_at);
CREATE INDEX email_queue_entity_idx ON email_queue (entity_type, entity_id);

CREATE TABLE communication_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(10) NOT NULL,
  communication_type VARCHAR(50) NOT NULL,
  recipient TEXT NOT NULL,
  subject VARCHAR(500),
  body_preview TEXT,
  entity_type VARCHAR(50),
  entity_id UUID,
  status VARCHAR(20) NOT NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX communication_log_entity_idx ON communication_log (entity_type, entity_id);
CREATE INDEX communication_log_channel_idx ON communication_log (channel);
CREATE INDEX communication_log_created_at_idx ON communication_log (created_at);
CREATE INDEX communication_log_recipient_idx ON communication_log (recipient);

-- ══════════════════════════════════════════════════════════════════
-- ── Xero Integration (doc 11) ──
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE xero_connection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  xero_tenant_id VARCHAR(100) NOT NULL,
  xero_org_name VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'disconnected',
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT,
  connected_by TEXT,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  last_error TEXT,
  -- Sync settings
  auto_create_contacts BOOLEAN NOT NULL DEFAULT true,
  auto_sync_payments BOOLEAN NOT NULL DEFAULT true,
  poll_interval_minutes INTEGER NOT NULL DEFAULT 15,
  batch_size INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE xero_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  xero_account_id VARCHAR(100) NOT NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  account_type VARCHAR(30) NOT NULL,
  tax_type VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX xero_accounts_code_idx ON xero_accounts (code);
CREATE INDEX xero_accounts_type_idx ON xero_accounts (account_type);

CREATE TABLE xero_tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  tax_type VARCHAR(30) NOT NULL,
  effective_rate NUMERIC(8, 4) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE xero_tracking_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  xero_category_id VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  options JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE xero_account_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pricing_category VARCHAR(50) NOT NULL,
  revenue_account_code VARCHAR(20),
  expense_account_code VARCHAR(20),
  tax_type VARCHAR(30),
  tracking_category_id VARCHAR(100),
  tracking_option_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX xero_account_mappings_category_idx ON xero_account_mappings (pricing_category);

CREATE TABLE xero_contact_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  xero_contact_id VARCHAR(100) NOT NULL,
  is_customer BOOLEAN NOT NULL DEFAULT false,
  is_supplier BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX xero_contact_links_company_idx ON xero_contact_links (company_id);
CREATE INDEX xero_contact_links_xero_id_idx ON xero_contact_links (xero_contact_id);

CREATE TABLE xero_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type VARCHAR(30) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  resource_id UUID,
  xero_resource_id VARCHAR(100),
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  request_data JSONB,
  response_data JSONB,
  triggered_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX xero_sync_log_type_idx ON xero_sync_log (sync_type);
CREATE INDEX xero_sync_log_status_idx ON xero_sync_log (status);
CREATE INDEX xero_sync_log_resource_idx ON xero_sync_log (resource_id);
CREATE INDEX xero_sync_log_created_at_idx ON xero_sync_log (created_at);

-- ══════════════════════════════════════════════════════════════════
-- ── Batch Billing Runs (doc 10 deepening) ──
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE billing_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  period_start VARCHAR(10) NOT NULL,
  period_end VARCHAR(10) NOT NULL,
  customer_count INTEGER NOT NULL DEFAULT 0,
  invoice_count INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  preview_data JSONB,
  report_data JSONB,
  started_by TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX billing_runs_status_idx ON billing_runs (status);
CREATE INDEX billing_runs_period_idx ON billing_runs (period_start, period_end);

CREATE TABLE billing_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_run_id UUID NOT NULL REFERENCES billing_runs(id),
  customer_id UUID NOT NULL REFERENCES companies(id),
  invoice_id UUID REFERENCES invoices(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  job_count INTEGER NOT NULL DEFAULT 0,
  estimated_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  actual_total NUMERIC(14, 2),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX billing_run_items_run_id_idx ON billing_run_items (billing_run_id);
CREATE INDEX billing_run_items_customer_id_idx ON billing_run_items (customer_id);

-- ══════════════════════════════════════════════════════════════════
-- ── Invoice/RCTI PDF tracking columns ──
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE invoices ADD COLUMN pdf_document_id UUID REFERENCES documents(id);
ALTER TABLE invoices ADD COLUMN billing_run_id UUID REFERENCES billing_runs(id);
ALTER TABLE rctis ADD COLUMN pdf_document_id UUID REFERENCES documents(id);
ALTER TABLE rctis ADD COLUMN remittance_pdf_document_id UUID REFERENCES documents(id);
