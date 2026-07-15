-- Allow long subpoena extraction text for requested records.
-- Extraction often returns more than VARCHAR(255).
-- Note: specific_doctor remains VARCHAR because it is indexed.

ALTER TABLE orders
  MODIFY COLUMN specific_record TEXT NULL;
