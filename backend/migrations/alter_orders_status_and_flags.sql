-- Normalize orders.status and add is_subpoena / is_write_offs flags.
-- Records use flag_medical_records (+ other flag_* columns), not is_records.
-- Prefer consolidated_orders_schema.sql for a single Workbench script.

USE dms_db;

ALTER TABLE orders
  ADD COLUMN is_subpoena TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = subpoena on file, 0 = no subpoena'
    AFTER has_subpoena,
  ADD COLUMN is_write_offs TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = order has invoice write-off'
    AFTER is_subpoena;

UPDATE orders
SET
  is_subpoena = CASE
    WHEN status = 'No Subpoena' THEN 0
    WHEN subpoena_storage_path IS NOT NULL OR has_subpoena = 1 THEN 1
    ELSE 0
  END,
  is_write_offs = CASE
    WHEN status = 'Write Offs' THEN 1
    ELSE 0
  END;

UPDATE orders
SET status = 'Active'
WHERE status IN ('No Subpoena', 'No Records', 'Write Offs');

ALTER TABLE orders
  MODIFY COLUMN status ENUM(
    'Active',
    'Ready',
    'Ready to Pickup',
    'Completed',
    'Cancelled'
  ) NOT NULL DEFAULT 'Active';

ALTER TABLE orders DROP COLUMN has_subpoena;
ALTER TABLE orders DROP COLUMN is_records;
