-- ============================================================
-- Remove role from assignments, update profiles role constraint
-- Applied to staging:
-- Applied to prod:
-- ============================================================

-- ─── Remove role from user_tenant_assignments ─────────────────

ALTER TABLE user_tenant_assignments DROP COLUMN IF EXISTS role;

-- ─── Remove role from user_store_assignments ──────────────────

ALTER TABLE user_store_assignments DROP COLUMN IF EXISTS role;

-- ─── Update profiles role constraint ─────────────────────────

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role = ANY (ARRAY['USER'::text, 'ADMIN'::text, 'DRIVER'::text, 'SUPPLIER'::text]));
