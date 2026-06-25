-- Clerical time and shipping/handling fee columns on invoices
USE dms_db;

ALTER TABLE invoices
  ADD COLUMN clerical_time_hours DECIMAL(10, 2) NOT NULL DEFAULT 0
    COMMENT 'Clerical time in hours'
    AFTER per_page_amount,
  ADD COLUMN clerical_hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 0
    COMMENT 'Clerical hourly charge rate'
    AFTER clerical_time_hours,
  ADD COLUMN shipping_handling DECIMAL(10, 2) NOT NULL DEFAULT 0
    COMMENT 'Shipping and handling fee'
    AFTER clerical_hourly_rate;
