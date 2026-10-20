CREATE TABLE supply_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  store_id         UUID NOT NULL REFERENCES stores(id),
  user_id          UUID NOT NULL REFERENCES profiles(id),
  daily_summary_id UUID REFERENCES daily_summaries(id),
  type             TEXT NOT NULL CHECK (type IN ('cups','bags','syrup','ice','tea','other')),
  notes            TEXT,
  photo_url        TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','acknowledged','fulfilled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE supply_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read" ON supply_requests
  FOR SELECT USING (tenant_id = ANY(user_tenant_ids()));

CREATE POLICY "tenant_insert" ON supply_requests
  FOR INSERT WITH CHECK (tenant_id = ANY(user_tenant_ids()));
