ALTER TABLE facilities
  ADD COLUMN is_auto_created TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 when created automatically from subpoena extraction or order form'
    AFTER is_active;
