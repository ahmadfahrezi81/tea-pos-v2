CREATE TABLE incident_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  store_id         UUID NOT NULL REFERENCES stores(id),
  user_id          UUID NOT NULL REFERENCES profiles(id),
  daily_summary_id UUID REFERENCES daily_summaries(id),
  category         TEXT NOT NULL CHECK (category IN ('equipment','safety','hygiene','other')),
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  photo_url        TEXT,
  status           TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','acknowledged','resolved')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read" ON incident_reports
  FOR SELECT USING (tenant_id = ANY(user_tenant_ids()));

CREATE POLICY "tenant_insert" ON incident_reports
  FOR INSERT WITH CHECK (tenant_id = ANY(user_tenant_ids()));
