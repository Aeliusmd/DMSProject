-- Trusted devices for staff login (skip OTP within SESSION_TRUSTED_DAYS).

CREATE TABLE IF NOT EXISTS auth_trusted_devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id BIGINT UNSIGNED NOT NULL,
  device_token_hash CHAR(64) NOT NULL,
  trusted_at DATETIME(3) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_trusted_devices_token (device_token_hash),
  KEY idx_auth_trusted_devices_employee_expires (employee_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
