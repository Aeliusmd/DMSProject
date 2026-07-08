-- =============================================================================
-- Employees list/search performance indexes
-- Safe to run on existing databases (idempotent via migrate script).
-- =============================================================================
USE dms_db;

-- Keyset pagination over active employees (ORDER BY id DESC with cursor)
CREATE INDEX idx_matrix_employees_deleted_id ON matrix_employees (deleted_at, id);

-- Prefix search + active filter + stable keyset ordering
CREATE INDEX idx_matrix_employees_deleted_name_id ON matrix_employees (deleted_at, name, id);
