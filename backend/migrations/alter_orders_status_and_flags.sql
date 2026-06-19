-- Normalize orders.status and add is_subpoena / is_records / is_write_offs flags.
-- Run once against your database (e.g. dms_db).

USE dms_db;

-- 1) Add flag columns (safe if you run only once)
ALTER TABLE orders
  ADD COLUMN is_subpoena TINYINT(1) NOT NULL DEFAULT 1
    COMMENT '1 = subpoena on file, 0 = no subpoena'
    AFTER has_subpoena,
  ADD COLUMN is_records TINYINT(1) NOT NULL DEFAULT 1
    COMMENT '1 = medical records requested, 0 = no records'
    AFTER is_subpoena,
  ADD COLUMN is_write_offs TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = order has invoice write-off'
    AFTER is_records;

-- 2) Backfill flags from legacy status + existing columns
UPDATE orders
SET
  is_subpoena = CASE
    WHEN status = 'No Subpoena' THEN 0
    WHEN subpoena_storage_path IS NOT NULL OR has_subpoena = 1 THEN 1
    ELSE 0
  END,
  is_records = CASE
    WHEN status = 'No Records' THEN 0
    WHEN flag_medical_records = 1 THEN 1
    ELSE 0
  END,
  is_write_offs = CASE
    WHEN status = 'Write Offs' THEN 1
    ELSE 0
  END;

-- 3) Move legacy status values into Active (lifecycle status only)
UPDATE orders
SET status = 'Active'
WHERE status IN ('No Subpoena', 'No Records', 'Write Offs');

-- 4) Restrict status ENUM to lifecycle values only
ALTER TABLE orders
  MODIFY COLUMN status ENUM(
    'Active',
    'Ready',
    'Ready to Pickup',
    'Completed',
    'Cancelled'
  ) NOT NULL DEFAULT 'Active';
