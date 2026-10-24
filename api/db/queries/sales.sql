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
