create table payroll_user_info (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references tenants(id),
  user_id              uuid not null references users(id),
  commission_type_id   uuid references payroll_commission_types(id),
  rate_per_cup         integer not null,
  bank_name            text,
  bank_account_number  text,
  bank_account_holder  text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),
  unique (tenant_id, user_id)
);


alter table payroll_user_info enable row level security;

create policy "users can manage own payroll info"
  on payroll_user_info for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "admins can manage all payroll info in tenant"
  on payroll_user_info for all
  using (
    tenant_id = any(user_tenant_ids())
    and exists (select 1 from users where id = auth.uid() and role = 'ADMIN')
  )
  with check (
    tenant_id = any(user_tenant_ids())
    and exists (select 1 from users where id = auth.uid() and role = 'ADMIN')
  );
