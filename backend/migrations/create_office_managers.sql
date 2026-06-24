CREATE TABLE IF NOT EXISTS office_managers (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  facility_id     BIGINT UNSIGNED NOT NULL,
  first_name      VARCHAR(100)    NOT NULL,
  middle_name     VARCHAR(100)    NULL,
  last_name       VARCHAR(100)    NOT NULL,
  phone           VARCHAR(20)     NULL,
  email           VARCHAR(255)    NULL,
  is_deleted      TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Soft delete only',
  deleted_at      DATETIME        NULL,
  deleted_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_office_managers_facility (facility_id),
  KEY idx_office_managers_is_deleted (is_deleted),
  CONSTRAINT fk_office_managers_facility
    FOREIGN KEY (facility_id) REFERENCES facilities (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_office_managers_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES matrix_employees (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
