-- Reverts 20260705161933_add_store_orders_store_date_index.sql — the
-- cursor-pagination work it supported was reverted for being overcomplicated.
DROP INDEX IF EXISTS store_orders_store_id_created_at_idx;
