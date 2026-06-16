-- Run in MySQL Workbench on dms_db
USE dms_db;

ALTER TABLE order_activity_logs
  ADD COLUMN attachment_path VARCHAR(500) NULL
  COMMENT 'Copied from order note attachment when note is saved after call'
  AFTER note;
