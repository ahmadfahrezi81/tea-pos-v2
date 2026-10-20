-- Pay frequency becomes a tenant fact.
--
-- It has lived on payroll_user_info since payroll_periods was dropped, but every
-- staff member is on the same cadence, so the per-user column had no owner: the
-- backoffice resolved it by scanning all staff records and taking the most
-- common value. This gives it a home.
--
-- Ships as 'bi_weekly' — the value every staff record already holds — so pay
-- windows come out identical to today. Switching to weekly is a separate
-- one-line UPDATE, run after a payout so no in-flight payout is reshaped.
--
-- Two values from the old per-user column are not carried over, and neither is
-- in use:
--
--   'daily'   — a one-day period. Every cadence here is a whole number of weeks
--               running Monday to Sunday, which is what lets a cadence change
--               hand over cleanly on any Monday. A daily period breaks that.
--   'monthly' — replaced by 'four_weekly'. A calendar month cannot end on a
--               Sunday every time, so it can't hand over to a weekly cadence
--               without a short period nobody asked for. Four-weekly is the
--               standard payroll cadence for this: 13 periods a year, 28 days
--               each, always Monday to Sunday.

BEGIN;

ALTER TABLE tenants
    ADD COLUMN pay_frequency text NOT NULL DEFAULT 'bi_weekly'
    CHECK (pay_frequency IN ('weekly', 'bi_weekly', 'four_weekly'));

-- The old column stays, unread, as a rollback path: if this release has to be
-- reverted, the previous build still finds the column it queries instead of
-- failing every payroll request. Dropped in a follow-up once the release has
-- settled.
ALTER TABLE payroll_user_info
    ALTER COLUMN pay_frequency DROP NOT NULL;

COMMIT;
