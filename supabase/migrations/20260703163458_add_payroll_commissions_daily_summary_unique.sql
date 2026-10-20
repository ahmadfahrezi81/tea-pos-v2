-- One commission per user per daily summary, ever — matches the
-- one-close-produces-one-row semantics of createPayrollCommissions().
-- Backs a per-user idempotency check (catch 23505, skip) instead of the
-- previous blanket "any row exists -> no-op the whole daily summary" guard,
-- so a retried close-day request can't be permanently blocked by one
-- earlier failed/partial user.
ALTER TABLE payroll_commissions
    ADD CONSTRAINT payroll_commissions_daily_summary_user_key
    UNIQUE (tenant_id, user_id, daily_summary_id);
