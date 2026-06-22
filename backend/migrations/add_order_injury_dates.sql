-- Date of injury fields for orders (specific date or cumulative range).
-- Run once against your database (e.g. dms_db).

USE dms_db;

ALTER TABLE orders
  ADD COLUMN injury_date DATE NULL
    COMMENT 'Specific injury date'
    AFTER injury_type,
  ADD COLUMN injury_date_begin DATE NULL
    COMMENT 'Cumulative injury start date'
    AFTER injury_date,
  ADD COLUMN injury_date_end DATE NULL
    COMMENT 'Cumulative injury end date'
    AFTER injury_date_begin;
