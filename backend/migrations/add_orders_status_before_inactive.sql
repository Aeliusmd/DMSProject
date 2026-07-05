-- Stores the order status before cancel/delete so restore can return to the prior state.
-- Safe to run multiple times (checks information_schema first).

SET @db_name = DATABASE();

SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db_name
    AND TABLE_NAME = 'orders'
    AND COLUMN_NAME = 'status_before_inactive'
);

SET @sql = IF(
  @column_exists = 0,
  'ALTER TABLE orders
     ADD COLUMN status_before_inactive VARCHAR(50) NULL
       COMMENT ''Status before cancel or delete; used when restoring''
       AFTER status',
  'SELECT ''status_before_inactive already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
