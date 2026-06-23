-- Add REC number column to orders (workers comp record number from subpoena or manual entry)
USE dms_db;

ALTER TABLE orders
  ADD COLUMN rec_number VARCHAR(50) NULL
    COMMENT 'REC number from subpoena or manual entry'
    AFTER order_number;
