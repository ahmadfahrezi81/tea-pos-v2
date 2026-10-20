-- ============================================================
-- Drop all stale RLS policies on assignment tables and
-- recreate clean ones that don't reference the dropped role column.
-- Applied to staging:
-- Applied to prod:
-- ============================================================

-- ─── user_tenant_assignments ─────────────────────────────────
-- Drop every existing policy (including any that referenced role)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_tenant_assignments') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_tenant_assignments', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_tenant_assignments: read own" ON user_tenant_assignments
  FOR SELECT USING (user_id = auth.uid());

-- ─── user_store_assignments ──────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_store_assignments') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_store_assignments', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "user_store_assignments: tenant read" ON user_store_assignments
  FOR SELECT USING (
    store_id IN (
      SELECT id FROM stores
      WHERE tenant_id = ANY(public.user_tenant_ids())
    )
  );
