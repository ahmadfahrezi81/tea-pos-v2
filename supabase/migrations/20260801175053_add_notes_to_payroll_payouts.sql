-- A place to record why a payment looks the way it does.
--
-- The payout row captures the amount, the proof screenshot, who paid and when,
-- but nothing about the circumstances -- a partial transfer, a correction for a
-- previous period, an off-cycle advance, a reference number from the bank. That
-- context currently lives in someone's head or in a chat message, and by the
-- time anyone asks about a payslip months later it is gone.
--
-- Nullable with no default: every existing payout genuinely has no note, and an
-- empty string would be a worse way of saying that.

ALTER TABLE payroll_payouts ADD COLUMN notes text;

COMMENT ON COLUMN payroll_payouts.notes IS
    'Free-text context recorded by the admin when confirming payment.';
