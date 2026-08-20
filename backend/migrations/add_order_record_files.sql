-- Multiple scanned PDFs per order record type (no merging).
-- order_records stays unique on (order_id, record_type) as the requested type slot.
-- Actual files live in order_record_files.

CREATE TABLE IF NOT EXISTS order_record_files (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id           BIGINT UNSIGNED NOT NULL,
  record_type        ENUM('medical', 'billing', 'employment', 'xrays', 'other') NOT NULL,
  original_file_name VARCHAR(255)    NOT NULL,
  storage_path       VARCHAR(500)    NOT NULL,
  file_size_bytes    BIGINT UNSIGNED NULL,
  uploaded_by        BIGINT UNSIGNED NULL,
  uploaded_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_record_files_order_type (order_id, record_type),
  KEY idx_order_record_files_order (order_id),
  CONSTRAINT fk_order_record_files_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_record_files_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO order_record_files (
  order_id,
  record_type,
  original_file_name,
  storage_path,
  file_size_bytes,
  uploaded_by,
  uploaded_at,
  created_at,
  updated_at
)
SELECT
  r.order_id,
  r.record_type,
  COALESCE(NULLIF(SUBSTRING_INDEX(REPLACE(r.storage_path, '\\\\', '/'), '/', -1), ''), 'records.pdf'),
  r.storage_path,
  NULL,
  r.uploaded_by,
  COALESCE(r.uploaded_at, r.updated_at, NOW()),
  NOW(),
  NOW()
FROM order_records r
WHERE r.storage_path IS NOT NULL
  AND TRIM(r.storage_path) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM order_record_files f
    WHERE f.order_id = r.order_id
      AND f.record_type = r.record_type
      AND f.storage_path = r.storage_path
  );
