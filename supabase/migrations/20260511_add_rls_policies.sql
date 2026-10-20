-- ============================================================
-- RLS Policies
-- Applied to staging:
-- Applied to prod:
-- ============================================================

-- ─── Helper function ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.user_tenant_ids()
RETURNS uuid[] AS $$
  SELECT ARRAY(
    SELECT tenant_id
    FROM user_tenant_assignments
    WHERE user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Enable RLS ──────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summary_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenant_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_store_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE weather_hourly ENABLE ROW LEVEL SECURITY;

-- ─── Drop existing policies ───────────────────────────────────

DROP POLICY IF EXISTS "authenticated users can insert feedbacks" ON customer_feedbacks;
DROP POLICY IF EXISTS "authenticated users can view all feedbacks" ON customer_feedbacks;
DROP POLICY IF EXISTS "Service role can update payments" ON payments;
DROP POLICY IF EXISTS "Tenant members can insert payments" ON payments;
DROP POLICY IF EXISTS "Tenant members can view their payments" ON payments;

-- ─── profiles ────────────────────────────────────────────────
-- No tenant_id — isolated by auth user id

CREATE POLICY "profiles: read own" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles: update own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- ─── tenants ─────────────────────────────────────────────────

CREATE POLICY "tenants: tenant read" ON tenants
  FOR SELECT USING (id = ANY(public.user_tenant_ids()));

-- ─── user_tenant_assignments ─────────────────────────────────

CREATE POLICY "user_tenant_assignments: read own" ON user_tenant_assignments
  FOR SELECT USING (user_id = auth.uid());

-- ─── user_store_assignments ──────────────────────────────────
-- No tenant_id — join via stores

CREATE POLICY "user_store_assignments: tenant read" ON user_store_assignments
  FOR SELECT USING (
    store_id IN (
      SELECT id FROM stores
      WHERE tenant_id = ANY(public.user_tenant_ids())
    )
  );

-- ─── stores ──────────────────────────────────────────────────

CREATE POLICY "stores: tenant read" ON stores
  FOR SELECT USING (tenant_id = ANY(public.user_tenant_ids()));

-- ─── products ────────────────────────────────────────────────

CREATE POLICY "products: tenant read" ON products
  FOR SELECT USING (tenant_id = ANY(public.user_tenant_ids()));

-- ─── product_categories ──────────────────────────────────────

CREATE POLICY "product_categories: tenant read" ON product_categories
  FOR SELECT USING (tenant_id = ANY(public.user_tenant_ids()));

-- ─── orders ──────────────────────────────────────────────────

CREATE POLICY "orders: tenant read" ON orders
  FOR SELECT USING (tenant_id = ANY(public.user_tenant_ids()));

-- ─── order_items ─────────────────────────────────────────────

CREATE POLICY "order_items: tenant read" ON order_items
  FOR SELECT USING (tenant_id = ANY(public.user_tenant_ids()));

-- ─── payments ────────────────────────────────────────────────

CREATE POLICY "payments: tenant read" ON payments
  FOR SELECT USING (tenant_id = ANY(public.user_tenant_ids()));

CREATE POLICY "payments: tenant insert" ON payments
  FOR INSERT WITH CHECK (tenant_id = ANY(public.user_tenant_ids()));

CREATE POLICY "payments: service role update" ON payments
  FOR UPDATE USING (true);

-- ─── expenses ────────────────────────────────────────────────

CREATE POLICY "expenses: tenant read" ON expenses
  FOR SELECT USING (tenant_id = ANY(public.user_tenant_ids()));

-- ─── daily_summaries ─────────────────────────────────────────

CREATE POLICY "daily_summaries: tenant read" ON daily_summaries
  FOR SELECT USING (tenant_id = ANY(public.user_tenant_ids()));

-- ─── daily_summary_photos ────────────────────────────────────

CREATE POLICY "daily_summary_photos: tenant read" ON daily_summary_photos
  FOR SELECT USING (tenant_id = ANY(public.user_tenant_ids()));

-- ─── customer_feedbacks ──────────────────────────────────────

CREATE POLICY "customer_feedbacks: tenant read" ON customer_feedbacks
  FOR SELECT USING (tenant_id = ANY(public.user_tenant_ids()));

CREATE POLICY "customer_feedbacks: tenant insert" ON customer_feedbacks
  FOR INSERT WITH CHECK (tenant_id = ANY(public.user_tenant_ids()));

-- ─── notification_events ─────────────────────────────────────

CREATE POLICY "notification_events: tenant read" ON notification_events
  FOR SELECT USING (tenant_id = ANY(public.user_tenant_ids()));

-- ─── notification_reads ──────────────────────────────────────
-- No tenant_id — isolated by recipient_id

CREATE POLICY "notification_reads: read own" ON notification_reads
  FOR SELECT USING (recipient_id = auth.uid());

-- ─── tenant_invites ──────────────────────────────────────────

CREATE POLICY "tenant_invites: tenant read" ON tenant_invites
  FOR SELECT USING (tenant_id = ANY(public.user_tenant_ids()));

-- ─── weather_hourly ──────────────────────────────────────────
-- No tenant isolation — shared data, read only

CREATE POLICY "weather_hourly: authenticated read" ON weather_hourly
  FOR SELECT USING (auth.role() = 'authenticated'::text);
