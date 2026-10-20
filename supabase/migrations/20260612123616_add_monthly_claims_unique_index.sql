-- DB-level uniqueness for monthly claims (weekly and one_time already have indexes).
-- Cast date to text first (immutable), then slice YYYY-MM for month-level uniqueness.
CREATE UNIQUE INDEX payroll_claims_monthly_unique
  ON payroll_claims (tenant_id, user_id, claim_type_id, (extract(year from date)::int * 100 + extract(month from date)::int))
  WHERE status != 'rejected' AND frequency = 'monthly';
