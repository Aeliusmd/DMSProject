-- Normalized facility name for duplicate detection on auto-created facilities.
ALTER TABLE facilities
  ADD COLUMN name_normalized VARCHAR(200) NULL
    COMMENT 'Lowercase alphanumeric name key for deduplication'
    AFTER facility_name;

CREATE INDEX idx_facilities_name_normalized ON facilities (name_normalized);
