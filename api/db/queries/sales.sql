-- name: TenantStoreIDs :many
-- Every store of the tenant: what All stores adds up when the app names none.
SELECT id FROM stores WHERE tenant_id = @tenant_id;

-- name: CountTenantStores :one
SELECT count(*)::int FROM stores WHERE tenant_id = @tenant_id AND id = ANY(@ids::uuid[]);

-- name: SalesDays :many
-- One row per day over the stores, from their day summaries (a day's totals are written when
-- it closes, as in the old app).
SELECT s.date,
    sum(s.total_sales)::bigint AS sales,
    sum(s.total_orders)::bigint AS orders,
    sum(s.total_cups)::bigint AS cups,
    count(*)::int AS stores,
    (count(*) FILTER (WHERE s.closed_at IS NULL))::int AS not_closed
FROM store_daily_summaries s
WHERE s.tenant_id = @tenant_id
    AND s.store_id = ANY(@store_ids::uuid[])
    AND s.date BETWEEN @from_date::date AND @to_date::date
GROUP BY s.date
ORDER BY s.date;

-- name: StoresLive :many
-- Every store of the tenant right now: its open session and who is selling, when it last closed,
-- and the range's (day_start to day_end, UTC as the old tables hold it) orders, cups and sales.
SELECT s.id, s.name, s.status,
    ss.started_at AS open_since,
    ss.user_id AS seller_id,
    COALESCE(u.full_name, '')::text AS seller_name,
    COALESCE(u.avatar_url, '')::text AS seller_avatar,
    (SELECT max(d.closed_at) FROM store_daily_summaries d WHERE d.store_id = s.id)::timestamp AS last_closed,
    COALESCE(t.orders, 0)::bigint AS orders,
    COALESCE(t.sales, 0)::bigint AS sales,
    COALESCE(c.cups, 0)::bigint AS cups,
    COALESCE(m.counted, 0)::bigint AS cash_counted,
    COALESCE(m.diff, 0)::bigint AS cash_diff,
    COALESCE(m.days, 0)::int AS closed_days,
    COALESCE(m.expenses, 0)::bigint AS expenses,
    COALESCE(m.opening, 0)::bigint AS opening,
    COALESCE(m.total_days, 0)::int AS summary_days,
    COALESCE(m.not_closed, 0)::int AS not_closed,
    m.closed_at::timestamp AS closed_at
FROM stores s
LEFT JOIN store_sessions ss ON ss.store_id = s.id AND ss.status = 'active'
LEFT JOIN users u ON u.id = ss.user_id
LEFT JOIN LATERAL (
    SELECT count(*) AS orders, sum(o.total_amount) AS sales
    FROM store_orders o
    WHERE o.store_id = s.id AND o.created_at >= @day_start AND o.created_at < @day_end
) t ON true
LEFT JOIN LATERAL (
    SELECT sum(i.quantity) AS cups
    FROM store_orders o
    JOIN store_order_items i ON i.order_id = o.id
    WHERE o.store_id = s.id AND o.created_at >= @day_start AND o.created_at < @day_end
) c ON true
LEFT JOIN LATERAL (
    -- The cash counted at closing (only closed days have it) and every day's expenses.
    SELECT sum(d.actual_cash) FILTER (WHERE d.closed_at IS NOT NULL) AS counted,
        sum(d.actual_cash - d.expected_cash) FILTER (WHERE d.closed_at IS NOT NULL) AS diff,
        count(d.actual_cash) FILTER (WHERE d.closed_at IS NOT NULL) AS days,
        sum(d.total_expenses) AS expenses,
        sum(d.opening_balance) AS opening,
        count(*) AS total_days,
        count(*) FILTER (WHERE d.closed_at IS NULL) AS not_closed,
        max(d.closed_at) AS closed_at
    FROM store_daily_summaries d
    WHERE d.store_id = s.id AND d.date BETWEEN @from_date::date AND @to_date::date
) m ON true
WHERE s.tenant_id = @tenant_id
ORDER BY ss.started_at IS NULL, s.name;

-- name: StoresLiveSellers :many
-- Who sold at each store in the range (day_start to day_end) and their cups, the most first.
SELECT o.store_id, o.user_id,
    COALESCE(u.full_name, '')::text AS name,
    COALESCE(u.avatar_url, '')::text AS avatar_url,
    COALESCE(sum(i.quantity), 0)::bigint AS cups
FROM store_orders o
JOIN stores s ON s.id = o.store_id
LEFT JOIN store_order_items i ON i.order_id = o.id
LEFT JOIN users u ON u.id = o.user_id
WHERE s.tenant_id = @tenant_id AND o.created_at >= @day_start AND o.created_at < @day_end
GROUP BY o.store_id, o.user_id, u.full_name, u.avatar_url
ORDER BY cups DESC, name;
