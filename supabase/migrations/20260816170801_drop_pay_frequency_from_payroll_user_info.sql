-- Removes the per-user pay cadence, now that the tenant owns it.
--
-- 20260815165659 moved the cadence to tenants.pay_frequency and left this column
-- in place, unread, so the previous build could still be rolled back to. Nothing
-- reads it: every window is computed from getTenantPayFrequency, and the
-- payroll_user_info upsert never writes this field.
--
-- Run this only once the release that moved the cadence has settled in
-- production. Until then the column is the rollback path, and dropping it
-- removes the ability to go back.
--
-- After running: pnpm types:db.

BEGIN;

ALTER TABLE payroll_user_info
    DROP COLUMN pay_frequency;

COMMIT;
