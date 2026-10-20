create table payroll_commission_types (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id),
  name       text not null,
  slug       text not null,
  is_enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, slug)
);

alter table payroll_commission_types enable row level security;

create policy "tenant members can read commission types"
  on payroll_commission_types for select
  using (tenant_id = any(user_tenant_ids()));

create policy "admins can manage commission types"
  on payroll_commission_types for all
  using (
    tenant_id = any(user_tenant_ids())
    and exists (select 1 from users where id = auth.uid() and role = 'ADMIN')
  )
  with check (
    tenant_id = any(user_tenant_ids())
    and exists (select 1 from users where id = auth.uid() and role = 'ADMIN')
  );
