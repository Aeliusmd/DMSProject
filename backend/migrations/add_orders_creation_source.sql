-- Track whether an order was created manually or auto-processed from batch scan.
-- Run in MySQL Workbench if not already applied.

USE dms_db;

ALTER TABLE orders
  ADD COLUMN creation_source ENUM('manual', 'auto') NOT NULL DEFAULT 'manual'
    COMMENT 'manual = user-created order; auto = created from batch scan extraction'
    AFTER has_subpoena;
