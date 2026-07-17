-- Speed up personal portal list/dashboard queries
-- Filter: portal_user_id + processing_fee_paid, ORDER BY created_at DESC, id DESC

ALTER TABLE personal_request_orders
  ADD INDEX idx_pro_user_paid_created (
    portal_user_id,
    processing_fee_paid,
    created_at,
    id
  );
