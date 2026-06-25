-- Add medical records file path to orders (run once against dms_db)
USE dms_db;

ALTER TABLE orders
  ADD COLUMN medical_records_storage_path VARCHAR(500) NULL
    COMMENT 'Relative path under uploads/medical-records/ for scanned medical records PDF'
    AFTER subpoena_storage_path;

-- Optional: index if you query orders missing medical records often
-- CREATE INDEX idx_orders_medical_records_path ON orders (medical_records_storage_path(100));
