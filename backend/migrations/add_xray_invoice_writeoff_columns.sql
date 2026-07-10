-- X-Ray invoice write-off support (mirrors invoices table write-off fields).
ALTER TABLE invoice_xray_details
  ADD COLUMN status ENUM(
    'Unpaid', 'Partial', 'Paid', 'Written Off', 'Needs Resend'
  ) NOT NULL DEFAULT 'Unpaid' AFTER payment,
  ADD COLUMN writeoff_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER amount_paid,
  ADD COLUMN writeoff_date DATE NULL AFTER writeoff_amount,
  ADD COLUMN writeoff_by BIGINT UNSIGNED NULL AFTER writeoff_date,
  ADD COLUMN writeoff_reason TEXT NULL AFTER writeoff_by,
  ADD KEY idx_invoice_xray_status (status),
  ADD KEY idx_invoice_xray_writeoff_by (writeoff_by),
  ADD CONSTRAINT fk_invoice_xray_writeoff_by
    FOREIGN KEY (writeoff_by) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill status for existing rows.
UPDATE invoice_xray_details
SET status = 'Paid'
WHERE COALESCE(amount_paid, 0) >= COALESCE(payment, 0)
  AND COALESCE(payment, 0) > 0;

UPDATE invoice_xray_details
SET status = 'Partial'
WHERE status = 'Unpaid'
  AND COALESCE(amount_paid, 0) > 0
  AND COALESCE(amount_paid, 0) < COALESCE(payment, 0);

UPDATE invoice_xray_details
SET status = 'Needs Resend'
WHERE status = 'Unpaid'
  AND sent_date IS NOT NULL
  AND GREATEST(
    0,
    COALESCE(payment, 0) - COALESCE(amount_paid, 0) - COALESCE(writeoff_amount, 0)
  ) > 0;
