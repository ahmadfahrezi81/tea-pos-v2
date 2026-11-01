-- name: MyPayInfo :one
SELECT t.pay_frequency, COALESCE(cc.slug, '')::text AS slug, cc.rate_per_cup
FROM tenants t
LEFT JOIN payroll_user_info i ON i.tenant_id = t.id AND i.user_id = @user_id
LEFT JOIN payroll_commission_configs cc ON cc.id = i.commission_config_id
WHERE t.id = @tenant_id;

-- name: MyWorkDays :many
-- The days someone held a store, in the stores' time zone.
SELECT DISTINCT (started_at AT TIME ZONE 'Asia/Jakarta')::date AS day
FROM store_sessions
WHERE user_id = @user_id AND tenant_id = @tenant_id
    AND started_at >= (@from_date::date)::timestamp AT TIME ZONE 'Asia/Jakarta'
    AND started_at < ((@to_date::date) + 1)::timestamp AT TIME ZONE 'Asia/Jakarta'
ORDER BY day;

-- name: ListMyClaims :many
SELECT cl.id, cl.date, cl.amount::bigint AS amount, cl.status, COALESCE(cc.name, '')::text AS type
FROM payroll_claims cl
LEFT JOIN payroll_claim_configs cc ON cc.id = cl.claim_config_id
WHERE cl.tenant_id = @tenant_id AND cl.user_id = @user_id AND cl.date >= @from_date AND cl.date <= @to_date
ORDER BY cl.created_at DESC;

-- name: MyClaimTypes :many
-- What someone may claim, and whether this period, month or day still has room for it.
SELECT c.id, c.name, c.frequency, c.amount, c.claim_source,
    (NOT EXISTS (
        SELECT 1 FROM payroll_claims x
        WHERE x.tenant_id = @tenant_id AND x.user_id = @user_id AND x.claim_config_id = c.id AND x.status <> 'rejected'
          AND CASE c.frequency
                WHEN 'weekly' THEN x.date >= @start_date::date AND x.date <= @end_date::date
                WHEN 'monthly' THEN date_trunc('month', x.date) = date_trunc('month', @today::date)
                WHEN 'daily' THEN x.date = @today::date
                ELSE true END
    ))::bool AS claimable
FROM payroll_user_claim_assignments a
JOIN payroll_claim_configs c ON c.id = a.claim_config_id
WHERE a.tenant_id = @tenant_id AND a.user_id = @user_id AND c.is_enabled AND c.tenant_id = @tenant_id
ORDER BY c.name;

-- name: ClaimableConfig :one
-- A claim type this person may submit by hand.
SELECT c.id, c.frequency, c.amount
FROM payroll_claim_configs c
JOIN payroll_user_claim_assignments a ON a.claim_config_id = c.id AND a.user_id = @user_id AND a.tenant_id = @tenant_id
WHERE c.id = @id AND c.tenant_id = @tenant_id AND c.is_enabled AND c.claim_source = 'manual' AND c.amount > 0;

-- name: ClaimExists :one
SELECT EXISTS (SELECT 1 FROM payroll_claims
    WHERE tenant_id = @tenant_id AND user_id = @user_id AND claim_config_id = @config_id AND status <> 'rejected'
      AND date >= @from_date AND date <= @to_date);

-- name: CreateClaim :one
-- A second one of the same day, week, month or ever is answered by the unique indexes, as no row.
INSERT INTO payroll_claims (tenant_id, user_id, store_id, claim_config_id, frequency, amount, date, notes, photo_url)
VALUES (@tenant_id, @user_id, sqlc.narg(store_id), @config_id, @frequency, @amount, @date, sqlc.narg(notes), sqlc.narg(photo_url))
ON CONFLICT DO NOTHING
RETURNING id;
