-- =============================================================================
-- Orders list filter performance indexes
-- Safe to run on existing databases (idempotent via migrate script).
-- =============================================================================
USE dms_db;

-- Date-range filters (period, createdFrom/createdTo) and year fallback on created_at
CREATE INDEX idx_orders_created_at ON orders (created_at);

-- Facility + status filters with keyset pagination (ORDER BY id DESC)
CREATE INDEX idx_orders_facility_status_id ON orders (facility_id, status, id);

-- Status + date-range filters
CREATE INDEX idx_orders_status_created_id ON orders (status, created_at, id);

-- Facility + date-range filters (common dashboard slice)
CREATE INDEX idx_orders_facility_created_id ON orders (facility_id, created_at, id);

-- Company dropdown filter on serve_company_name
CREATE INDEX idx_orders_serve_company ON orders (serve_company_name);

-- Paid/Unpaid due-amount filters (EXISTS by order_id; covering amount_due)
CREATE INDEX idx_invoices_order_amount_due ON invoices (order_id, amount_due);
CREATE INDEX idx_invoice_xray_order_due_parts
  ON invoice_xray_details (order_id, payment, amount_paid, writeoff_amount);
