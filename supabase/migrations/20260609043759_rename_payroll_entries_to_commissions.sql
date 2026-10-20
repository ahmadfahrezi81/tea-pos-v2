-- Clear test data before rename
truncate payroll_entries;

alter table payroll_entries rename to payroll_commissions;

alter table payroll_commissions rename constraint payroll_entries_daily_summary_id_fkey to payroll_commissions_daily_summary_id_fkey;
alter table payroll_commissions rename constraint payroll_entries_payroll_period_id_fkey to payroll_commissions_payroll_period_id_fkey;
alter table payroll_commissions rename constraint payroll_entries_store_id_fkey to payroll_commissions_store_id_fkey;
alter table payroll_commissions rename constraint payroll_entries_tenant_id_fkey to payroll_commissions_tenant_id_fkey;
alter table payroll_commissions rename constraint payroll_entries_user_id_fkey to payroll_commissions_user_id_fkey;

alter table payroll_commissions
  add column commission_type_id uuid references payroll_commission_types(id),
  add column rate_per_unit      integer not null default 0;

alter table payroll_commissions
  alter column rate_per_unit drop default;

-- commission_type_id nullable: new rows set this from payroll_user_info.commission_type_id at calc time.
