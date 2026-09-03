-- Soft-delete reason for orders (mirrors cancel_reason for cancelled orders).
-- Safe to run once. Skip if column already exists.

USE dms_db;

ALTER TABLE orders
  ADD COLUMN delete_reason TEXT NULL
    COMMENT 'Reason provided when order was soft-deleted'
    AFTER deleted_by;
