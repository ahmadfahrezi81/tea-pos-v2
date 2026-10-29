-- name: ListPayouts :many
-- Payouts overlapping the range (a period across two months is in both), each with its person
-- and its totals summed from its approved rows, as the old app's list sums them.
SELECT p.id, p.user_id, p.status, p.start_date, p.end_date, p.paid_at,
    u.full_name, u.avatar_url,
    (COALESCE(c.slug, '') = 'SELLER_0' OR COALESCE(c.rate_per_cup, 0) = 0)::bool AS non_seller,
    COALESCE(cm.total, 0)::bigint AS commissions, COALESCE(cm.cups, 0)::bigint AS cups,
    COALESCE(cm.orders, 0)::bigint AS orders, COALESCE(cm.approved, 0)::int AS commissions_approved,
    COALESCE(cl.total, 0)::bigint AS claims, COALESCE(cl.approved, 0)::int AS claims_approved,
    (COALESCE(cm.pending, 0) + COALESCE(cl.pending, 0))::int AS pending
FROM payroll_payouts p
JOIN users u ON u.id = p.user_id
LEFT JOIN payroll_user_info i ON i.tenant_id = p.tenant_id AND i.user_id = p.user_id
LEFT JOIN payroll_commission_configs c ON c.id = i.commission_config_id
LEFT JOIN LATERAL (
    SELECT sum(total_commission) FILTER (WHERE status = 'approved') AS total,
        sum(total_cups) FILTER (WHERE status = 'approved') AS cups,
        sum(total_orders) FILTER (WHERE status = 'approved') AS orders,
        count(*) FILTER (WHERE status = 'approved') AS approved,
        count(*) FILTER (WHERE status = 'pending') AS pending
    FROM payroll_commissions WHERE payout_id = p.id
) cm ON true
LEFT JOIN LATERAL (
    SELECT sum(amount) FILTER (WHERE status = 'approved') AS total,
        count(*) FILTER (WHERE status = 'approved') AS approved,
        count(*) FILTER (WHERE status = 'pending') AS pending
    FROM payroll_claims WHERE payout_id = p.id
) cl ON true
WHERE p.tenant_id = @tenant_id AND p.start_date <= @to_date::date AND p.end_date >= @from_date::date
ORDER BY p.start_date DESC, u.full_name;

-- name: GetPayout :one
SELECT p.id, p.user_id, p.status, p.start_date, p.end_date, p.paid_at, p.payment_proof_url, p.notes,
    u.full_name, u.avatar_url, payer.full_name AS paid_by
FROM payroll_payouts p
JOIN users u ON u.id = p.user_id
LEFT JOIN users payer ON payer.id = p.paid_by
WHERE p.id = @id AND p.tenant_id = @tenant_id;

-- name: ListPayoutCommissions :many
SELECT pc.id, pc.date, pc.status, pc.total_cups, pc.total_orders, pc.rate_per_cup::bigint AS rate_per_cup,
    pc.total_commission::bigint AS total_commission, st.name AS store_name
FROM payroll_commissions pc
LEFT JOIN stores st ON st.id = pc.store_id
WHERE pc.payout_id = @payout_id AND pc.tenant_id = @tenant_id AND pc.user_id = @user_id
ORDER BY pc.date, st.name;

-- name: ListPayoutClaims :many
SELECT cl.id, cl.date, cl.status, cl.amount::bigint AS amount, cl.notes, cl.photo_url, cl.hours_worked,
    cc.name AS claim_type, cc.auto_threshold_hours AS threshold_hours
FROM payroll_claims cl
LEFT JOIN payroll_claim_configs cc ON cc.id = cl.claim_config_id
WHERE cl.payout_id = @payout_id AND cl.tenant_id = @tenant_id AND cl.user_id = @user_id
ORDER BY cl.date, cl.created_at;

-- name: PayoutStatusOn :one
-- The status of the person's payout covering the day: decisions stop once it is paid or skipped.
SELECT COALESCE((SELECT status FROM payroll_payouts
    WHERE tenant_id = @tenant_id AND user_id = @user_id AND start_date <= @date::date AND end_date >= @date::date
    LIMIT 1), '')::text;

-- name: GetCommissionRef :one
SELECT user_id, date, store_id FROM payroll_commissions WHERE id = @id AND tenant_id = @tenant_id;

-- name: SetCommissionStatus :exec
UPDATE payroll_commissions SET status = @status WHERE id = @id AND tenant_id = @tenant_id;

-- name: GetClaimRef :one
SELECT user_id, date FROM payroll_claims WHERE id = @id AND tenant_id = @tenant_id;

-- name: SetClaimStatus :exec
UPDATE payroll_claims SET status = @status WHERE id = @id AND tenant_id = @tenant_id;

-- name: ReviewDayCommissions :execrows
-- Only what is still pending: a decision already made a second ago is never overturned.
UPDATE payroll_commissions SET status = @status
WHERE tenant_id = @tenant_id AND user_id = @user_id AND date = @date AND status = 'pending';

-- name: ReviewDayClaims :execrows
UPDATE payroll_claims SET status = @status
WHERE tenant_id = @tenant_id AND user_id = @user_id AND date = @date AND status = 'pending';

-- name: LogActivity :exec
-- The old app's audit log, written the same way while both apps run.
INSERT INTO tenant_activity_logs (tenant_id, user_id, store_id, type, ref_id, ref_table, metadata)
VALUES (@tenant_id, @user_id, sqlc.narg(store_id), @type, sqlc.narg(ref_id), sqlc.narg(ref_table), @metadata);

-- name: CountPayoutPending :one
SELECT ((SELECT count(*) FROM payroll_commissions pc WHERE pc.payout_id = @id::uuid AND pc.tenant_id = @tenant_id::uuid AND pc.status = 'pending')
    + (SELECT count(*) FROM payroll_claims cl WHERE cl.payout_id = @id::uuid AND cl.tenant_id = @tenant_id::uuid AND cl.status = 'pending'))::int;

-- name: SettlePayout :execrows
-- Only a payout still pending: settling twice would rewrite who paid it, when, and the proof.
-- paid_at and paid_by are written for a skip too: who closed the period, and when.
UPDATE payroll_payouts SET status = @status, paid_at = now(), paid_by = @paid_by,
    payment_proof_url = COALESCE(sqlc.narg(payment_proof_url), payment_proof_url),
    notes = COALESCE(sqlc.narg(notes), notes)
WHERE id = @id AND tenant_id = @tenant_id AND status = 'pending';
