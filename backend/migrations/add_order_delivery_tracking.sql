-- Recently added columns for completed-order Mail / Pickup tracking.
-- Run in MySQL Workbench if not already applied.

USE dms_db;

ALTER TABLE orders
  ADD COLUMN mail_sent_date DATE NULL
    COMMENT 'Date records mail was sent'
    AFTER delivery_date;

ALTER TABLE orders
  ADD COLUMN pickup_person_name VARCHAR(150) NULL
    COMMENT 'Person who picked up records'
    AFTER mail_sent_date;
