-- Company portal employees, wallet, and order attribution.
-- Prerequisites: company_portal_users, company_portal_orders

CREATE TABLE IF NOT EXISTS company_portal_wallets (
  company_user_id BIGINT UNSIGNED NOT NULL,
  unallocated_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (company_user_id),
  CONSTRAINT fk_cpw_company_user
    FOREIGN KEY (company_user_id) REFERENCES company_portal_users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_portal_employees (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_user_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  wallet_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_company_employee_email (company_user_id, email),
  KEY idx_company_employees_company (company_user_id),
  CONSTRAINT fk_cpe_company_user
    FOREIGN KEY (company_user_id) REFERENCES company_portal_users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_portal_employee_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id BIGINT UNSIGNED NOT NULL,
  company_user_id BIGINT UNSIGNED NOT NULL,
  session_token VARCHAR(128) NOT NULL,
  trust_device TINYINT(1) NOT NULL DEFAULT 0,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employee_session_token (session_token),
  KEY idx_employee_sessions_employee (employee_id),
  CONSTRAINT fk_cpes_employee
    FOREIGN KEY (employee_id) REFERENCES company_portal_employees (id),
  CONSTRAINT fk_cpes_company_user
    FOREIGN KEY (company_user_id) REFERENCES company_portal_users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_portal_wallet_topups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_user_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  stripe_checkout_session_id VARCHAR(255) NULL,
  status ENUM('pending', 'paid', 'expired', 'failed') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wallet_topup_session (stripe_checkout_session_id),
  KEY idx_wallet_topups_company (company_user_id),
  CONSTRAINT fk_cpwt_company_user
    FOREIGN KEY (company_user_id) REFERENCES company_portal_users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS company_portal_wallet_transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_user_id BIGINT UNSIGNED NOT NULL,
  employee_id BIGINT UNSIGNED NULL,
  transaction_type ENUM('topup', 'allocation', 'deallocation', 'order_payment') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  company_balance_after DECIMAL(12, 2) NULL,
  employee_balance_after DECIMAL(12, 2) NULL,
  description VARCHAR(500) NULL,
  order_id BIGINT UNSIGNED NULL,
  stripe_checkout_session_id VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_wallet_tx_company (company_user_id),
  KEY idx_wallet_tx_employee (employee_id),
  CONSTRAINT fk_cpwtx_company_user
    FOREIGN KEY (company_user_id) REFERENCES company_portal_users (id),
  CONSTRAINT fk_cpwtx_employee
    FOREIGN KEY (employee_id) REFERENCES company_portal_employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE company_portal_orders
  ADD COLUMN company_portal_employee_id BIGINT UNSIGNED NULL AFTER company_user_id,
  ADD COLUMN placed_by_name VARCHAR(255) NULL AFTER company_portal_employee_id,
  ADD COLUMN payment_method ENUM('stripe', 'wallet') NOT NULL DEFAULT 'stripe' AFTER payment_status;

ALTER TABLE company_portal_orders
  ADD CONSTRAINT fk_cpo_employee
    FOREIGN KEY (company_portal_employee_id) REFERENCES company_portal_employees (id);
