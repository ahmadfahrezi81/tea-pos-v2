-- payroll_periods and payroll_entries merged into one file due to identical
-- auto-generated timestamps (entries must reference periods, so both are here in order)

CREATE TABLE payroll_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'processing', 'paid')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, start_date)
);

ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access payroll_periods"
  ON payroll_periods FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ---

CREATE TABLE payroll_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  payroll_period_id uuid NOT NULL REFERENCES payroll_periods(id),
  daily_summary_id uuid NOT NULL REFERENCES daily_summaries(id),
  date date NOT NULL,
  total_cups integer NOT NULL DEFAULT 0,
  rate_per_cup numeric NOT NULL,
  gross_pay numeric NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (daily_summary_id, user_id)
);

ALTER TABLE payroll_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access payroll_entries"
  ON payroll_entries FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);
