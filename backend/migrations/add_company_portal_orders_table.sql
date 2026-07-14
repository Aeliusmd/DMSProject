-- External company portal orders (separate from internal orders table)

CREATE TABLE IF NOT EXISTS company_portal_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_user_id BIGINT UNSIGNED NOT NULL,
  order_number VARCHAR(50) NULL,
  status ENUM(
    'Draft',
    'Awaiting Payment',
    'In Process',
    'Invoice',
    'Paid',
    'Released',
    'Cancelled'
  ) NOT NULL DEFAULT 'Draft',

  facility_name VARCHAR(255) NOT NULL DEFAULT '',
  facility_address VARCHAR(500) NOT NULL DEFAULT '',
  treating_doctor VARCHAR(255) NULL,

  applicant_name VARCHAR(255) NULL,
  case_name VARCHAR(255) NULL,
  case_number VARCHAR(100) NULL,
  rec_number VARCHAR(100) NULL,
  ssn VARCHAR(50) NULL,
  date_of_birth DATE NULL,
  date_of_injury DATE NULL,
  date_of_injury_text VARCHAR(100) NULL,
  company_name VARCHAR(255) NULL,
  company_address VARCHAR(500) NULL,
  doctor_address VARCHAR(500) NULL,
  record_type VARCHAR(255) NULL,
  requested_record TEXT NULL,
  subpoena_date DATE NULL,
  date_requested DATE NULL,
  depo_due_date DATE NULL,
  contact_email VARCHAR(255) NULL,
  contact_phone VARCHAR(30) NULL,

  subpoena_file_name VARCHAR(255) NULL,
  subpoena_storage_path VARCHAR(500) NULL,
  subpoena_file_size BIGINT UNSIGNED NULL,
  extraction_raw JSON NULL,

  payment_amount DECIMAL(12,2) NOT NULL DEFAULT 35.00,
  payment_status ENUM('unpaid', 'pending', 'paid', 'failed') NOT NULL DEFAULT 'unpaid',
  stripe_checkout_session_id VARCHAR(255) NULL,
  stripe_payment_intent_id VARCHAR(255) NULL,
  paid_at DATETIME NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_company_portal_orders_number (order_number),
  KEY idx_company_portal_orders_user (company_user_id),
  KEY idx_company_portal_orders_status (status),
  KEY idx_company_portal_orders_session (stripe_checkout_session_id),
  CONSTRAINT fk_company_portal_orders_user
    FOREIGN KEY (company_user_id) REFERENCES company_portal_users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
