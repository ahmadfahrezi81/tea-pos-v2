create table payroll_claim_types (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id),
  name       text not null,
  slug       text not null,
  frequency  text not null check (frequency in ('weekly', 'monthly', 'one_time')),
  is_enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, slug)
);

-- removed_at = null means active; set to now() to soft-revoke (preserves audit history)
create table payroll_claim_eligibility (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id),
  user_id       uuid not null references users(id),
  claim_type_id uuid not null references payroll_claim_types(id),
  removed_at    timestamptz,
  created_at    timestamptz default now(),
  unique (tenant_id, user_id, claim_type_id)
);

-- Used by getClaimableDates and weekly session validation
create index on store_sessions (tenant_id, user_id, started_at);

alter table payroll_claim_types enable row level security;

create policy "admins can manage claim types"
  on payroll_claim_types for all
  using (
    tenant_id = any(user_tenant_ids())
    and exists (select 1 from users where id = auth.uid() and role = 'ADMIN')
  )
  with check (
    tenant_id = any(user_tenant_ids())
    and exists (select 1 from users where id = auth.uid() and role = 'ADMIN')
  );

-- Users only see types they are actively eligible for
create policy "users can read eligible claim types"
  on payroll_claim_types for select
  using (
    tenant_id = any(user_tenant_ids())
    and (
      exists (select 1 from users where id = auth.uid() and role = 'ADMIN')
      or exists (
        select 1 from payroll_claim_eligibility pce
        where pce.claim_type_id = payroll_claim_types.id
          and pce.user_id = auth.uid()
          and pce.removed_at is null
      )
    )
  );

alter table payroll_claim_eligibility enable row level security;

create policy "admins can manage eligibility"
  on payroll_claim_eligibility for all
  using (
    tenant_id = any(user_tenant_ids())
    and exists (select 1 from users where id = auth.uid() and role = 'ADMIN')
  )
  with check (
    tenant_id = any(user_tenant_ids())
    and exists (select 1 from users where id = auth.uid() and role = 'ADMIN')
  );

create policy "users can read own eligibility"
  on payroll_claim_eligibility for select
  using (user_id = auth.uid());
