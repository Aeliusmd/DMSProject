-- =============================================================================
-- Facilities list/search performance indexes
-- Safe to run on existing databases (idempotent via migrate script).
-- =============================================================================
USE dms_db;

-- Keyset pagination over active facilities (ORDER BY id DESC with cursor)
CREATE INDEX idx_facilities_active_id ON facilities (is_active, id);

-- Prefix search + active filter + stable keyset ordering
CREATE INDEX idx_facilities_active_name_id ON facilities (is_active, facility_name, id);
