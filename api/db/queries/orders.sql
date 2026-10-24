-- name: ListDayOrders :many
-- A day's orders over the stores, newest first, a page at a time: after the cursor, limit+1 rows.
-- created_at holds UTC without a zone; the day's bounds come in the same way.
SELECT o.id, o.created_at, o.total_amount, o.payment_method, st.name AS store_name, u.full_name AS seller,
    (SELECT COALESCE(sum(i.quantity), 0) FROM store_order_items i WHERE i.order_id = o.id)::bigint AS cups
FROM store_orders o
JOIN stores st ON st.id = o.store_id
LEFT JOIN users u ON u.id = o.user_id
WHERE o.tenant_id = @tenant_id
    AND o.store_id = ANY(@store_ids::uuid[])
    AND o.created_at >= @day_start AND o.created_at < @day_end
    AND (o.created_at, o.id) < (@cursor_at::timestamp, @cursor_id::uuid)
ORDER BY o.created_at DESC, o.id DESC
LIMIT @row_limit;

-- name: ListOrderItems :many
SELECT i.id, i.order_id, COALESCE(p.name, '')::text AS name, i.quantity, i.unit_price, i.total_price
FROM store_order_items i
LEFT JOIN tenant_products p ON p.id = i.product_id
WHERE i.order_id = ANY(@order_ids::uuid[])
ORDER BY i.created_at, i.id;

-- name: SalesHours :many
-- Cups, orders and sales per hour of a day (in WIB) over the stores.
SELECT extract(hour FROM (o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Jakarta')::int AS hour,
    count(DISTINCT o.id)::bigint AS orders,
    COALESCE(sum(i.quantity), 0)::bigint AS cups
FROM store_orders o
LEFT JOIN store_order_items i ON i.order_id = o.id
WHERE o.tenant_id = @tenant_id
    AND o.store_id = ANY(@store_ids::uuid[])
    AND o.created_at >= @day_start AND o.created_at < @day_end
GROUP BY 1
ORDER BY 1;

-- name: SalesDayTotal :one
SELECT count(*)::bigint AS orders, COALESCE(sum(total_amount), 0)::bigint AS sales
FROM store_orders
WHERE tenant_id = @tenant_id
    AND store_id = ANY(@store_ids::uuid[])
    AND created_at >= @day_start AND created_at < @day_end;
