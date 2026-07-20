-- Supports company-portal stage filtering from Orders/Reports
-- (EXISTS on company_portal_orders by status + internal_order_id).
-- Unique index on internal_order_id already covers the per-row EXISTS path;
-- this covering index helps status-first lookups/stats.
USE dms_db;

CREATE INDEX idx_company_portal_orders_status_internal
  ON company_portal_orders (status, internal_order_id);
