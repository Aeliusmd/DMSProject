-- CNR (Certificate of No Records) columns for orders.
-- Your CREATE TABLE already includes these fields — run only if they are missing.

USE dms_db;

-- Uncomment and run one at a time if a column is missing:

-- ALTER TABLE orders
--   ADD COLUMN certificate_no_records TINYINT(1) NOT NULL DEFAULT 0 AFTER full_address;

-- ALTER TABLE orders
--   ADD COLUMN cnr_reason TEXT NULL AFTER certificate_no_records;

-- ALTER TABLE orders
--   ADD COLUMN cnr_delivery ENUM('email', 'fax', 'pickup') NULL AFTER cnr_reason;

-- ALTER TABLE orders
--   ADD COLUMN cnr_date_sent DATE NULL AFTER cnr_delivery;

-- ALTER TABLE orders
--   ADD COLUMN cnr_memo TINYINT(1) NOT NULL DEFAULT 0 AFTER cnr_date_sent;
