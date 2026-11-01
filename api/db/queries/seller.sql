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

-- name: LockStoreDay :one
-- Holds the day while it is closed, so a second close or an expense waits for the answer.
SELECT id, store_id, date, closed_at, opening_balance FROM store_daily_summaries
WHERE id = @id AND store_id = @store_id AND tenant_id = @tenant_id
FOR UPDATE;

-- name: DayHolder :one
-- Who sells on this day right now, if anyone.
SELECT COALESCE((SELECT user_id::text FROM store_sessions
    WHERE daily_summary_id = @day_id AND tenant_id = @tenant_id AND status = 'active' LIMIT 1), '')::text;

-- name: CreateExpense :one
INSERT INTO store_expenses (daily_summary_id, store_id, type, amount, tenant_id, user_id)
VALUES (@daily_summary_id, @store_id, @type, @amount, @tenant_id, @user_id)
RETURNING id;

-- name: AddExpenseToDay :exec
UPDATE store_daily_summaries
SET total_expenses = total_expenses + @amount::int, expected_cash = expected_cash - @amount::int
WHERE id = @id AND tenant_id = @tenant_id;

-- name: DeleteDayPhoto :many
-- A slot holds one photo: taking it again replaces it.
DELETE FROM store_daily_summary_photos
WHERE daily_summary_id = @daily_summary_id AND tenant_id = @tenant_id AND type = @type
RETURNING id, url;

-- name: AddDayPhoto :one
INSERT INTO store_daily_summary_photos (daily_summary_id, store_id, tenant_id, type, url, quantity)
VALUES (@daily_summary_id, @store_id, @tenant_id, @type, @url, @quantity)
RETURNING id;

-- name: DayFinalTotals :one
-- The final totals are counted from the rows, not trusted from the running ones.
SELECT
    (SELECT COALESCE(sum(total_amount), 0)::int FROM store_orders o WHERE o.daily_summary_id = @id AND o.tenant_id = @tenant_id) AS sales,
    (SELECT count(*)::int FROM store_orders o WHERE o.daily_summary_id = @id AND o.tenant_id = @tenant_id) AS orders,
    (SELECT COALESCE(sum(i.quantity), 0)::int FROM store_order_items i JOIN store_orders o ON o.id = i.order_id
        WHERE o.daily_summary_id = @id AND o.tenant_id = @tenant_id) AS cups,
    (SELECT COALESCE(sum(e.amount), 0)::int FROM store_expenses e WHERE e.daily_summary_id = @id AND e.tenant_id = @tenant_id) AS expenses;

-- name: CloseStoreDay :exec
UPDATE store_daily_summaries SET
    total_sales = @sales, total_orders = @orders, total_cups = @cups, total_expenses = @expenses,
    expected_cash = @expected_cash, actual_cash = @actual_cash, variance = @variance,
    closed_at = now() AT TIME ZONE 'UTC', closed_by = @closed_by
WHERE id = @id AND tenant_id = @tenant_id;

-- name: EndDaySessions :exec
UPDATE store_sessions SET ended_at = now(), status = 'ended'
WHERE daily_summary_id = @day_id AND tenant_id = @tenant_id AND status = 'active';

-- name: CreateDayCommissions :many
-- One row per person who held the day, even with no cups, as an empty day is still reviewed. Their
-- cups are their orders inside their own sessions. A rate of nothing is kept pending unless the
-- type is the reserved non-seller one: a person with no type at all is what review must catch.
WITH people AS (
    SELECT DISTINCT user_id FROM store_sessions WHERE daily_summary_id = @day_id AND tenant_id = @tenant_id
), sold AS (
    SELECT s.user_id, count(DISTINCT o.id)::int AS orders, COALESCE(sum(i.quantity), 0)::int AS cups
    FROM store_sessions s
    JOIN store_orders o ON o.user_id = s.user_id AND o.store_id = s.store_id AND o.tenant_id = s.tenant_id
        AND o.created_at >= s.started_at AT TIME ZONE 'UTC'
        AND o.created_at < COALESCE(s.ended_at, now()) AT TIME ZONE 'UTC'
    LEFT JOIN store_order_items i ON i.order_id = o.id
    WHERE s.daily_summary_id = @day_id AND s.tenant_id = @tenant_id
    GROUP BY s.user_id
)
INSERT INTO payroll_commissions (tenant_id, store_id, user_id, daily_summary_id, date, total_cups, total_orders,
    rate_per_cup, commission_config_id, total_commission, status)
SELECT @tenant_id::uuid, @store_id::uuid, p.user_id, @day_id::uuid, @date::date, COALESCE(sold.cups, 0), COALESCE(sold.orders, 0),
    COALESCE(cc.rate_per_cup, 0), info.commission_config_id, COALESCE(sold.cups, 0) * COALESCE(cc.rate_per_cup, 0),
    CASE WHEN cc.slug = @non_seller_slug THEN 'approved' ELSE 'pending' END
FROM people p
LEFT JOIN sold ON sold.user_id = p.user_id
LEFT JOIN payroll_user_info info ON info.user_id = p.user_id AND info.tenant_id = @tenant_id
LEFT JOIN payroll_commission_configs cc ON cc.id = info.commission_config_id
ON CONFLICT DO NOTHING
RETURNING id, user_id, total_cups, total_orders, rate_per_cup, total_commission;

-- name: CreateDayAutoClaims :many
-- The automatic claims of everyone who held the day, by their hours. auto_submit waits for review
-- once the hours are met (no threshold: always); auto decides itself. A claim of nothing is
-- skipped, since the table refuses one and that would undo the close.
WITH hours AS (
    SELECT user_id, sum(GREATEST(0, EXTRACT(EPOCH FROM COALESCE(ended_at, now()) - started_at) / 3600))::numeric AS worked
    FROM store_sessions WHERE daily_summary_id = @day_id AND tenant_id = @tenant_id
    GROUP BY user_id
), due AS (
    SELECT h.user_id, h.worked, c.id AS config_id, c.frequency, c.amount,
        CASE WHEN c.claim_source = 'auto_submit' THEN 'pending'
             WHEN h.worked >= c.auto_threshold_hours THEN 'approved'
             ELSE 'rejected' END AS status
    FROM hours h
    JOIN payroll_user_claim_assignments a ON a.user_id = h.user_id AND a.tenant_id = @tenant_id
    JOIN payroll_claim_configs c ON c.id = a.claim_config_id
    WHERE c.is_enabled AND c.claim_source <> 'manual' AND c.amount > 0
      AND (CASE WHEN c.claim_source = 'auto_submit'
                THEN c.auto_threshold_hours IS NULL OR h.worked >= c.auto_threshold_hours
                ELSE c.auto_threshold_hours IS NOT NULL END)
)
INSERT INTO payroll_claims (tenant_id, user_id, store_id, claim_config_id, frequency, amount, date, status, daily_summary_id, hours_worked)
SELECT @tenant_id::uuid, user_id, @store_id::uuid, config_id, frequency, amount, @date::date, status, @day_id::uuid, worked
FROM due
ON CONFLICT DO NOTHING
RETURNING id, user_id, claim_config_id, amount;

-- name: EnsureDayPayouts :exec
-- Everyone who held the day has a payout for the period; a settled one keeps its window.
INSERT INTO payroll_payouts (tenant_id, user_id, start_date, end_date)
SELECT DISTINCT @tenant_id::uuid, user_id, @start_date::date, @end_date::date
FROM store_sessions WHERE daily_summary_id = @day_id AND tenant_id = @tenant_id
ON CONFLICT (tenant_id, user_id, start_date) DO UPDATE SET end_date = EXCLUDED.end_date
WHERE payroll_payouts.status = 'pending';

-- name: StampDayCommissions :exec
-- Every unassigned row in the period, so one a failed write left behind is picked up too.
UPDATE payroll_commissions pc SET payout_id = p.id
FROM payroll_payouts p
WHERE p.tenant_id = @tenant_id AND p.start_date = @start_date AND p.user_id = pc.user_id
  AND pc.tenant_id = @tenant_id AND pc.date >= @start_date AND pc.date <= @end_date AND pc.payout_id IS NULL
  AND pc.user_id IN (SELECT ss.user_id FROM store_sessions ss WHERE ss.daily_summary_id = @day_id AND ss.tenant_id = @tenant_id);

-- name: StampDayClaims :exec
UPDATE payroll_claims cl SET payout_id = p.id
FROM payroll_payouts p
WHERE p.tenant_id = @tenant_id AND p.start_date = @start_date AND p.user_id = cl.user_id
  AND cl.tenant_id = @tenant_id AND cl.date >= @start_date AND cl.date <= @end_date AND cl.payout_id IS NULL
  AND cl.user_id IN (SELECT ss.user_id FROM store_sessions ss WHERE ss.daily_summary_id = @day_id AND ss.tenant_id = @tenant_id);
