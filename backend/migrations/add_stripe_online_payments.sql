-- Secure public payment links (one per order).
CREATE TABLE IF NOT EXISTS invoice_payment_access_tokens (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token       VARCHAR(64)     NOT NULL,
  order_id    BIGINT UNSIGNED NOT NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME        NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_access_token (token),
  UNIQUE KEY uq_payment_access_order (order_id),
  CONSTRAINT fk_payment_access_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stripe online payment records for the Payments page.
CREATE TABLE IF NOT EXISTS stripe_online_payments (
  id                          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id                    BIGINT UNSIGNED NOT NULL,
  invoice_type                ENUM('regular', 'xray') NOT NULL,
  invoice_number              VARCHAR(50)     NULL,
  amount                      DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  currency                    VARCHAR(10)     NOT NULL DEFAULT 'usd',
  status                      ENUM('pending', 'succeeded', 'failed', 'expired') NOT NULL DEFAULT 'pending',
  stripe_checkout_session_id  VARCHAR(255)    NULL,
  stripe_payment_intent_id    VARCHAR(255)    NULL,
  stripe_charge_id            VARCHAR(255)    NULL,
  stripe_customer_id          VARCHAR(255)    NULL,
  payment_method_type         VARCHAR(50)     NULL,
  card_brand                  VARCHAR(50)     NULL,
  card_last4                  VARCHAR(4)      NULL,
  customer_email              VARCHAR(255)    NULL,
  customer_name               VARCHAR(255)    NULL,
  receipt_url                 VARCHAR(500)    NULL,
  processing_fee              DECIMAL(12,2)   NULL,
  net_amount                  DECIMAL(12,2)   NULL,
  failure_message             TEXT            NULL,
  paid_at                     DATETIME        NULL,
  created_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_stripe_checkout_session (stripe_checkout_session_id),
  KEY idx_stripe_payments_order (order_id),
  KEY idx_stripe_payments_status (status),
  KEY idx_stripe_payments_paid_at (paid_at),
  CONSTRAINT fk_stripe_payments_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
