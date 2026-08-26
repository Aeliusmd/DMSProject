-- Shared OTP codes for staff / portal / password-reset flows.
-- Stored in MySQL so any app server behind a load balancer can verify the same code.

CREATE TABLE IF NOT EXISTS auth_otp_codes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lookup_key VARCHAR(191) NOT NULL,
  email VARCHAR(255) NOT NULL DEFAULT '',
  otp_hash CHAR(64) NOT NULL,
  start_time DATETIME(3) NOT NULL,
  end_time DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_otp_codes_lookup_key (lookup_key),
  KEY idx_auth_otp_codes_email (email),
  KEY idx_auth_otp_codes_end_time (end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
