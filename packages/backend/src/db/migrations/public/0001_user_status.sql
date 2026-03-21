-- 0001: Add status column to tenant_users for activation/deactivation
ALTER TABLE tenant_users ADD COLUMN status varchar(20) NOT NULL DEFAULT 'active';
