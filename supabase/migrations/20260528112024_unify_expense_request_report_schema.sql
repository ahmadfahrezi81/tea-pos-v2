-- ─── incident_reports ────────────────────────────────────────────────────────

-- Drop constraints before altering columns
ALTER TABLE incident_reports DROP CONSTRAINT incident_reports_category_check;
ALTER TABLE incident_reports DROP CONSTRAINT incident_reports_status_check;

-- Drop columns
ALTER TABLE incident_reports DROP COLUMN title;
ALTER TABLE incident_reports DROP COLUMN status;

-- Rename columns
ALTER TABLE incident_reports RENAME COLUMN category TO type;
ALTER TABLE incident_reports RENAME COLUMN description TO notes;

-- ─── supply_requests ─────────────────────────────────────────────────────────

ALTER TABLE supply_requests DROP CONSTRAINT supply_requests_type_check;
ALTER TABLE supply_requests DROP CONSTRAINT supply_requests_status_check;
ALTER TABLE supply_requests DROP COLUMN status;

-- ─── expenses ────────────────────────────────────────────────────────────────

ALTER TABLE expenses RENAME COLUMN expense_type TO type;
ALTER TABLE expenses ADD COLUMN user_id uuid NULL REFERENCES profiles(id);
ALTER TABLE expenses ADD COLUMN photo_url text NULL;
ALTER TABLE expenses ADD COLUMN notes text NULL;
