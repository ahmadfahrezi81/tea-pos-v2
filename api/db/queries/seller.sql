-- name: ListSellerProducts :many
-- What a store sells, most popular first.
SELECT p.id, p.name, p.price, COALESCE(p.image_url, '')::text AS image_url, p.category_id
FROM tenant_products p
WHERE p.tenant_id = $1 AND p.is_active
ORDER BY p.popularity_rank ASC NULLS LAST, p.price;

-- name: StoreAssigned :one
SELECT EXISTS (SELECT 1 FROM user_store_assignments sa JOIN stores st ON st.id = sa.store_id WHERE sa.user_id = @user_id AND sa.store_id = @store_id AND st.tenant_id = @tenant_id);

-- name: GetStoreDay :one
SELECT id, closed_at, opening_balance, total_sales, total_orders, total_cups, total_expenses::bigint AS total_expenses, expected_cash
FROM store_daily_summaries
WHERE store_id = @store_id AND tenant_id = @tenant_id AND date = @date;

-- name: GetActiveStoreSession :one
SELECT s.id, s.daily_summary_id, s.user_id, s.claim_code, s.started_at, u.full_name, COALESCE(u.avatar_url, '')::text AS avatar_url
FROM store_sessions s JOIN users u ON u.id = s.user_id
WHERE s.store_id = @store_id AND s.tenant_id = @tenant_id AND s.status = 'active';

-- name: DayOrderTotals :one
-- A day's orders so far, in case any came in before it opened: created_at holds UTC without a zone.
SELECT COALESCE(sum(o.total_amount), 0)::int AS sales, count(*)::int AS orders,
    COALESCE((SELECT sum(i.quantity) FROM store_order_items i JOIN store_orders x ON x.id = i.order_id
        WHERE x.store_id = @store_id AND x.tenant_id = @tenant_id AND x.created_at >= @day_start AND x.created_at < @day_end), 0)::int AS cups
FROM store_orders o
WHERE o.store_id = @store_id AND o.tenant_id = @tenant_id AND o.created_at >= @day_start AND o.created_at < @day_end;

-- name: CreateStoreDay :one
INSERT INTO store_daily_summaries (store_id, tenant_id, opened_by, date, opening_balance, opening_cash_breakdown,
    total_sales, total_orders, total_cups, total_expenses, expected_cash)
VALUES (@store_id, @tenant_id, @opened_by, @date, @opening_balance, @opening_cash_breakdown,
    @total_sales, @total_orders, @total_cups, 0, @expected_cash)
ON CONFLICT (store_id, date) DO NOTHING
RETURNING id;

-- name: CreateStoreSession :one
INSERT INTO store_sessions (tenant_id, store_id, daily_summary_id, user_id, claim_code)
VALUES (@tenant_id, @store_id, @daily_summary_id, @user_id, @claim_code)
ON CONFLICT DO NOTHING
RETURNING id;

-- name: TransferStoreSession :one
-- The function locks the session, so two phones with one code cannot both take the store.
SELECT id, daily_summary_id FROM public.transfer_store_session(@tenant_id::uuid, @store_id::uuid, @user_id::uuid, @claim_code::text, @new_claim_code::text);

-- name: LogStoreActivity :exec
-- The day's audit trail, written in the change's own transaction.
INSERT INTO tenant_activity_logs (tenant_id, user_id, store_id, daily_summary_id, type, ref_id, ref_table, metadata)
VALUES (@tenant_id, @user_id, @store_id, @daily_summary_id, @type, @ref_id, @ref_table, @metadata);

-- name: ActiveProductPrices :many
SELECT id, price FROM tenant_products WHERE tenant_id = @tenant_id AND is_active AND id = ANY(@ids::uuid[]);

-- name: CreateOrder :one
INSERT INTO store_orders (store_id, user_id, total_amount, tenant_id, daily_summary_id)
VALUES (@store_id, @user_id, @total_amount, @tenant_id, @daily_summary_id)
RETURNING id;

-- name: CreateOrderItem :exec
INSERT INTO store_order_items (order_id, product_id, quantity, unit_price, total_price, tenant_id)
VALUES (@order_id, @product_id, @quantity, @unit_price, @total_price, @tenant_id);

-- name: AddOrderToDay :exec
-- In the database, not read and written back, so two phones never lose a sale.
UPDATE store_daily_summaries
SET total_sales = total_sales + @amount, total_orders = total_orders + 1,
    total_cups = total_cups + @cups, expected_cash = expected_cash + @amount
WHERE id = @id AND tenant_id = @tenant_id;
