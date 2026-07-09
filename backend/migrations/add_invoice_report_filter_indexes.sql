-- =============================================================================
-- Invoice report list filter / keyset pagination performance indexes
-- Safe to run on existing databases (idempotent via migrate script).
-- =============================================================================
USE dms_db;

-- Outstanding / resend standard invoice report sorting and filters
CREATE INDEX idx_invoices_status_sent_date_due_date_id
  ON invoices (status, sent_date, amount_due, invoice_date, id);

CREATE INDEX idx_invoices_invoice_date_facility_id
  ON invoices (invoice_date, facility_id, id);

-- X-Ray invoice report sorting and filters
CREATE INDEX idx_invoice_xray_sent_date_payment_order
  ON invoice_xray_details (sent_date, xray_invoice_date, order_id);

CREATE INDEX idx_facilities_name ON facilities (facility_name);
