-- Replace user_id-based commission configs with per-role configs

-- 1. Add role column (default USER so existing rows survive)
ALTER TABLE commission_configs
  ADD COLUMN role TEXT NOT NULL DEFAULT 'USER'
  CHECK (role IN ('USER', 'DRIVER', 'SUPPLIER'));

-- 2. Drop old partial unique indexes that reference user_id
DROP INDEX IF EXISTS commission_configs_user_unique;
DROP INDEX IF EXISTS commission_configs_tenant_default_unique;

-- 3. Drop FK constraint and user_id column
ALTER TABLE commission_configs DROP CONSTRAINT IF EXISTS commission_configs_user_id_fkey;
ALTER TABLE commission_configs DROP COLUMN IF EXISTS user_id;

-- 4. Add new unique constraint: one config per tenant + role + date
ALTER TABLE commission_configs
  ADD CONSTRAINT commission_configs_tenant_role_date_unique
  UNIQUE (tenant_id, role, effective_date);
