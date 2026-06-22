-- Use status = 'Deleted' for soft delete (replaces is_deleted flag).
-- Run in MySQL Workbench after add_order_soft_delete_fields.sql if that was applied.

USE dms_db;

ALTER TABLE orders
  MODIFY COLUMN status ENUM(
    'Active',
    'Ready',
    'Ready to Pickup',
    'Completed',
    'Cancelled',
    'Deleted',
    'Write Offs'
  ) NOT NULL DEFAULT 'Active';

-- If is_deleted column exists from earlier migration, migrate then drop it.
UPDATE orders
SET status = 'Deleted'
WHERE is_deleted = 1
  AND status <> 'Deleted';

ALTER TABLE orders DROP INDEX idx_orders_is_deleted;

ALTER TABLE orders DROP COLUMN is_deleted;
