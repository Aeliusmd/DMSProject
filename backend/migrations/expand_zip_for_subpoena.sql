-- Allow ZIP+4 (e.g. 90809-3010) from subpoena extraction / serve address.
ALTER TABLE orders
  MODIFY COLUMN serve_zip VARCHAR(20) NULL;

ALTER TABLE providers
  MODIFY COLUMN zip_code VARCHAR(20) NULL;
