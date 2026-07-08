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
