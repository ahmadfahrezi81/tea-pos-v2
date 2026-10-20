-- Add rate_per_cup to payroll_commission_types (rate belongs to the type, not the user)
ALTER TABLE payroll_commission_types ADD COLUMN IF NOT EXISTS rate_per_cup integer NOT NULL DEFAULT 0;

-- Remove rate_per_cup from payroll_user_info (now derived from commission_type)
ALTER TABLE payroll_user_info DROP COLUMN IF EXISTS rate_per_cup;

-- Drop duplicate rate_per_unit from payroll_commissions (rate_per_cup is the canonical snapshot)
ALTER TABLE payroll_commissions DROP COLUMN IF EXISTS rate_per_unit;

-- Drop legacy tenant_commission_configs table
DROP TABLE IF EXISTS tenant_commission_configs;
