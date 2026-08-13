-- Expand case_number for long subpoena case captions (already VARCHAR(255) in newer envs).
ALTER TABLE orders
  MODIFY COLUMN case_number VARCHAR(255) NULL;

-- Allow ZIP+4 on auto-created facilities from subpoena addresses.
ALTER TABLE facilities
  MODIFY COLUMN zip_code VARCHAR(20) NULL;
