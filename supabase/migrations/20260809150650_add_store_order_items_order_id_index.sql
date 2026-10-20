-- store_order_items.order_id carries a foreign key but no index. Postgres does
-- not create one for the referencing side of a constraint, so every join from
-- an order to its items scanned the whole table.
--
-- That is what took /api/analytics/product-sales down with 57014 (canceling
-- statement due to statement timeout): the month's breakdown attaches items to
-- a few thousand orders, and each attachment cost a full scan. The cost grew
-- with every day of the month, which is why the chart worked early on and died
-- around the 9th. Reversing the join direction did not help — both directions
-- go through this column.
--
-- Plain CREATE INDEX, not CONCURRENTLY: the migration runner executes inside a
-- transaction block, which CONCURRENTLY is not allowed to join. This takes a
-- write lock on store_order_items for the duration of the build. The table is
-- small enough that this is seconds, but it does block order writes, so push it
-- outside trading hours.
CREATE INDEX IF NOT EXISTS store_order_items_order_id_idx
    ON store_order_items (order_id);
