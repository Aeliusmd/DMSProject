-- Store PDF page count per uploaded order record row.
ALTER TABLE order_records
  ADD COLUMN page_count INT UNSIGNED NULL COMMENT 'PDF page count for uploaded file'
  AFTER original_file_name;
