-- Activity logs table (your existing schema)
-- You already created this table — no migration needed if it exists.
-- USE dms_db;

CREATE TABLE IF NOT EXISTS activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  log_date DATE NOT NULL,
  log_time TIME NOT NULL,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  company_name VARCHAR(255) NULL,
  facility_id INT NULL,
  performed_by INT NOT NULL,
  performer_name VARCHAR(255) NOT NULL,
  performer_initials VARCHAR(10) NULL,
  details TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_activity_logs_performed_by (performed_by),
  INDEX idx_activity_logs_facility_id (facility_id),
  INDEX idx_activity_logs_log_date (log_date),
  INDEX idx_activity_logs_module (module),
  INDEX idx_activity_logs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
