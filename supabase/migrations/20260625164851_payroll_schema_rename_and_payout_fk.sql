-- Payroll schema rename + payout_id FK.
--
-- Renames:
--   payroll_commission_types  → payroll_commission_configs
--   payroll_claim_types       → payroll_claim_configs
--   payroll_claim_eligibility → payroll_user_claim_assignments
--   commission_type_id        → commission_config_id  (on commissions, user_claim_assignments, user_info)
--   claim_type_id             → claim_config_id       (on claims, user_claim_assignments)
--   gross_pay                 → total_commission      (on commissions)
--
-- Also:
--   Drop removed_at from payroll_user_claim_assignments (hard-delete already in use)
--   Fix payroll_claim_configs.frequency CHECK to include 'daily'
--   Rebuild payroll_claims_weekly_unique (dropped by drop-periods migration)
--   Add nullable payout_id FK on commissions and claims + backfill

BEGIN;

-- ─── 1. Drop the RLS policy that references payroll_claim_eligibility by name ──
-- Must happen before renames so we don't end up with a permanently broken policy.
DROP POLICY IF EXISTS "users can read eligible claim types" ON payroll_claim_types;

-- ─── 2. Rename tables ─────────────────────────────────────────────────────────
ALTER TABLE payroll_commission_types  RENAME TO payroll_commission_configs;
ALTER TABLE payroll_claim_types       RENAME TO payroll_claim_configs;
ALTER TABLE payroll_claim_eligibility RENAME TO payroll_user_claim_assignments;

-- ─── 3. Drop removed_at (soft-delete column, service already hard-deletes) ────
ALTER TABLE payroll_user_claim_assignments DROP COLUMN IF EXISTS removed_at;

-- ─── 4. Rename columns ────────────────────────────────────────────────────────
-- PostgreSQL auto-updates FK constraints, index columns, and partial index
-- predicates when columns are renamed — no manual index/constraint fixup needed.

ALTER TABLE payroll_commissions          RENAME COLUMN commission_type_id TO commission_config_id;
ALTER TABLE payroll_commissions          RENAME COLUMN gross_pay           TO total_commission;

ALTER TABLE payroll_claims                RENAME COLUMN claim_type_id TO claim_config_id;
ALTER TABLE payroll_user_claim_assignments RENAME COLUMN claim_type_id TO claim_config_id;
ALTER TABLE payroll_user_info             RENAME COLUMN commission_type_id TO commission_config_id;

-- ─── 5. Fix frequency CHECK on payroll_claim_configs ─────────────────────────
-- Original constraint only allowed ('weekly', 'monthly', 'one_time').
-- 'daily' was used in the auto_claims migration but the CHECK was never updated.
ALTER TABLE payroll_claim_configs
    DROP CONSTRAINT IF EXISTS payroll_claim_types_frequency_check;

ALTER TABLE payroll_claim_configs
    ADD CONSTRAINT payroll_claim_configs_frequency_check
    CHECK (frequency IN ('daily', 'weekly', 'monthly', 'one_time'));

-- ─── 6. Recreate broken RLS policy with updated table/column names ────────────
CREATE POLICY "users can read eligible claim configs"
    ON payroll_claim_configs FOR SELECT
    USING (
        tenant_id = ANY(user_tenant_ids())
        AND (
            EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'ADMIN')
            OR EXISTS (
                SELECT 1 FROM payroll_user_claim_assignments puca
                WHERE puca.claim_config_id = payroll_claim_configs.id
                  AND puca.user_id = auth.uid()
            )
        )
    );

-- ─── 7. Rebuild payroll_claims_weekly_unique ──────────────────────────────────
-- The drop-periods migration dropped payroll_period_id from payroll_claims,
-- which auto-dropped this index (it was part of the index columns).
-- Rebuild using ISO week Monday (date - isodow + 1) — an immutable expression.
-- claim_type_id was just renamed to claim_config_id above, so use the new name.
CREATE UNIQUE INDEX payroll_claims_weekly_unique
    ON payroll_claims (tenant_id, user_id, claim_config_id,
                       (date - (extract(isodow FROM date)::int - 1)))
    WHERE status != 'rejected' AND frequency = 'weekly';

-- ─── 8. Add payout_id FK to payroll_commissions ───────────────────────────────
ALTER TABLE payroll_commissions
    ADD COLUMN payout_id uuid REFERENCES payroll_payouts(id) ON DELETE SET NULL;

CREATE INDEX payroll_commissions_payout_id_idx
    ON payroll_commissions (payout_id)
    WHERE payout_id IS NOT NULL;

-- ─── 9. Add payout_id FK to payroll_claims ────────────────────────────────────
ALTER TABLE payroll_claims
    ADD COLUMN payout_id uuid REFERENCES payroll_payouts(id) ON DELETE SET NULL;

CREATE INDEX payroll_claims_payout_id_idx
    ON payroll_claims (payout_id)
    WHERE payout_id IS NOT NULL;

-- ─── 10. Backfill payout_id on existing rows ─────────────────────────────────
UPDATE payroll_commissions c
SET    payout_id = p.id
FROM   payroll_payouts p
WHERE  c.payout_id IS NULL
  AND  c.tenant_id = p.tenant_id
  AND  c.user_id   = p.user_id
  AND  c.date BETWEEN p.start_date AND p.end_date;

UPDATE payroll_claims cl
SET    payout_id = p.id
FROM   payroll_payouts p
WHERE  cl.payout_id IS NULL
  AND  cl.tenant_id = p.tenant_id
  AND  cl.user_id   = p.user_id
  AND  cl.date BETWEEN p.start_date AND p.end_date;

COMMIT;
