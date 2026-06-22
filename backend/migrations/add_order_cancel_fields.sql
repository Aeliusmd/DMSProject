-- Cancellation audit fields for orders.
-- Run in MySQL Workbench if not already applied.

USE dms_db;

ALTER TABLE orders
  ADD COLUMN cancel_reason TEXT NULL
    COMMENT 'Reason provided when order was cancelled'
    AFTER status;

ALTER TABLE orders
  ADD COLUMN cancelled_at DATETIME NULL
    COMMENT 'When the order was cancelled'
    AFTER cancel_reason;

ALTER TABLE orders
  ADD COLUMN cancelled_by BIGINT UNSIGNED NULL
    COMMENT 'matrix_employees.id who cancelled the order'
    AFTER cancelled_at;

ALTER TABLE orders
  ADD CONSTRAINT fk_orders_cancelled_by
    FOREIGN KEY (cancelled_by) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE;
