-- Temporary checkout payloads until Stripe payment succeeds (no draft orders)

CREATE TABLE IF NOT EXISTS company_portal_pending_checkouts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_user_id BIGINT UNSIGNED NOT NULL,
  upload_token VARCHAR(64) NOT NULL,
  stripe_checkout_session_id VARCHAR(255) NULL,
  payload JSON NOT NULL,
  subpoena_file_name VARCHAR(255) NULL,
  subpoena_storage_path VARCHAR(500) NULL,
  subpoena_file_size BIGINT UNSIGNED NULL,
  extraction_raw JSON NULL,
  payment_amount DECIMAL(12,2) NOT NULL DEFAULT 35.00,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_company_portal_pending_token (upload_token),
  KEY idx_company_portal_pending_user (company_user_id),
  KEY idx_company_portal_pending_session (stripe_checkout_session_id),
  CONSTRAINT fk_company_portal_pending_user
    FOREIGN KEY (company_user_id) REFERENCES company_portal_users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
