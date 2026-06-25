-- mail_sent_date is no longer used; ready_date holds mail/pickup date.
-- Safe to drop if the column exists.

USE dms_db;

UPDATE orders
SET ready_date = mail_sent_date
WHERE ready_date IS NULL
  AND mail_sent_date IS NOT NULL;

-- Uncomment after verifying ready_date migration:
-- ALTER TABLE orders DROP COLUMN mail_sent_date;
