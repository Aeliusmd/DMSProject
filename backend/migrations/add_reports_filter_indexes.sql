-- =============================================================================
-- Reports tab filter performance indexes
-- Safe to run on existing databases (idempotent via migrate script).
-- =============================================================================
USE dms_db;

-- Status + subpoena date range filters used by reports
CREATE INDEX idx_orders_status_subpoena_id ON orders (status, subpoena_date, id);

-- Facility-specific report slices by status and created date
CREATE INDEX idx_orders_facility_status_created_id ON orders (facility_id, status, created_at, id);

-- Report search prefixes (case/order/doctor)
CREATE INDEX idx_orders_case_number ON orders (case_number);
CREATE INDEX idx_orders_order_number ON orders (order_number);
CREATE INDEX idx_orders_specific_doctor ON orders (specific_doctor);
