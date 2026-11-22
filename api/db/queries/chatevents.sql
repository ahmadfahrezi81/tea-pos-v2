-- name: EnsureChatChannel :one
-- One channel of a tenant (General, VIP, a store's, someone's Notifications), made if missing.
WITH made AS (
    INSERT INTO chat_channels (tenant_id, kind, store_id, user_id)
    SELECT @tenant_id, @kind, sqlc.narg(store_id)::uuid, sqlc.narg(user_id)::uuid
    WHERE NOT EXISTS (
        SELECT 1 FROM chat_channels c
        WHERE c.tenant_id = @tenant_id AND c.kind = @kind
            AND c.store_id IS NOT DISTINCT FROM sqlc.narg(store_id)::uuid
            AND c.user_id IS NOT DISTINCT FROM sqlc.narg(user_id)::uuid
    )
    ON CONFLICT DO NOTHING
    RETURNING id
)
SELECT id FROM made
UNION ALL
SELECT c.id FROM chat_channels c
WHERE c.tenant_id = @tenant_id AND c.kind = @kind
    AND c.store_id IS NOT DISTINCT FROM sqlc.narg(store_id)::uuid
    AND c.user_id IS NOT DISTINCT FROM sqlc.narg(user_id)::uuid
LIMIT 1;

-- name: InsertChatEvent :one
-- The app's own message; with a key, posted once per channel (no row the second time).
INSERT INTO chat_messages (tenant_id, channel_id, author_type, event_type, body, metadata, event_key)
VALUES (@tenant_id, @channel_id, 'system', @event_type, @body, @metadata, sqlc.narg(event_key))
ON CONFLICT (channel_id, event_key) WHERE event_key IS NOT NULL DO NOTHING
RETURNING id, created_at;

-- name: StoreDayTotals :many
-- Every store day from from_date to to_date, its cups and sales from its orders (a day still open
-- has no totals written yet), for the nightly summary.
SELECT d.id, d.tenant_id, d.store_id, d.date,
    COALESCE((SELECT sum(i.quantity) FROM store_orders o JOIN store_order_items i ON i.order_id = o.id
        WHERE o.daily_summary_id = d.id), 0)::bigint AS cups,
    COALESCE((SELECT sum(o.total_amount) FROM store_orders o WHERE o.daily_summary_id = d.id), 0)::bigint AS sales
FROM store_daily_summaries d
WHERE d.date BETWEEN @from_date::date AND @to_date::date
ORDER BY d.store_id, d.date;

-- name: ListPayTenants :many
-- Every tenant and its pay schedule, for the pay total.
SELECT id, pay_frequency FROM tenants;

-- name: ListChatTenants :many
-- Tenants that use chat (General exists): where a release is announced.
SELECT DISTINCT tenant_id FROM chat_channels WHERE kind = 'general';

-- name: PayoutTotal :one
-- What a payout paid: its approved commissions and claims.
SELECT (COALESCE((SELECT sum(pc.total_commission) FROM payroll_commissions pc WHERE pc.payout_id = @payout_id::uuid AND pc.status = 'approved'), 0)
    + COALESCE((SELECT sum(cl.amount) FROM payroll_claims cl WHERE cl.payout_id = @payout_id::uuid AND cl.status = 'approved'), 0))::bigint AS total;

-- name: OpenStoresForRain :many
-- Stores open now (today's day not closed), with their place, for the rain alerts.
SELECT st.id, st.tenant_id, COALESCE(st.latitude, 0)::float8 AS lat, COALESCE(st.longitude, 0)::float8 AS lng,
    (st.latitude IS NOT NULL AND st.longitude IS NOT NULL)::bool AS placed
FROM stores st
JOIN store_daily_summaries d ON d.store_id = st.id AND d.date = @today::date AND d.closed_at IS NULL
WHERE st.status = 'active';

-- name: RainChance :one
-- A cell's highest chance of rain over these hours of a day; -1 when none is known.
SELECT COALESCE(max(precipitation_probability), -1)::float8
FROM weather_hours
WHERE cell = @cell AND date = @date::date AND hour = ANY(@hours::smallint[]);

-- name: LastRainEvent :one
-- The store channel's last rain message today: whether rain was last said to be coming.
SELECT COALESCE((
    SELECT m.event_type FROM chat_messages m
    JOIN chat_channels c ON c.id = m.channel_id
    WHERE c.kind = 'store' AND c.store_id = @store_id
        AND m.event_type IN ('rain_started', 'rain_stopped') AND m.created_at >= @since
    ORDER BY m.created_at DESC LIMIT 1
), '')::text;

-- name: UserName :one
SELECT full_name FROM users WHERE id = @id;

-- name: LinkDays :many
-- Shared days, as their cards show them (Step 75): the store, the date, and the day screen's top
-- numbers, from the orders so far (a day still open has no totals written yet).
SELECT d.id, d.store_id, st.name AS store_name, d.date, (d.closed_at IS NOT NULL)::bool AS closed,
    d.opening_balance::bigint AS opening, COALESCE(d.actual_cash, 0)::bigint AS counted,
    COALESCE((SELECT sum(i.quantity) FROM store_orders o JOIN store_order_items i ON i.order_id = o.id
        WHERE o.daily_summary_id = d.id), 0)::bigint AS cups,
    COALESCE((SELECT count(*) FROM store_orders o WHERE o.daily_summary_id = d.id), 0)::bigint AS orders,
    COALESCE((SELECT sum(o.total_amount) FROM store_orders o WHERE o.daily_summary_id = d.id), 0)::bigint AS sales,
    COALESCE((SELECT sum(e.amount) FROM store_expenses e WHERE e.daily_summary_id = d.id), 0)::bigint AS expenses
FROM store_daily_summaries d
JOIN stores st ON st.id = d.store_id
WHERE d.id = ANY(@ids::uuid[]) AND d.tenant_id = @tenant_id;

-- name: LinkPayouts :many
-- Shared payouts, as their cards show them: the person, the period, what it pays and its state.
SELECT p.id, p.user_id, u.full_name, p.start_date, p.end_date, p.status, p.paid_at,
    COALESCE((SELECT sum(pc.total_commission) FROM payroll_commissions pc WHERE pc.payout_id = p.id AND pc.status = 'approved'), 0)::bigint AS commissions,
    COALESCE((SELECT sum(cl.amount) FROM payroll_claims cl WHERE cl.payout_id = p.id AND cl.status = 'approved'), 0)::bigint AS claims
FROM payroll_payouts p
JOIN users u ON u.id = p.user_id
WHERE p.id = ANY(@ids::uuid[]) AND p.tenant_id = @tenant_id;
