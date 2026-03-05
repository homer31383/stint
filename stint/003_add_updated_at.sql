-- Add updated_at column for sync conflict resolution
-- Run in Supabase SQL Editor

ALTER TABLE stint_clients ADD COLUMN IF NOT EXISTS updated_at bigint;
ALTER TABLE stint_projects ADD COLUMN IF NOT EXISTS updated_at bigint;
ALTER TABLE stint_time_entries ADD COLUMN IF NOT EXISTS updated_at bigint;
ALTER TABLE stint_pencils ADD COLUMN IF NOT EXISTS updated_at bigint;
ALTER TABLE stint_invoices ADD COLUMN IF NOT EXISTS updated_at bigint;
ALTER TABLE stint_settings ADD COLUMN IF NOT EXISTS updated_at bigint;

-- Backfill existing rows: use created_at where available
UPDATE stint_clients SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE stint_projects SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE stint_time_entries SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE stint_pencils SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE stint_invoices SET updated_at = created_at WHERE updated_at IS NULL;
UPDATE stint_settings SET updated_at = extract(epoch from now()) * 1000 WHERE updated_at IS NULL;
