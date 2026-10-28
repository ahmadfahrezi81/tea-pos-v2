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
-- and today's (day_start to day_end, UTC as the old tables hold it) orders, cups and sales.
SELECT s.id, s.name, s.status,
    ss.started_at AS open_since,
    COALESCE(u.full_name, '')::text AS seller_name,
    COALESCE(u.avatar_url, '')::text AS seller_avatar,
    (SELECT max(d.closed_at) FROM store_daily_summaries d WHERE d.store_id = s.id)::timestamp AS last_closed,
    COALESCE(t.orders, 0)::bigint AS orders,
    COALESCE(t.sales, 0)::bigint AS sales,
    COALESCE(c.cups, 0)::bigint AS cups
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
WHERE s.tenant_id = @tenant_id
ORDER BY ss.started_at IS NULL, s.name;
