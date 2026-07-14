-- Link company portal orders to internal orders for staff tooling reuse.
-- Additive only: does not alter existing internal order rows or enums beyond
-- extending creation_source (same pattern as personal_portal).

ALTER TABLE orders
  MODIFY COLUMN creation_source ENUM(
    'manual',
    'auto',
    'personal_portal',
    'company_portal'
  ) NOT NULL DEFAULT 'manual'
  COMMENT 'manual = staff; auto = batch scan; personal_portal = patient portal; company_portal = external company portal';

ALTER TABLE company_portal_orders
  ADD COLUMN internal_order_id BIGINT UNSIGNED NULL AFTER company_user_id,
  ADD UNIQUE KEY uq_company_portal_orders_internal_order (internal_order_id),
  ADD CONSTRAINT fk_company_portal_orders_internal_order
    FOREIGN KEY (internal_order_id) REFERENCES orders (id)
    ON DELETE SET NULL;
