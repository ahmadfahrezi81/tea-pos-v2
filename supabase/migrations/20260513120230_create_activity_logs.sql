create table public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  store_id    uuid references public.stores(id) on delete set null,

  type        text not null,
  ref_id      uuid,
  ref_table   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- known types: 'order_created' | 'daily_summary_closed' | 'photo_uploaded' | 'expense_created'
-- metadata examples:
--   order_created        → { total_amount, total_cups, payment_method }
--   daily_summary_closed → { total_sales, variance }
--   photo_uploaded       → { photo_url, slot }
--   expense_created      → { amount, description }

create index on public.activity_logs (tenant_id, created_at desc);
create index on public.activity_logs (user_id, created_at desc);
create index on public.activity_logs (store_id, created_at desc);
create index on public.activity_logs (type);

alter table public.activity_logs enable row level security;

create policy "tenant members can read activity logs"
  on public.activity_logs for select to authenticated
  using (
    tenant_id in (
      select tenant_id from public.user_tenant_assignments where user_id = auth.uid()
    )
  );

create policy "authenticated users can insert activity logs"
  on public.activity_logs for insert to authenticated
  with check (
    tenant_id in (
      select tenant_id from public.user_tenant_assignments where user_id = auth.uid()
    )
  );
