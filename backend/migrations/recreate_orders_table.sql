-- =============================================================================
-- DMS orders — DROP existing table and CREATE fresh (DESTRUCTIVE)
-- =============================================================================
-- WARNING: Deletes ALL orders. Backup first. Dev / rebuild only.
--
-- Aligned with current app:
--   • Soft delete: status = 'Deleted' + deleted_at/deleted_by (no is_deleted)
--   • Mail/pickup date: ready_date (no mail_sent_date)
--   • subpoena_ref, ssn_encrypted kept for future use
USE dms_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS orders;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE orders (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number    VARCHAR(50)     NOT NULL COMMENT 'e.g. 70656-1',
  facility_id     BIGINT UNSIGNED NOT NULL,
  provider_id     BIGINT UNSIGNED NULL,
  order_type      ENUM('medical', 'billing', 'employment', 'xrays') NOT NULL,
  status          ENUM(
    'Active', 'Ready', 'Ready to Pickup', 'Completed', 'Cancelled',
    'Deleted', 'Write Offs'
  ) NOT NULL DEFAULT 'Active',
  cancel_reason   TEXT            NULL COMMENT 'Reason provided when order was cancelled',
  cancelled_at    DATETIME        NULL COMMENT 'When the order was cancelled',
  cancelled_by    BIGINT UNSIGNED NULL COMMENT 'matrix_employees.id who cancelled the order',
  court           VARCHAR(50)     NULL DEFAULT 'WCAB',
  case_number     VARCHAR(50)     NULL,
  subpoena_ref    VARCHAR(50)     NULL COMMENT 'Subpoena reference number',
  order_ref       VARCHAR(50)     NULL COMMENT 'e.g. Ord #W-27285-3',
  ssn_encrypted   VARBINARY(512)  NULL COMMENT 'Encrypted SSN',
  ssn_last_four   CHAR(4)         NULL,
  dob             DATE            NULL,
  applicant_first_name  VARCHAR(100) NULL,
  applicant_middle_name VARCHAR(100) NULL,
  applicant_last_name   VARCHAR(100) NULL,
  applicant_aka         VARCHAR(150) NULL,
  defendant       VARCHAR(200)    NULL,
  injury_type     ENUM('specific', 'cumulative') NULL,
  injury_date     DATE            NULL COMMENT 'Specific injury date',
  injury_date_begin DATE          NULL COMMENT 'Cumulative injury start date',
  injury_date_end DATE            NULL COMMENT 'Cumulative injury end date',
  subpoena_storage_path      VARCHAR(500) NULL COMMENT 'Primary subpoena file path',
  medical_records_storage_path VARCHAR(500) NULL COMMENT 'Scanned medical records PDF path',
  serve_company_name VARCHAR(255) NULL,
  serve_address   VARCHAR(255)    NULL,
  serve_zip       CHAR(5)         NULL,
  serve_city      VARCHAR(100)    NULL,
  serve_state     CHAR(2)         NULL,
  serve_phone     VARCHAR(20)     NULL,
  serve_fax       VARCHAR(20)     NULL,
  serve_email     VARCHAR(255)    NULL,
  contact1_name   VARCHAR(150)    NULL,
  contact1_title  VARCHAR(100)    NULL,
  contact1_phone  VARCHAR(20)     NULL,
  contact1_fax    VARCHAR(20)     NULL,
  contact1_email  VARCHAR(255)    NULL,
  contact2_name   VARCHAR(150)    NULL,
  contact2_title  VARCHAR(100)    NULL,
  contact2_phone  VARCHAR(20)     NULL,
  contact2_fax    VARCHAR(20)     NULL,
  contact2_email  VARCHAR(255)    NULL,
  date_served     DATE            NULL,
  depo_due_date   DATE            NULL,
  delivery_date   DATE            NULL,
  pickup_person_name VARCHAR(150) NULL COMMENT 'Person who picked up records',
  subpoena_date   DATE            NULL,
  ready_date      DATE            NULL COMMENT 'Mail sent or pickup date',
  invoice_date    DATE            NULL,
  xray_invoice_date DATE          NULL,
  flag_medical_records    TINYINT(1) NOT NULL DEFAULT 0,
  flag_billing_records    TINYINT(1) NOT NULL DEFAULT 0,
  flag_employment_records TINYINT(1) NOT NULL DEFAULT 0,
  flag_xrays              TINYINT(1) NOT NULL DEFAULT 0,
  flag_other_record       TINYINT(1) NOT NULL DEFAULT 0,
  specific_record TEXT            NULL,
  specific_doctor VARCHAR(200)    NULL,
  full_address    TEXT            NULL,
  certificate_no_records  TINYINT(1) NOT NULL DEFAULT 0,
  cnr_reason      TEXT            NULL,
  cnr_delivery    ENUM('email', 'fax', 'pickup') NULL,
  cnr_date_sent   DATE            NULL,
  cnr_memo        TINYINT(1)      NOT NULL DEFAULT 0,
  has_note        TINYINT(1)      NOT NULL DEFAULT 0,
  is_subpoena     TINYINT(1)      NOT NULL DEFAULT 0,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at      DATETIME        NULL COMMENT 'When order was deleted (status = Deleted)',
  deleted_by      BIGINT UNSIGNED NULL COMMENT 'matrix_employees.id who deleted the order',
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_number (order_number),
  KEY idx_orders_facility (facility_id),
  KEY idx_orders_provider (provider_id),
  KEY idx_orders_status (status),
  KEY idx_orders_case_number (case_number),
  KEY idx_orders_subpoena_date (subpoena_date),
  KEY idx_orders_created_at (created_at),
  KEY idx_orders_facility_status_id (facility_id, status, id),
  KEY idx_orders_status_created_id (status, created_at, id),
  KEY idx_orders_facility_created_id (facility_id, created_at, id),
  KEY idx_orders_serve_company (serve_company_name),
  KEY idx_orders_applicant (applicant_last_name, applicant_first_name),
  CONSTRAINT fk_orders_facility
    FOREIGN KEY (facility_id) REFERENCES facilities (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orders_provider
    FOREIGN KEY (provider_id) REFERENCES providers (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_created_by
    FOREIGN KEY (created_by) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_cancelled_by
    FOREIGN KEY (cancelled_by) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_orders_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
