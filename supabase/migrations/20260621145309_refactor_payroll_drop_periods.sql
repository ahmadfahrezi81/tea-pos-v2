-- Refactor payroll: drop payroll_periods entirely.
-- Payouts now own their date range (start_date, end_date, total_cups).
-- Commissions and claims are date-only — no period FK.
-- pay_frequency lives on payroll_user_info.

BEGIN;

-- 1. Add pay_frequency to payroll_user_info
ALTER TABLE payroll_user_info
    ADD COLUMN pay_frequency text NOT NULL DEFAULT 'bi_weekly'
    CHECK (pay_frequency IN ('daily', 'weekly', 'bi_weekly', 'monthly'));

-- 2. Add start_date, end_date, total_cups to payroll_payouts (nullable first, populate, then constrain)
ALTER TABLE payroll_payouts
    ADD COLUMN start_date date,
    ADD COLUMN end_date   date,
    ADD COLUMN total_cups integer NOT NULL DEFAULT 0;

-- 3. Populate start_date + end_date from payroll_periods before we drop anything
UPDATE payroll_payouts po
SET
    start_date = pp.start_date::date,
    end_date   = pp.end_date::date
FROM payroll_periods pp
WHERE po.payroll_period_id = pp.id;

-- 4. Populate total_cups from commissions (while payroll_period_id still exists on both)
UPDATE payroll_payouts po
SET total_cups = (
    SELECT COALESCE(SUM(pc.total_cups), 0)
    FROM payroll_commissions pc
    WHERE pc.tenant_id         = po.tenant_id
      AND pc.user_id           = po.user_id
      AND pc.payroll_period_id = po.payroll_period_id
);

-- 5. Lock in NOT NULL now that data is populated
ALTER TABLE payroll_payouts
    ALTER COLUMN start_date SET NOT NULL,
    ALTER COLUMN end_date   SET NOT NULL;

-- 6. Swap unique constraint on payouts: old was (tenant, period, user), new is (tenant, user, start_date)
ALTER TABLE payroll_payouts
    DROP CONSTRAINT IF EXISTS payroll_payouts_tenant_period_user_key;

ALTER TABLE payroll_payouts
    ADD CONSTRAINT payroll_payouts_tenant_user_start_key
    UNIQUE (tenant_id, user_id, start_date);

-- 7. Drop payroll_period_id from payroll_payouts
ALTER TABLE payroll_payouts
    DROP CONSTRAINT IF EXISTS payroll_payouts_payroll_period_id_fkey,
    DROP COLUMN payroll_period_id;

-- 8. Drop payroll_period_id from payroll_commissions
ALTER TABLE payroll_commissions
    DROP CONSTRAINT IF EXISTS payroll_commissions_payroll_period_id_fkey,
    DROP COLUMN payroll_period_id;

-- 9. Drop payroll_period_id and legacy type from payroll_claims
ALTER TABLE payroll_claims
    DROP CONSTRAINT IF EXISTS payroll_claims_payroll_period_id_fkey,
    DROP COLUMN payroll_period_id,
    DROP COLUMN IF EXISTS type;

-- 10. Drop payroll_periods (all FKs removed above)
DROP TABLE payroll_periods;

COMMIT;
