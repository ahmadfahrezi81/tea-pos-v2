-- A payout can now be closed without a transfer: status 'skipped'.
--
-- The column has carried no CHECK constraint since
-- 20260616161812_payroll_status_simplification.sql, which dropped the legacy one
-- and never replaced it. This puts the constraint back with the correct set
-- rather than leaving the allowed values documented only in Zod.

alter table payroll_payouts
  drop constraint if exists payroll_payouts_status_check;

alter table payroll_payouts
  add constraint payroll_payouts_status_check
  check (status in ('pending', 'paid', 'skipped'));
