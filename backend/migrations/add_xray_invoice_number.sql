-- Store generated X-Ray invoice numbers (e.g. INV-12345X).
ALTER TABLE invoice_xray_details
  ADD COLUMN invoice_number VARCHAR(50) NULL
  AFTER order_id;
