-- Add CHECK constraints on status columns
ALTER TABLE payroll_commissions
    ADD CONSTRAINT payroll_commissions_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE payroll_claims
    ADD CONSTRAINT payroll_claims_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE payroll_payouts
    ADD CONSTRAINT payroll_payouts_status_check
    CHECK (status IN ('pending', 'paid'));

-- Add total_orders to track distinct order count per commission window
ALTER TABLE payroll_commissions
    ADD COLUMN total_orders integer NOT NULL DEFAULT 0;

ALTER TABLE payroll_payouts
    ADD COLUMN total_orders integer NOT NULL DEFAULT 0;
