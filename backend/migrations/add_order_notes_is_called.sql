-- Add callback tracking flag for order notes (used by Order.createNote / updateNote).

USE dms_db;

ALTER TABLE order_notes
  ADD COLUMN is_called TINYINT(1) NOT NULL DEFAULT 0;
