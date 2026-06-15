-- Optional SQL reference for matrix_employees and auth_sessions tables.
-- Prefer running: npm run seed

USE dms_db;

-- Example: create tables if they do not exist yet
-- CREATE TABLE matrix_employees (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   logon VARCHAR(100) NOT NULL UNIQUE,
--   email VARCHAR(255) NOT NULL UNIQUE,
--   password_hash VARCHAR(255) NOT NULL,
--   role VARCHAR(50) NOT NULL,
--   last_login_at DATETIME NULL,
--   is_terminated TINYINT(1) DEFAULT 0,
--   deleted_at DATETIME NULL,
--   deleted_by INT NULL,
--   created_at DATETIME NOT NULL,
--   updated_at DATETIME NOT NULL
-- );

-- CREATE TABLE auth_sessions (
--   id INT AUTO_INCREMENT PRIMARY KEY,
--   employee_id INT NOT NULL,
--   session_token VARCHAR(255) NOT NULL UNIQUE,
--   trust_device TINYINT(1) DEFAULT 0,
--   two_factor_verified TINYINT(1) DEFAULT 0,
--   ip_address VARCHAR(45) NULL,
--   user_agent TEXT NULL,
--   expires_at DATETIME NOT NULL,
--   created_at DATETIME NOT NULL,
--   FOREIGN KEY (employee_id) REFERENCES matrix_employees(id)
-- );
