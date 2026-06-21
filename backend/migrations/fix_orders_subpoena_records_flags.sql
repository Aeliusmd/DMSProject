-- Fix is_subpoena defaults, drop has_subpoena and is_records duplicates.
-- Prefer consolidated_orders_schema.sql for a single Workbench script.

USE dms_db;

ALTER TABLE orders
  MODIFY COLUMN is_subpoena TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = subpoena on file, 0 = no subpoena';

UPDATE orders
SET is_subpoena = CASE
  WHEN subpoena_storage_path IS NOT NULL THEN 1
  ELSE 0
END;

ALTER TABLE orders DROP COLUMN has_subpoena;
ALTER TABLE orders DROP COLUMN is_records;
