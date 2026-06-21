-- =============================================================================
-- DMS orders table — consolidated schema update (run once in MySQL Workbench)
-- =============================================================================
-- Combines:
--   • medical_records_storage_path
--   • is_subpoena / is_write_offs flags (DEFAULT 0)
--   • status ENUM cleanup (remove No Subpoena / No Records / Write Offs)
--   • drop duplicates: has_subpoena, is_records (use flag_* columns for records)
--
-- Change database name if needed:
USE dms_db;

-- -----------------------------------------------------------------------------
-- 1) Medical records scan file path
-- Skip this block if column already exists (duplicate column error = OK)
-- -----------------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN medical_records_storage_path VARCHAR(500) NULL
    COMMENT 'Relative path under uploads/medical-records/ for scanned medical records PDF'
    AFTER subpoena_storage_path;

-- -----------------------------------------------------------------------------
-- 2) Flag columns (skip ADD lines that already exist)
-- is_records is NOT added — records use flag_medical_records, flag_billing_records, etc.
-- -----------------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN is_subpoena TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = subpoena on file, 0 = no subpoena'
    AFTER has_subpoena;

ALTER TABLE orders
  ADD COLUMN is_write_offs TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = order has invoice write-off'
    AFTER is_subpoena;

-- If you previously added is_records, fix defaults then drop it (step 6)

-- -----------------------------------------------------------------------------
-- 3) Ensure correct defaults when columns already exist
-- -----------------------------------------------------------------------------
ALTER TABLE orders
  MODIFY COLUMN is_subpoena TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = subpoena on file, 0 = no subpoena';

ALTER TABLE orders
  MODIFY COLUMN is_write_offs TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = order has invoice write-off';

-- -----------------------------------------------------------------------------
-- 4) Backfill flags from existing data
-- -----------------------------------------------------------------------------
UPDATE orders
SET
  is_subpoena = CASE
    WHEN status = 'No Subpoena' THEN 0
    WHEN subpoena_storage_path IS NOT NULL THEN 1
    ELSE 0
  END,
  is_write_offs = CASE
    WHEN status = 'Write Offs' THEN 1
    ELSE COALESCE(is_write_offs, 0)
  END;

-- -----------------------------------------------------------------------------
-- 5) Status = lifecycle values only
-- -----------------------------------------------------------------------------
UPDATE orders
SET status = 'Active'
WHERE status IN ('No Subpoena', 'No Records', 'Write Offs');

ALTER TABLE orders
  MODIFY COLUMN status ENUM(
    'Active',
    'Ready',
    'Ready to Pickup',
    'Completed',
    'Cancelled'
  ) NOT NULL DEFAULT 'Active';

-- -----------------------------------------------------------------------------
-- 6) Drop duplicate columns
-- Ignore "Unknown column" if already removed
-- -----------------------------------------------------------------------------
ALTER TABLE orders DROP COLUMN has_subpoena;
ALTER TABLE orders DROP COLUMN is_records;

-- -----------------------------------------------------------------------------
-- 7) Verify
-- -----------------------------------------------------------------------------
SELECT
  id,
  order_number,
  status,
  is_subpoena,
  is_write_offs,
  flag_medical_records,
  flag_billing_records,
  flag_employment_records,
  flag_xrays,
  flag_other_record,
  subpoena_storage_path,
  medical_records_storage_path
FROM orders
ORDER BY id DESC
LIMIT 20;
