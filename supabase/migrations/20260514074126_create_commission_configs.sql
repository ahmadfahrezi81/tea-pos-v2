CREATE TABLE commission_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  user_id uuid REFERENCES profiles(id),
  rate_per_cup numeric NOT NULL,
  effective_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Unique index per user config (allows upsert)
CREATE UNIQUE INDEX commission_configs_user_unique
  ON commission_configs(tenant_id, user_id, effective_date)
  WHERE user_id IS NOT NULL;

-- Unique index for tenant-wide default (user_id IS NULL)
CREATE UNIQUE INDEX commission_configs_tenant_default_unique
  ON commission_configs(tenant_id, effective_date)
  WHERE user_id IS NULL;

ALTER TABLE commission_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access commission_configs"
  ON commission_configs FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);
