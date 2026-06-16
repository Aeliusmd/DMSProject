-- Run in MySQL Workbench on dms_db
USE dms_db;

ALTER TABLE order_notes
  ADD COLUMN is_called TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '0 = pending (new note), 1 = done (saved after call)'
  AFTER attachment_path;
