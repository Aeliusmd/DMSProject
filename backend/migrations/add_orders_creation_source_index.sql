-- =============================================================================
-- Index for order source filtering (internal / company_portal / personal_portal)
-- Used by Orders and Reports order-source filter + dedicated portal list pages.
-- Safe to run on existing databases.
-- =============================================================================
USE dms_db;

CREATE INDEX idx_orders_creation_source_created_id
  ON orders (creation_source, created_at, id);
