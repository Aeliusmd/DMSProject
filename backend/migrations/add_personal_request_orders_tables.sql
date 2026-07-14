-- Personal Request Portal: split flat personal_portal_requests into
-- personal_request_orders (header) + facilities + record details.
-- Prerequisites: orders, facilities, and personal_portal_requests (legacy) tables.

-- ---------------------------------------------------------------------------
-- 1) Header: identity, delivery, payment, portal status
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_request_orders (
  id                          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  confirmation_reference      VARCHAR(24)     NULL,
  order_id                    BIGINT UNSIGNED NULL COMMENT 'Linked DMS staff order after payment',
  email                       VARCHAR(255)    NOT NULL,
  driver_license_number       VARCHAR(50)     NOT NULL,
  driver_license_storage_path VARCHAR(500)    NOT NULL,
  first_name                  VARCHAR(100)    NOT NULL,
  last_name                   VARCHAR(100)    NOT NULL,
  dob                         DATE            NOT NULL,
  delivery_preference         ENUM('download', 'mail') NOT NULL DEFAULT 'download',
  mail_address                TEXT            NULL,
  portal_status               ENUM('pending_payment', 'in_process', 'invoice', 'paid', 'released')
                              NOT NULL DEFAULT 'pending_payment',
  processing_fee_paid         TINYINT(1)      NOT NULL DEFAULT 0,
  stripe_checkout_session_id  VARCHAR(255)    NULL,
  lookup_expires_at           DATETIME        NULL,
  released_download_token     VARCHAR(64)     NULL,
  created_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pro_confirmation (confirmation_reference),
  KEY idx_pro_email (email),
  KEY idx_pro_driver_license (driver_license_number),
  KEY idx_pro_order (order_id),
  KEY idx_pro_stripe_session (stripe_checkout_session_id),
  KEY idx_pro_portal_status (portal_status),
  CONSTRAINT fk_pro_order FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 2) Treating facility line(s) for a personal request order
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_request_facilities (
  id                          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  personal_request_order_id   BIGINT UNSIGNED NOT NULL,
  facility_id                 BIGINT UNSIGNED NULL COMMENT 'Matched facilities.id when selected from search',
  facility_name               VARCHAR(255)    NOT NULL,
  facility_address            TEXT            NOT NULL,
  records_date_begin          DATE            NOT NULL,
  records_date_end            DATE            NOT NULL,
  sort_order                  INT             NOT NULL DEFAULT 0,
  created_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_prf_order (personal_request_order_id),
  KEY idx_prf_facility (facility_id),
  CONSTRAINT fk_prf_order FOREIGN KEY (personal_request_order_id)
    REFERENCES personal_request_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_prf_facility FOREIGN KEY (facility_id)
    REFERENCES facilities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 3) Record types requested per facility line
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_request_order_records (
  id                           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  personal_request_order_id    BIGINT UNSIGNED NOT NULL,
  personal_request_facility_id BIGINT UNSIGNED NOT NULL,
  record_type                  ENUM('medical', 'billing', 'xrays') NOT NULL,
  created_at                   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pror_facility_type (personal_request_facility_id, record_type),
  KEY idx_pror_order (personal_request_order_id),
  CONSTRAINT fk_pror_order FOREIGN KEY (personal_request_order_id)
    REFERENCES personal_request_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_pror_facility FOREIGN KEY (personal_request_facility_id)
    REFERENCES personal_request_facilities(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- 4) Backfill from legacy personal_portal_requests
--    Skip this section if personal_portal_requests was never created.
-- ---------------------------------------------------------------------------
INSERT INTO personal_request_orders (
  id, confirmation_reference, order_id, email,
  driver_license_number, driver_license_storage_path,
  first_name, last_name, dob,
  delivery_preference, mail_address,
  portal_status, processing_fee_paid, stripe_checkout_session_id,
  lookup_expires_at, released_download_token,
  created_at, updated_at
)
SELECT
  ppr.id, ppr.confirmation_reference, ppr.order_id, ppr.email,
  ppr.driver_license_number, ppr.driver_license_storage_path,
  ppr.first_name, ppr.last_name, ppr.dob,
  ppr.delivery_preference, ppr.mail_address,
  ppr.portal_status, ppr.processing_fee_paid, ppr.stripe_checkout_session_id,
  ppr.lookup_expires_at, ppr.released_download_token,
  ppr.created_at, ppr.updated_at
FROM personal_portal_requests ppr
WHERE NOT EXISTS (
  SELECT 1 FROM personal_request_orders pro WHERE pro.id = ppr.id
);

INSERT INTO personal_request_facilities (
  personal_request_order_id, facility_id, facility_name, facility_address,
  records_date_begin, records_date_end, sort_order, created_at, updated_at
)
SELECT
  ppr.id, NULL, ppr.treating_facility_name, ppr.treating_facility_address,
  ppr.records_date_begin, ppr.records_date_end, 0, ppr.created_at, ppr.updated_at
FROM personal_portal_requests ppr
WHERE EXISTS (SELECT 1 FROM personal_request_orders pro WHERE pro.id = ppr.id)
  AND NOT EXISTS (
    SELECT 1 FROM personal_request_facilities prf
    WHERE prf.personal_request_order_id = ppr.id
  );

INSERT IGNORE INTO personal_request_order_records (
  personal_request_order_id, personal_request_facility_id, record_type, created_at, updated_at
)
SELECT
  prf.personal_request_order_id,
  prf.id,
  jt.record_type,
  prf.created_at,
  prf.updated_at
FROM personal_request_facilities prf
INNER JOIN personal_portal_requests ppr ON ppr.id = prf.personal_request_order_id
INNER JOIN JSON_TABLE(
  CASE
    WHEN JSON_VALID(CAST(ppr.record_types_json AS CHAR)) THEN CAST(ppr.record_types_json AS JSON)
    ELSE JSON_ARRAY(CAST(ppr.record_types_json AS CHAR))
  END,
  '$[*]' COLUMNS (record_type VARCHAR(32) PATH '$')
) AS jt
WHERE jt.record_type IN ('medical', 'billing', 'xrays');

SET @max_pro_id = (SELECT IFNULL(MAX(id), 0) FROM personal_request_orders);
SET @sql = CONCAT('ALTER TABLE personal_request_orders AUTO_INCREMENT = ', @max_pro_id + 1);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
