-- Auto claims: some claim types (e.g. meal allowances) are decided by the system
-- at close-day based on hours worked, instead of staff submitting them manually.

-- frequency: add 'daily' alongside weekly/monthly/one_time
drop index if exists payroll_claims_weekly_unique;
create unique index payroll_claims_weekly_unique
  on payroll_claims (tenant_id, user_id, claim_type_id, payroll_period_id)
  where status != 'rejected' and frequency = 'weekly';

create unique index payroll_claims_daily_unique
  on payroll_claims (tenant_id, user_id, claim_type_id, date)
  where status != 'rejected' and frequency = 'daily';

-- claim type config: who decides (manual staff submission vs system-decided) and the threshold
alter table payroll_claim_types
  add column claim_source text not null default 'manual',
  add column auto_threshold_hours integer;

alter table payroll_claim_types
  add constraint payroll_claim_types_claim_source_check
  check (claim_source in ('manual', 'auto'));

alter table payroll_claim_types
  add constraint payroll_claim_types_auto_threshold_check
  check (claim_source != 'auto' or auto_threshold_hours is not null);

-- claims: link auto-created rows back to the daily summary that triggered them,
-- and snapshot the hours worked behind the decision (for staff-facing explanations).
alter table payroll_claims
  add column daily_summary_id uuid references store_daily_summaries(id),
  add column hours_worked numeric;

-- Idempotency: a real DB constraint, not a check-then-act guard. Status-agnostic
-- (unlike payroll_claims_daily_unique, which excludes rejected rows so manual
-- claims can be resubmitted) so a retried close-day can't double-insert even a
-- rejected auto claim.
create unique index payroll_claims_auto_daily_summary_unique
  on payroll_claims (daily_summary_id, user_id, claim_type_id)
  where daily_summary_id is not null;
