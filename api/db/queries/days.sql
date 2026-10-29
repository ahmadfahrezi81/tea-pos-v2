-- name: ListDays :many
-- A month of the stores' days, newest first (one row per store per day).
SELECT s.id, s.store_id, st.name AS store_name, s.date, s.opening_balance, s.total_sales, s.total_orders,
    s.total_cups, s.total_expenses::bigint AS total_expenses, s.expected_cash, s.actual_cash, s.variance,
    s.notes, s.closed_at
FROM store_daily_summaries s
JOIN stores st ON st.id = s.store_id
WHERE s.tenant_id = @tenant_id
    AND s.store_id = ANY(@store_ids::uuid[])
    AND s.date BETWEEN @from_date::date AND @to_date::date
ORDER BY s.date DESC, st.name;

-- name: ListDayExpenses :many
SELECT id, daily_summary_id, type, amount, notes, photo_url
FROM store_expenses
WHERE daily_summary_id = ANY(@summary_ids::uuid[])
ORDER BY created_at;

-- name: ListDaySellers :many
-- Who worked each day (a session or an order) and the cups they sold, most first.
WITH people AS (
    SELECT daily_summary_id, user_id FROM store_sessions WHERE daily_summary_id = ANY(@summary_ids::uuid[])
    UNION
    SELECT daily_summary_id, user_id FROM store_orders WHERE daily_summary_id = ANY(@summary_ids::uuid[])
),
cups AS (
    SELECT o.daily_summary_id, o.user_id, sum(i.quantity)::bigint AS cups
    FROM store_orders o
    JOIN store_order_items i ON i.order_id = o.id
    WHERE o.daily_summary_id = ANY(@summary_ids::uuid[])
    GROUP BY 1, 2
)
SELECT p.daily_summary_id, p.user_id, u.full_name, u.avatar_url, COALESCE(c.cups, 0)::bigint AS cups
FROM people p
JOIN users u ON u.id = p.user_id
LEFT JOIN cups c ON c.daily_summary_id = p.daily_summary_id AND c.user_id = p.user_id
ORDER BY p.daily_summary_id, cups DESC, u.full_name;

-- name: GetDay :one
SELECT s.id, s.store_id, st.name AS store_name, s.date, s.opening_balance, s.total_sales, s.total_orders,
    s.total_cups, s.total_expenses::bigint AS total_expenses, s.expected_cash, s.actual_cash, s.variance,
    s.notes, s.closed_at, s.created_at, opener.full_name AS opened_by, closer.full_name AS closed_by
FROM store_daily_summaries s
JOIN stores st ON st.id = s.store_id
LEFT JOIN users opener ON opener.id = s.opened_by
LEFT JOIN users closer ON closer.id = s.closed_by
WHERE s.id = @id AND s.tenant_id = @tenant_id;

-- name: ListDayPhotos :many
SELECT type, url, quantity FROM store_daily_summary_photos
WHERE daily_summary_id = @summary_id AND expense_id IS NULL
ORDER BY created_at;

-- name: ListDayProducts :many
-- What the day sold, per product, most first.
SELECT COALESCE(p.name, '')::text AS name, sum(i.quantity)::bigint AS quantity, sum(i.total_price)::bigint AS revenue
FROM store_orders o
JOIN store_order_items i ON i.order_id = o.id
LEFT JOIN tenant_products p ON p.id = i.product_id
WHERE o.daily_summary_id = @summary_id
GROUP BY 1
ORDER BY quantity DESC;

-- name: ListDayActivity :many
SELECT a.id, a.type, a.created_at, a.metadata, u.full_name AS user_name
FROM tenant_activity_logs a
LEFT JOIN users u ON u.id = a.user_id
WHERE a.daily_summary_id = @summary_id AND a.tenant_id = @tenant_id
    AND a.type = ANY(@types::text[])
ORDER BY a.created_at;

-- name: ListDaySessions :many
SELECT s.id, s.user_id, u.full_name, u.avatar_url, s.started_at, s.ended_at, s.status, s.previous_session_id
FROM store_sessions s
LEFT JOIN users u ON u.id = s.user_id
WHERE s.daily_summary_id = @summary_id AND s.tenant_id = @tenant_id
ORDER BY s.started_at;

-- name: SalesProducts :many
-- Cups per product over the stores' orders between two instants (UTC, as created_at holds
-- them), most first: by time, as the old app, since some old orders have no day. A product no
-- longer the tenant's is left out.
SELECT p.id, p.name, sum(i.quantity)::bigint AS quantity
FROM store_orders o
JOIN store_order_items i ON i.order_id = o.id
JOIN tenant_products p ON p.id = i.product_id AND p.tenant_id = o.tenant_id
WHERE o.tenant_id = @tenant_id
    AND o.store_id = ANY(@store_ids::uuid[])
    AND o.created_at >= @start_at AND o.created_at < @end_at
GROUP BY p.id, p.name
ORDER BY quantity DESC, p.name;

-- name: TeaWaste :many
-- Litres of tea left at closing per day (the closing tea photo's quantity), over the stores.
SELECT s.date, sum((ph.quantity ->> 'value')::numeric)::float8 AS litres
FROM store_daily_summaries s
JOIN store_daily_summary_photos ph ON ph.daily_summary_id = s.id AND ph.type = 'closing:tea'
WHERE s.tenant_id = @tenant_id
    AND s.store_id = ANY(@store_ids::uuid[])
    AND s.date BETWEEN @from_date::date AND @to_date::date
    AND jsonb_typeof(ph.quantity -> 'value') = 'number'
GROUP BY s.date
ORDER BY s.date;

-- name: DayInTenant :one
SELECT EXISTS (SELECT 1 FROM store_daily_summaries WHERE id = @id AND tenant_id = @tenant_id);
