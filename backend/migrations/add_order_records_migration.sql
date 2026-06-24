-- =============================================================================
-- DMS — order_records migration (run on existing dms_db after backup)
-- =============================================================================
-- 1. Creates order_records
-- 2. Backfills from orders.flag_* / order_type / medical_records_storage_path
-- 3. Drops redundant columns from orders
--
-- Run app code that uses order_records before or together with step 3.
-- =============================================================================

USE dms_db;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1) order_records table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_records (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id        BIGINT UNSIGNED NOT NULL,
  record_type     ENUM('medical', 'billing', 'employment', 'xrays', 'other') NOT NULL,
  storage_path    VARCHAR(500)    NULL COMMENT 'Scanned PDF for this type',
  uploaded_by     BIGINT UNSIGNED NULL,
  uploaded_at     DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_records_order_type (order_id, record_type),
  KEY idx_order_records_order (order_id),
  CONSTRAINT fk_order_records_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_records_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES matrix_employees (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2) Backfill requested types from flag_* columns
-- -----------------------------------------------------------------------------
INSERT INTO order_records (order_id, record_type, storage_path, created_at, updated_at)
SELECT o.id, 'medical', NULL, NOW(), NOW()
FROM orders o
WHERE o.flag_medical_records = 1
ON DUPLICATE KEY UPDATE updated_at = NOW();

INSERT INTO order_records (order_id, record_type, storage_path, created_at, updated_at)
SELECT o.id, 'billing', NULL, NOW(), NOW()
FROM orders o
WHERE o.flag_billing_records = 1
ON DUPLICATE KEY UPDATE updated_at = NOW();

INSERT INTO order_records (order_id, record_type, storage_path, created_at, updated_at)
SELECT o.id, 'employment', NULL, NOW(), NOW()
FROM orders o
WHERE o.flag_employment_records = 1
ON DUPLICATE KEY UPDATE updated_at = NOW();

INSERT INTO order_records (order_id, record_type, storage_path, created_at, updated_at)
SELECT o.id, 'xrays', NULL, NOW(), NOW()
FROM orders o
WHERE o.flag_xrays = 1
ON DUPLICATE KEY UPDATE updated_at = NOW();

INSERT INTO order_records (order_id, record_type, storage_path, created_at, updated_at)
SELECT o.id, 'other', NULL, NOW(), NOW()
FROM orders o
WHERE o.flag_other_record = 1
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- Legacy single order_type when no flags set
INSERT INTO order_records (order_id, record_type, storage_path, created_at, updated_at)
SELECT o.id, o.order_type, NULL, NOW(), NOW()
FROM orders o
WHERE o.order_type IN ('medical', 'billing', 'employment', 'xrays')
  AND NOT (
    o.flag_medical_records = 1
    OR o.flag_billing_records = 1
    OR o.flag_employment_records = 1
    OR o.flag_xrays = 1
    OR o.flag_other_record = 1
  )
ON DUPLICATE KEY UPDATE updated_at = NOW();

-- -----------------------------------------------------------------------------
-- 3) Move existing scanned PDF into matching order_records row
-- -----------------------------------------------------------------------------
INSERT INTO order_records (order_id, record_type, storage_path, uploaded_at, created_at, updated_at)
SELECT
  o.id,
  CASE
    WHEN o.order_type IN ('medical', 'billing', 'employment', 'xrays') THEN o.order_type
    WHEN o.flag_billing_records = 1 THEN 'billing'
    WHEN o.flag_employment_records = 1 THEN 'employment'
    WHEN o.flag_xrays = 1 THEN 'xrays'
    WHEN o.flag_other_record = 1 THEN 'other'
    ELSE 'medical'
  END,
  o.medical_records_storage_path,
  o.updated_at,
  NOW(),
  NOW()
FROM orders o
WHERE o.medical_records_storage_path IS NOT NULL
  AND TRIM(o.medical_records_storage_path) <> ''
ON DUPLICATE KEY UPDATE
  storage_path = VALUES(storage_path),
  uploaded_at = COALESCE(order_records.uploaded_at, VALUES(uploaded_at)),
  updated_at = NOW();

-- -----------------------------------------------------------------------------
-- 4) Drop redundant orders columns (skip any line if column already removed)
-- -----------------------------------------------------------------------------
ALTER TABLE orders
  DROP COLUMN medical_records_storage_path,
  DROP COLUMN flag_medical_records,
  DROP COLUMN flag_billing_records,
  DROP COLUMN flag_employment_records,
  DROP COLUMN flag_xrays,
  DROP COLUMN flag_other_record,
  DROP COLUMN order_type;

SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 5) Verify
-- -----------------------------------------------------------------------------
SELECT
  o.id,
  o.order_number,
  r.record_type,
  r.storage_path,
  r.uploaded_at
FROM orders o
LEFT JOIN order_records r ON r.order_id = o.id
ORDER BY o.id DESC, r.record_type
LIMIT 50;
