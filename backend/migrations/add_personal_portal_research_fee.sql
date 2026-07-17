-- $5 research / post-verification fee for personal portal orders
-- (requested after DMS verifies order + facility).

ALTER TABLE personal_request_orders
  ADD COLUMN research_fee_status ENUM('none', 'pending', 'paid', 'waived')
    NOT NULL DEFAULT 'none'
    AFTER processing_fee_paid,
  ADD COLUMN research_fee_requested_at DATETIME NULL
    AFTER research_fee_status,
  ADD COLUMN research_fee_paid_at DATETIME NULL
    AFTER research_fee_requested_at,
  ADD COLUMN research_fee_checkout_session_id VARCHAR(255) NULL
    AFTER research_fee_paid_at;

ALTER TABLE personal_request_stripe_payments
  ADD COLUMN payment_kind ENUM('processing_fee', 'research_fee')
    NOT NULL DEFAULT 'processing_fee'
    AFTER personal_request_order_id;
