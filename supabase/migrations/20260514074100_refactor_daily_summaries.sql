-- Rename seller_id to opened_by (more accurate: who opened the store that day)
ALTER TABLE daily_summaries RENAME COLUMN seller_id TO opened_by;
ALTER TABLE daily_summaries RENAME CONSTRAINT daily_summaries_seller_id_fkey TO daily_summaries_opened_by_fkey;

-- Drop manager_id — store-level tracking moves to sessions
ALTER TABLE daily_summaries DROP COLUMN manager_id;

-- Add closed_by — who closed the daily summary
ALTER TABLE daily_summaries ADD COLUMN closed_by uuid REFERENCES profiles(id);

-- Backfill historical records so UI never has to handle null closed_by
UPDATE daily_summaries SET closed_by = opened_by WHERE closed_by IS NULL;
