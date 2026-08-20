-- Allow multiple scanned PDFs per order + record type (no merging).
-- order_record_files may already exist with an FK onto the unique pair;
-- drop that FK first so order_records can have many rows per type.

ALTER TABLE order_record_files
  DROP FOREIGN KEY fk_order_record_files_order_type;

ALTER TABLE order_records
  ADD COLUMN original_file_name VARCHAR(255) NULL COMMENT 'Original PDF filename' AFTER storage_path;

ALTER TABLE order_records
  DROP INDEX uq_order_records_order_type;

ALTER TABLE order_records
  ADD INDEX idx_order_records_order_type (order_id, record_type);

UPDATE order_records
SET original_file_name = COALESCE(
  NULLIF(SUBSTRING_INDEX(REPLACE(storage_path, '\\\\', '/'), '/', -1), ''),
  NULL
)
WHERE storage_path IS NOT NULL
  AND TRIM(storage_path) <> ''
  AND (original_file_name IS NULL OR original_file_name = '');
