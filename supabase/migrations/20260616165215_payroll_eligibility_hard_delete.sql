-- Claim eligibility moves from soft-delete (removed_at) to hard-delete:
-- row exists = eligible, row absent = not eligible. Claims themselves already
-- snapshot their own data at submission time, so eligibility doesn't need an
-- audit trail the way payroll_commissions/payroll_claims do.

-- This policy reads removed_at directly, so it must be dropped/recreated
-- before the column can go.
drop policy "users can read eligible claim types" on payroll_claim_types;
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
      )
    )
  );

delete from payroll_claim_eligibility where removed_at is not null;
alter table payroll_claim_eligibility drop column removed_at;
