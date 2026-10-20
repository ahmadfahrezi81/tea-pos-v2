-- Fix auto claims:
--   1. Widen auto_threshold_hours from integer to numeric (supports decimals like 4.5)
--   2. Add 'auto_submit' claim source (system submits as pending, admin still reviews)

-- 1. Widen threshold column — existing integer values promoted to numeric with no loss
alter table payroll_claim_configs
    alter column auto_threshold_hours type numeric;

-- 2. Add auto_submit to the claim_source check
--    auto_threshold_hours null constraint stays untouched — it only applies to 'auto',
--    so auto_submit is automatically exempt.
alter table payroll_claim_configs
    drop constraint payroll_claim_types_claim_source_check,
    add constraint payroll_claim_types_claim_source_check
        check (claim_source in ('manual', 'auto', 'auto_submit'));
