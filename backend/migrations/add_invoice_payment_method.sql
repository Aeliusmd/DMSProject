-- Track how invoice balances were settled (manual vs online).
ALTER TABLE invoices
  ADD COLUMN payment_method ENUM('manual', 'online') NULL AFTER amount_due,
  ADD COLUMN payment_check_number VARCHAR(50) NULL AFTER payment_method,
  ADD COLUMN payment_date DATE NULL AFTER payment_check_number,
  ADD COLUMN payment_recorded_by BIGINT UNSIGNED NULL AFTER notes,
  ADD COLUMN payment_recorded_at DATETIME NULL AFTER payment_recorded_by;

ALTER TABLE invoice_xray_details
  ADD COLUMN payment_method ENUM('manual', 'online') NULL AFTER payment,
  ADD COLUMN payment_check_number VARCHAR(50) NULL AFTER payment_method,
  ADD COLUMN payment_date DATE NULL AFTER payment_check_number,
  ADD COLUMN notes TEXT NULL AFTER payment_date,
  ADD COLUMN payment_recorded_by BIGINT UNSIGNED NULL AFTER payment_date,
  ADD COLUMN payment_recorded_at DATETIME NULL AFTER payment_recorded_by,
  ADD COLUMN amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER payment_recorded_at;
