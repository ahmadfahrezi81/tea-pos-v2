-- name: GetPayFrequency :one
SELECT pay_frequency FROM tenants WHERE id = @tenant_id;

-- name: SetPayFrequency :exec
UPDATE tenants SET pay_frequency = @pay_frequency, updated_at = now() WHERE id = @tenant_id;

-- name: PayPeriodTotals :one
-- A period's payouts over selling staff, as the old Pay tab sums them: approved commissions and
-- claims, and how many rows are approved or still pending. Non-sellers (SELLER_0 or rate 0)
-- are left out. Payouts overlapping the period count, as the old app's list does.
WITH payouts AS (
    SELECT p.id
    FROM payroll_payouts p
    LEFT JOIN payroll_user_info i ON i.tenant_id = p.tenant_id AND i.user_id = p.user_id
    LEFT JOIN payroll_commission_configs c ON c.id = i.commission_config_id
    WHERE p.tenant_id = @tenant_id AND p.start_date <= @end_date::date AND p.end_date >= @start_date::date
        AND COALESCE(c.slug, '') <> 'SELLER_0' AND COALESCE(c.rate_per_cup, 0) <> 0
),
commissions AS (
    SELECT COALESCE(sum(total_commission) FILTER (WHERE status = 'approved'), 0)::bigint AS approved_total,
        (count(*) FILTER (WHERE status = 'approved'))::int AS approved,
        (count(*) FILTER (WHERE status = 'pending'))::int AS pending
    FROM payroll_commissions WHERE payout_id IN (SELECT id FROM payouts)
),
claims AS (
    SELECT COALESCE(sum(amount) FILTER (WHERE status = 'approved'), 0)::bigint AS approved_total,
        (count(*) FILTER (WHERE status = 'approved'))::int AS approved,
        (count(*) FILTER (WHERE status = 'pending'))::int AS pending
    FROM payroll_claims WHERE payout_id IN (SELECT id FROM payouts)
)
SELECT (SELECT count(*) FROM payouts)::int AS payouts,
    commissions.approved_total AS commissions, claims.approved_total AS claims,
    (commissions.approved + claims.approved)::int AS approved,
    (commissions.pending + claims.pending)::int AS pending
FROM commissions, claims;

-- name: CountPeriodPayouts :one
-- Payouts already counted into a period, all staff: a pay schedule switch is safe only at zero
-- (or on the period's last day).
SELECT count(*)::int FROM payroll_payouts WHERE tenant_id = @tenant_id AND start_date = @start_date::date;

-- name: ListPayStaff :many
-- The tenant's users with their pay info, in one read.
SELECT u.id, u.full_name, u.email, u.avatar_url, u.role, u.status,
    i.commission_config_id, c.name AS commission_name, c.slug AS commission_slug, c.rate_per_cup,
    i.bank_name, i.bank_account_number, i.bank_account_holder
FROM user_tenant_assignments a
JOIN users u ON u.id = a.user_id
LEFT JOIN payroll_user_info i ON i.tenant_id = a.tenant_id AND i.user_id = a.user_id
LEFT JOIN payroll_commission_configs c ON c.id = i.commission_config_id
WHERE a.tenant_id = @tenant_id
ORDER BY u.full_name;

-- name: UserInTenant :one
SELECT EXISTS (SELECT 1 FROM user_tenant_assignments WHERE tenant_id = @tenant_id AND user_id = @user_id);

-- name: SetUserCommissionType :exec
-- Keeps the bank details the staff member set; only the commission type changes.
INSERT INTO payroll_user_info (tenant_id, user_id, commission_config_id, updated_at)
VALUES (@tenant_id, @user_id, @commission_config_id, now())
ON CONFLICT (tenant_id, user_id) DO UPDATE SET commission_config_id = EXCLUDED.commission_config_id, updated_at = now();

-- name: ListCommissionTypes :many
SELECT id, name, slug, is_enabled, rate_per_cup, created_at FROM payroll_commission_configs
WHERE tenant_id = @tenant_id ORDER BY name;

-- name: CreateCommissionType :one
INSERT INTO payroll_commission_configs (tenant_id, name, slug, rate_per_cup)
VALUES (@tenant_id, @name, @slug, @rate_per_cup)
RETURNING id, name, slug, is_enabled, rate_per_cup, created_at;

-- name: UpdateCommissionType :one
UPDATE payroll_commission_configs SET
    name = COALESCE(sqlc.narg(name), name),
    is_enabled = COALESCE(sqlc.narg(is_enabled), is_enabled),
    rate_per_cup = COALESCE(sqlc.narg(rate_per_cup), rate_per_cup),
    updated_at = now()
WHERE id = @id AND tenant_id = @tenant_id
RETURNING id, name, slug, is_enabled, rate_per_cup, created_at;

-- name: CommissionTypeUsable :one
-- An enabled commission type of the tenant: the only kind a staff member can be given.
SELECT EXISTS (SELECT 1 FROM payroll_commission_configs WHERE id = @id AND tenant_id = @tenant_id AND is_enabled);

-- name: ListClaimTypes :many
SELECT id, name, slug, frequency, is_enabled, amount, claim_source, auto_threshold_hours, created_at
FROM payroll_claim_configs WHERE tenant_id = @tenant_id ORDER BY name;

-- name: CreateClaimType :one
INSERT INTO payroll_claim_configs (tenant_id, name, slug, frequency, amount, claim_source, auto_threshold_hours)
VALUES (@tenant_id, @name, @slug, @frequency, @amount, @claim_source, sqlc.narg(auto_threshold_hours)::numeric)
RETURNING id, name, slug, frequency, is_enabled, amount, claim_source, auto_threshold_hours, created_at;

-- name: UpdateClaimType :one
UPDATE payroll_claim_configs SET
    name = COALESCE(sqlc.narg(name), name),
    is_enabled = COALESCE(sqlc.narg(is_enabled), is_enabled),
    updated_at = now()
WHERE id = @id AND tenant_id = @tenant_id
RETURNING id, name, slug, frequency, is_enabled, amount, claim_source, auto_threshold_hours, created_at;

-- name: ClaimTypeInTenant :one
SELECT EXISTS (SELECT 1 FROM payroll_claim_configs WHERE id = @id AND tenant_id = @tenant_id);

-- name: ListClaimEligible :many
SELECT user_id FROM payroll_user_claim_assignments WHERE tenant_id = @tenant_id AND claim_config_id = @claim_config_id;

-- name: RemoveClaimEligible :exec
-- Everyone not in the list loses it (no history kept: eligibility carries none).
DELETE FROM payroll_user_claim_assignments
WHERE tenant_id = @tenant_id AND claim_config_id = @claim_config_id AND NOT (user_id = ANY(@user_ids::uuid[]));

-- name: AddClaimEligible :exec
INSERT INTO payroll_user_claim_assignments (tenant_id, user_id, claim_config_id)
SELECT @tenant_id, u, @claim_config_id FROM unnest(@user_ids::uuid[]) AS u
WHERE NOT EXISTS (
    SELECT 1 FROM payroll_user_claim_assignments e
    WHERE e.tenant_id = @tenant_id AND e.claim_config_id = @claim_config_id AND e.user_id = u
);

-- name: RemoveUserClaims :exec
-- Everything not listed goes; a disabled type is not on the screen, so it stays as it was.
DELETE FROM payroll_user_claim_assignments e
USING payroll_claim_configs c
WHERE c.id = e.claim_config_id AND c.is_enabled
  AND e.tenant_id = @tenant_id AND e.user_id = @user_id AND NOT (e.claim_config_id = ANY(@claim_ids::uuid[]));

-- name: AddUserClaims :exec
INSERT INTO payroll_user_claim_assignments (tenant_id, user_id, claim_config_id)
SELECT @tenant_id, @user_id, c FROM unnest(@claim_ids::uuid[]) AS c
WHERE NOT EXISTS (
    SELECT 1 FROM payroll_user_claim_assignments e
    WHERE e.tenant_id = @tenant_id AND e.user_id = @user_id AND e.claim_config_id = c
);

-- name: CountClaimTypesInTenant :one
SELECT count(*)::int FROM payroll_claim_configs WHERE tenant_id = @tenant_id AND id = ANY(@ids::uuid[]);

-- name: CountUsersInTenant :one
SELECT count(*)::int FROM user_tenant_assignments WHERE tenant_id = @tenant_id AND user_id = ANY(@user_ids::uuid[]);
