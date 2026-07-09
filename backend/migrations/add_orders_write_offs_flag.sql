-- Add is_write_offs / is_subpoena flags to orders if missing.
-- Safe to run on existing databases (idempotent via migrate script).
-- =============================================================================
USE dms_db;

ALTER TABLE orders
  ADD COLUMN is_subpoena TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = subpoena on file, 0 = no subpoena'
    AFTER status;

ALTER TABLE orders
  ADD COLUMN is_write_offs TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = order has invoice write-off'
    AFTER is_subpoena;

UPDATE orders
SET is_write_offs = 1
WHERE status = 'Write Offs';
