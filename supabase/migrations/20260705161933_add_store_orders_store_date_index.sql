-- listOrders() and getHourlySales() both query store_orders filtered by
-- store_id (+ tenant_id) and ordered/ranged by created_at. Only existing
-- index on this table is on daily_summary_id.
CREATE INDEX ON store_orders (store_id, created_at);
