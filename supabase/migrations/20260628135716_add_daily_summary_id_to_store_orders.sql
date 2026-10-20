ALTER TABLE store_orders
  ADD COLUMN daily_summary_id uuid REFERENCES store_daily_summaries(id);

-- Backfill: match UTC created_at to local date (UTC+7)
UPDATE store_orders o
SET daily_summary_id = s.id
FROM store_daily_summaries s
WHERE o.tenant_id = s.tenant_id
  AND o.store_id = s.store_id
  AND (o.created_at + INTERVAL '7 hours')::date = s.date::date
  AND o.daily_summary_id IS NULL;

CREATE INDEX ON store_orders (daily_summary_id);
