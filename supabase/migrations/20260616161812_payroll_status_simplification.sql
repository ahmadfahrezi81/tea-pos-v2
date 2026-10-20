-- Unify payroll status model: "paid" only ever happens on payroll_payouts.
-- Leaf rows (commissions, claims) move pending -> approved/rejected, never paid directly.

-- Drop any legacy CHECK constraints on these status columns before changing values.
-- IF EXISTS guards make wrong name guesses harmless (constraints aren't renamed when
-- their table is renamed, so names may still reference old table names).
alter table payroll_periods drop constraint if exists payroll_periods_status_check;
alter table payroll_commissions drop constraint if exists payroll_entries_status_check;
alter table payroll_commissions drop constraint if exists payroll_commissions_status_check;
alter table payroll_claims drop constraint if exists reimbursements_status_check;
alter table payroll_claims drop constraint if exists payroll_reimbursements_status_check;
alter table payroll_claims drop constraint if exists payroll_claims_status_check;
alter table payroll_payouts drop constraint if exists payroll_payouts_status_check;

-- periods: drop status, add closed_at
alter table payroll_periods add column closed_at timestamptz;
alter table payroll_periods drop column status;

-- payouts: collapse approved/on_hold -> pending (no paid rows expected to exist yet)
update payroll_payouts set status = 'pending' where status in ('approved', 'on_hold');

-- payouts: real upsert needs a unique constraint backing it
alter table payroll_payouts
  add constraint payroll_payouts_tenant_period_user_key
  unique (tenant_id, payroll_period_id, user_id);

-- commissions: collapse draft -> pending; paid -> approved (paid no longer valid at this level)
update payroll_commissions set status = 'pending' where status = 'draft';
update payroll_commissions set status = 'approved' where status = 'paid';
alter table payroll_commissions alter column status set default 'pending';

-- claims: paid -> approved; drop now-dead claim-level paid columns
-- (separate from payroll_payouts' own paid_at/paid_by/payment_proof_url, which stay)
update payroll_claims set status = 'approved' where status = 'paid';
alter table payroll_claims drop column if exists paid_at;
alter table payroll_claims drop column if exists paid_by;
alter table payroll_claims drop column if exists payment_proof_url;
