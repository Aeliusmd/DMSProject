-- =============================================================================
-- Company invoice list filter / keyset pagination performance indexes
-- Safe to run on existing databases (idempotent via migrate script).
-- =============================================================================
USE dms_db;

-- Provider-scoped invoice lists (standard + resend)
CREATE INDEX idx_invoices_provider_invoice_date_id
  ON invoices (invoice_date, id);

CREATE INDEX idx_orders_provider_id ON orders (provider_id, id);

-- Provider-scoped X-Ray invoice lists
CREATE INDEX idx_invoice_xray_provider_invoice_date_order
  ON invoice_xray_details (xray_invoice_date, order_id);

-- Order number prefix search filter (LIKE 'term%')
CREATE INDEX idx_orders_order_number ON orders (order_number);
