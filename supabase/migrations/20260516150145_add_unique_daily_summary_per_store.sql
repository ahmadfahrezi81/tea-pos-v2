CREATE UNIQUE INDEX unique_daily_summary_store_date
  ON daily_summaries (store_id, date, tenant_id);
