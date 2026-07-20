-- Company portal activity logs (tenant-scoped; separate from internal activity_logs).
-- Prerequisites: company_portal_users, company_portal_employees

CREATE TABLE IF NOT EXISTS company_portal_activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_user_id BIGINT UNSIGNED NOT NULL,
  log_date DATE NOT NULL,
  log_time TIME NOT NULL,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  company_name VARCHAR(200) NULL,
  performed_by_type ENUM('admin', 'employee') NOT NULL,
  performed_by_admin_id BIGINT UNSIGNED NULL,
  performed_by_employee_id BIGINT UNSIGNED NULL,
  performer_name VARCHAR(150) NOT NULL,
  performer_initials CHAR(5) NULL,
  details TEXT NULL,
  portal_order_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cpal_company_id (company_user_id, id),
  KEY idx_cpal_company_date_id (company_user_id, log_date, id),
  KEY idx_cpal_company_module_id (company_user_id, module, id),
  KEY idx_cpal_company_employee_id (company_user_id, performed_by_employee_id, id),
  KEY idx_cpal_performer_name (performer_name),
  CONSTRAINT fk_cpal_company_user
    FOREIGN KEY (company_user_id) REFERENCES company_portal_users (id),
  CONSTRAINT fk_cpal_admin
    FOREIGN KEY (performed_by_admin_id) REFERENCES company_portal_users (id),
  CONSTRAINT fk_cpal_employee
    FOREIGN KEY (performed_by_employee_id) REFERENCES company_portal_employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
