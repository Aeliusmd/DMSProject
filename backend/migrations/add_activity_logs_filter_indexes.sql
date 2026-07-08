-- =============================================================================
-- Activity logs list filter / keyset pagination performance indexes
-- Safe to run on existing databases (idempotent via migrate script).
-- =============================================================================
USE dms_db;

-- Module filter + keyset pagination (ORDER BY id DESC)
CREATE INDEX idx_activity_logs_module_id ON activity_logs (module, id);

-- Date-range filters + keyset pagination
CREATE INDEX idx_activity_logs_log_date_id ON activity_logs (log_date, id);

-- Own-logs / performer filter + keyset pagination
CREATE INDEX idx_activity_logs_performed_by_id ON activity_logs (performed_by, id);

-- Prefix search on performer name (LIKE 'term%')
CREATE INDEX idx_activity_logs_performer_name ON activity_logs (performer_name);
