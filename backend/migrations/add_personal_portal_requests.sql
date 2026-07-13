-- Personal Request Portal: external patient record requests
-- Run after orders table exists.

ALTER TABLE orders
  MODIFY COLUMN creation_source ENUM('manual', 'auto', 'personal_portal')
    NOT NULL DEFAULT 'manual'
    COMMENT 'manual = staff; auto = batch scan; personal_portal = patient portal';

CREATE TABLE IF NOT EXISTS personal_portal_requests (
  id                        BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  confirmation_reference      VARCHAR(24)     NULL,
  order_id                  BIGINT UNSIGNED NULL,
  email                     VARCHAR(255)    NOT NULL,
  driver_license_number     VARCHAR(50)     NOT NULL,
  driver_license_storage_path VARCHAR(500)  NOT NULL,
  first_name                VARCHAR(100)    NOT NULL,
  last_name                 VARCHAR(100)    NOT NULL,
  dob                       DATE            NOT NULL,
  treating_facility_name    VARCHAR(255)    NOT NULL,
  treating_facility_address TEXT            NOT NULL,
  records_date_begin        DATE            NOT NULL,
  records_date_end          DATE            NOT NULL,
  record_types_json         JSON            NOT NULL,
  delivery_preference       ENUM('download', 'mail') NOT NULL DEFAULT 'download',
  mail_address              TEXT            NULL,
  portal_status             ENUM('pending_payment', 'in_process', 'invoice', 'paid', 'released')
                            NOT NULL DEFAULT 'pending_payment',
  processing_fee_paid       TINYINT(1)      NOT NULL DEFAULT 0,
  stripe_checkout_session_id VARCHAR(255)   NULL,
  lookup_expires_at         DATETIME        NULL,
  released_download_token   VARCHAR(64)     NULL,
  created_at                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ppr_confirmation (confirmation_reference),
  KEY idx_ppr_email (email),
  KEY idx_ppr_driver_license (driver_license_number),
  KEY idx_ppr_order (order_id),
  KEY idx_ppr_stripe_session (stripe_checkout_session_id),
  CONSTRAINT fk_ppr_order FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
