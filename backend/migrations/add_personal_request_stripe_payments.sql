-- Personal request Stripe payment records.
-- Prerequisites: personal_request_orders
-- For staff Payments page visibility, also run:
--   add_stripe_online_payments.sql (if not already applied)
--   alter_stripe_online_payments_personal_portal.sql

CREATE TABLE IF NOT EXISTS personal_request_stripe_payments (
  id                           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  personal_request_order_id    BIGINT UNSIGNED NOT NULL,
  order_id                     BIGINT UNSIGNED NULL COMMENT 'DMS staff order after fulfillment',
  amount                       DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  currency                     VARCHAR(10)     NOT NULL DEFAULT 'usd',
  status                       ENUM('pending', 'succeeded', 'failed', 'expired')
                               NOT NULL DEFAULT 'pending',
  stripe_checkout_session_id   VARCHAR(255)    NULL,
  stripe_payment_intent_id     VARCHAR(255)    NULL,
  stripe_charge_id             VARCHAR(255)    NULL,
  stripe_customer_id           VARCHAR(255)    NULL,
  payment_method_type          VARCHAR(50)     NULL,
  card_brand                   VARCHAR(50)     NULL,
  card_last4                   VARCHAR(4)      NULL,
  customer_email               VARCHAR(255)    NULL,
  customer_name                VARCHAR(255)    NULL,
  receipt_url                  VARCHAR(500)    NULL,
  processing_fee               DECIMAL(12,2)   NULL,
  net_amount                   DECIMAL(12,2)   NULL,
  failure_message              TEXT            NULL,
  paid_at                      DATETIME        NULL,
  created_at                   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_prsp_checkout_session (stripe_checkout_session_id),
  KEY idx_prsp_personal_order (personal_request_order_id),
  KEY idx_prsp_order (order_id),
  KEY idx_prsp_status (status),
  KEY idx_prsp_paid_at (paid_at),
  CONSTRAINT fk_prsp_personal_order FOREIGN KEY (personal_request_order_id)
    REFERENCES personal_request_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_prsp_order FOREIGN KEY (order_id)
    REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
