-- Pending new-facility search requests from company portal order creation.
-- Prerequisites: company_portal_users, company_portal_orders, company_portal_employees

CREATE TABLE IF NOT EXISTS company_portal_new_facility (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_user_id BIGINT UNSIGNED NOT NULL,
  company_portal_employee_id BIGINT UNSIGNED NULL,
  portal_order_id BIGINT UNSIGNED NULL,
  internal_facility_id BIGINT UNSIGNED NULL,
  facility_name VARCHAR(255) NULL,
  facility_address VARCHAR(500) NOT NULL,
  facility_city VARCHAR(100) NOT NULL,
  facility_state CHAR(2) NOT NULL,
  facility_zip VARCHAR(20) NOT NULL,
  treating_doctor VARCHAR(255) NULL,
  search_fee_amount DECIMAL(12, 2) NOT NULL DEFAULT 5.00,
  status ENUM('pending', 'linked', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cp_new_facility_company (company_user_id),
  KEY idx_cp_new_facility_order (portal_order_id),
  CONSTRAINT fk_cp_new_facility_company
    FOREIGN KEY (company_user_id) REFERENCES company_portal_users (id),
  CONSTRAINT fk_cp_new_facility_employee
    FOREIGN KEY (company_portal_employee_id) REFERENCES company_portal_employees (id),
  CONSTRAINT fk_cp_new_facility_order
    FOREIGN KEY (portal_order_id) REFERENCES company_portal_orders (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
