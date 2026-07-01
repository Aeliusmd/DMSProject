-- Date requested field for orders.
-- Run in MySQL Workbench if not already applied.

USE dms_db;

ALTER TABLE orders
  ADD COLUMN date_requested DATE NULL
    AFTER subpoena_date;
