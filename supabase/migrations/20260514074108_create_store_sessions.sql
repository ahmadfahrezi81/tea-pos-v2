CREATE TABLE store_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  store_id uuid NOT NULL REFERENCES stores(id),
  daily_summary_id uuid NOT NULL REFERENCES daily_summaries(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  claim_code varchar(6) NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  previous_session_id uuid REFERENCES store_sessions(id),
  created_at timestamptz DEFAULT now()
);

-- Only one active session per store at a time
CREATE UNIQUE INDEX one_active_session_per_store
  ON store_sessions(store_id)
  WHERE status = 'active';

ALTER TABLE store_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can access store_sessions"
  ON store_sessions FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL);
