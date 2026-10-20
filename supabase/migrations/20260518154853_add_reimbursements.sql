CREATE TABLE reimbursements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  user_id           UUID NOT NULL REFERENCES profiles(id),
  store_id          UUID REFERENCES stores(id),
  payroll_period_id UUID REFERENCES payroll_periods(id),
  type              TEXT NOT NULL CHECK (type IN ('mobile_data', 'lunch', 'gasoline')),
  amount            NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  date              DATE NOT NULL,
  notes             TEXT,
  photo_url         TEXT,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_read" ON reimbursements
  FOR SELECT USING (tenant_id = ANY(user_tenant_ids()));

CREATE POLICY "tenant_insert" ON reimbursements
  FOR INSERT WITH CHECK (
    tenant_id = ANY(user_tenant_ids())
    AND user_id = auth.uid()
  );

-- ADMIN UPDATE policy to be added when admin approval UI is built.
-- Will allow setting payroll_period_id, status (approved/rejected/paid).
