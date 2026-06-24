-- Storage fee column on invoices (replaces legacy "other" fee in the UI)
USE dms_db;

ALTER TABLE invoices
  ADD COLUMN storage_fee DECIMAL(10, 2) NOT NULL DEFAULT 0
    COMMENT 'Storage fee'
    AFTER shipping_handling;

-- Migrate legacy other_fee values into storage_fee when storage_fee is unset
UPDATE invoices
SET storage_fee = other_fee
WHERE storage_fee = 0
  AND other_fee > 0;
