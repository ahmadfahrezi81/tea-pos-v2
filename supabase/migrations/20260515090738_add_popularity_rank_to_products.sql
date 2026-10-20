ALTER TABLE products
  ADD COLUMN popularity_rank integer;

-- Backfill initial ranking from existing order data, partitioned per tenant
WITH ranked AS (
  SELECT
    p.id,
    ROW_NUMBER() OVER (
      PARTITION BY p.tenant_id
      ORDER BY COALESCE(SUM(oi.quantity), 0) DESC
    ) AS rank
  FROM products p
  LEFT JOIN order_items oi ON oi.product_id = p.id
  GROUP BY p.id, p.tenant_id
)
UPDATE products
SET popularity_rank = ranked.rank
FROM ranked
WHERE products.id = ranked.id;

-- Index for fast sorting per tenant
CREATE INDEX idx_products_tenant_popularity
  ON products (tenant_id, popularity_rank ASC NULLS LAST);
