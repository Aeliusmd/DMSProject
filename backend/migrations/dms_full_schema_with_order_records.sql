-- =============================================================================
-- DMS (Document Management System) — Full MySQL Schema
-- Engine: MySQL 8.0+ | Charset: utf8mb4
--
-- Includes order_records (multi-type scanned records per order).
-- orders table does NOT include: order_type, flag_*, medical_records_storage_path
--
-- For existing DB: use add_order_records_migration.sql instead.
-- For employee milestone rollup on existing DB: add_employee_milestone_events.sql
--   then: node backend/scripts/backfill-employee-milestone-events.js
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS dms_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE dms_db;

-- -----------------------------------------------------------------------------
-- 1. INTERNAL STAFF (Matrix employees — DMS operators)
-- -----------------------------------------------------------------------------
CREATE TABLE matrix_employees (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(150)    NOT NULL,
  logon           VARCHAR(100)    NOT NULL,
  email           VARCHAR(255)    NOT NULL,
  password_hash   VARCHAR(255)    NOT NULL,
  role            ENUM('Manager', 'Employee', 'Admin') NOT NULL DEFAULT 'Employee',
  last_login_at   DATETIME        NULL,
  is_terminated   TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Soft delete — never hard-delete row',
  is_suspended    TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '1 = suspended; cannot log in until reactivated',
  suspended_by    BIGINT UNSIGNED NULL COMMENT 'matrix_employees.id (admin) who suspended the account',
  reactivated_date DATETIME       NULL COMMENT 'Scheduled date/time to auto-reactivate a suspended account',
  deleted_at      DATETIME        NULL COMMENT 'Set when employee is terminated/removed',
  deleted_by      BIGINT UNSIGNED NULL COMMENT 'matrix_employees.id who performed soft delete',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_matrix_employees_logon (logon),
  UNIQUE KEY uq_matrix_employees_email (email),
  KEY idx_matrix_employees_role (role),
  KEY idx_matrix_employees_terminated (is_terminated),
  KEY idx_matrix_employees_suspended (is_suspended),
  KEY idx_matrix_employees_reactivated_date (reactivated_date),
  KEY idx_matrix_employees_deleted_at (deleted_at),
  KEY idx_matrix_employees_deleted_id (deleted_at, id),
  KEY idx_matrix_employees_deleted_name_id (deleted_at, name, id),
  CONSTRAINT fk_matrix_employees_suspended_by
    FOREIGN KEY (suspended_by) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. FACILITIES (Law-firm / customer accounts — also used as billing company)
-- -----------------------------------------------------------------------------
CREATE TABLE facilities (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  facility_name   VARCHAR(200)    NOT NULL COMMENT 'Display name; same entity used for company-wise invoicing',
  name_normalized VARCHAR(200)    NULL COMMENT 'Lowercase alphanumeric name key for deduplication',
  slug            VARCHAR(100)    NULL COMMENT 'URL/login slug e.g. smith, martinez',
  user_name       VARCHAR(100)    NOT NULL COMMENT 'Facility portal login',
  password_hash   VARCHAR(255)    NOT NULL,
  contact_first_name  VARCHAR(100) NULL,
  contact_middle_name VARCHAR(100) NULL,
  contact_last_name   VARCHAR(100) NULL,
  address         VARCHAR(255)    NULL,
  zip_code        CHAR(5)         NULL,
  city            VARCHAR(100)    NULL,
  state           CHAR(2)         NULL,
  phone           VARCHAR(20)     NULL,
  fax             VARCHAR(20)     NULL,
  email           VARCHAR(255)    NOT NULL,
  ip_addresses    TEXT            NULL COMMENT 'Newline-separated IP whitelist',
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  is_auto_created TINYINT(1)      NOT NULL DEFAULT 0 COMMENT '1 when created automatically from subpoena extraction or order form',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_facilities_user_name (user_name),
  UNIQUE KEY uq_facilities_slug (slug),
  KEY idx_facilities_active_id (is_active, id),
  KEY idx_facilities_active_name_id (is_active, facility_name, id),
  KEY idx_facilities_name_normalized (name_normalized),
  KEY idx_facilities_city_state (city, state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE office_managers (
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

CREATE TABLE facility_doctors (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  facility_id     BIGINT UNSIGNED NOT NULL,
  office_name     VARCHAR(200)    NULL,
  first_name      VARCHAR(100)    NULL,
  middle_name     VARCHAR(100)    NULL,
  last_name       VARCHAR(100)    NULL,
  phone           VARCHAR(20)     NULL,
  fax             VARCHAR(20)     NULL,
  email           VARCHAR(255)    NULL,
  is_default      TINYINT(1)      NOT NULL DEFAULT 0,
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_facility_doctors_facility (facility_id),
  KEY idx_facility_doctors_default (facility_id, is_default),
  CONSTRAINT fk_facility_doctors_facility
    FOREIGN KEY (facility_id) REFERENCES facilities (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE facility_notes (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  facility_id     BIGINT UNSIGNED NOT NULL,
  note_date       DATE            NOT NULL,
  created_by      BIGINT UNSIGNED NULL COMMENT 'matrix_employees.id',
  author_name     VARCHAR(150)    NOT NULL COMMENT 'Display name at time of note',
  note            VARCHAR(500)    NOT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_facility_notes_facility (facility_id),
  KEY idx_facility_notes_date (note_date),
  CONSTRAINT fk_facility_notes_facility
    FOREIGN KEY (facility_id) REFERENCES facilities (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_facility_notes_created_by
    FOREIGN KEY (created_by) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE facility_documents (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  facility_id     BIGINT UNSIGNED NOT NULL,
  document_name   VARCHAR(255)    NOT NULL,
  upload_type     ENUM('Standard', 'Legal', 'Medical', 'Financial', 'Other') NOT NULL DEFAULT 'Standard',
  file_type       VARCHAR(50)     NULL COMMENT 'PDF, DOCX, etc.',
  storage_path    VARCHAR(500)    NOT NULL,
  file_size_bytes BIGINT UNSIGNED NULL,
  uploaded_by     BIGINT UNSIGNED NULL,
  uploaded_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_deleted      TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Soft delete only',
  deleted_at      DATETIME        NULL,
  deleted_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_facility_documents_facility (facility_id),
  KEY idx_facility_documents_upload_type (upload_type),
  KEY idx_facility_documents_is_deleted (is_deleted),
  CONSTRAINT fk_facility_documents_facility
    FOREIGN KEY (facility_id) REFERENCES facilities (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_facility_documents_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES matrix_employees (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_facility_documents_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES matrix_employees (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. PROVIDERS (Medical record custodians — serve targets)
-- -----------------------------------------------------------------------------
CREATE TABLE providers (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_name    VARCHAR(255)    NOT NULL,
  address         VARCHAR(255)    NULL,
  zip_code        CHAR(5)         NULL,
  city            VARCHAR(100)    NULL,
  state           CHAR(2)         NULL,
  phone           VARCHAR(20)     NULL,
  fax             VARCHAR(20)     NULL,
  email           VARCHAR(255)    NULL,
  is_active       TINYINT(1)      NOT NULL DEFAULT 1,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_providers_company_name (company_name),
  KEY idx_providers_city_state (city, state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. ORDERS (Core subpoena / case records)
-- Record types + scanned PDFs live in order_records (not on orders row)
-- -----------------------------------------------------------------------------
CREATE TABLE orders (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number    VARCHAR(50)     NOT NULL COMMENT 'e.g. 70656-1',
  rec_number      VARCHAR(50)     NULL,
  facility_id     BIGINT UNSIGNED NOT NULL,
  provider_id     BIGINT UNSIGNED NULL,
  status          ENUM(
    'Active', 'Ready', 'Ready to Pickup', 'Completed', 'Cancelled',
    'Deleted', 'Write Offs'
  ) NOT NULL DEFAULT 'Active',
  status_before_inactive VARCHAR(50) NULL
    COMMENT 'Status before cancel or delete; used when restoring',
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
  subpoena_storage_path VARCHAR(500) NULL COMMENT 'Primary subpoena file path',
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
  date_requested  DATE            NULL,
  ready_date      DATE            NULL COMMENT 'Mail sent or pickup date',
  invoice_date    DATE            NULL,
  xray_invoice_date DATE          NULL,
  specific_record VARCHAR(255)    NULL,
  specific_doctor VARCHAR(200)    NULL,
  specific_doctor_is_default TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 when specific_doctor was set from facility default doctor during auto order creation',
  full_address    TEXT            NULL,
  certificate_no_records TINYINT(1) NOT NULL DEFAULT 0,
  cnr_reason      TEXT            NULL,
  cnr_delivery    ENUM('email', 'fax', 'pickup') NULL,
  cnr_date_sent   DATE            NULL,
  cnr_memo        TINYINT(1)      NOT NULL DEFAULT 0,
  has_note        TINYINT(1)      NOT NULL DEFAULT 0,
  has_subpoena    TINYINT(1)      NOT NULL DEFAULT 0,
  creation_source ENUM('manual', 'auto') NOT NULL DEFAULT 'manual'
    COMMENT 'manual = user-created; auto = batch scan auto-processed',
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

CREATE TABLE order_records (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id        BIGINT UNSIGNED NOT NULL,
  record_type     ENUM('medical', 'billing', 'employment', 'xrays', 'other') NOT NULL,
  storage_path    VARCHAR(500)    NULL COMMENT 'Scanned PDF for this type',
  uploaded_by     BIGINT UNSIGNED NULL,
  uploaded_at     DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_records_order_type (order_id, record_type),
  KEY idx_order_records_order (order_id),
  CONSTRAINT fk_order_records_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_records_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES matrix_employees (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_workflow_stages (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id        BIGINT UNSIGNED NOT NULL,
  stage_name      ENUM('Review Records', 'Serve', 'Custodian', 'SENT') NOT NULL,
  stage_status    ENUM('pending', 'complete', 'failed', 'sent') NOT NULL DEFAULT 'pending',
  completed_at    DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_workflow_stage (order_id, stage_name),
  KEY idx_order_workflow_status (stage_status),
  CONSTRAINT fk_order_workflow_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_payments (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id        BIGINT UNSIGNED NOT NULL,
  payment_type    ENUM('prepayment', 'custodian', 'xray') NOT NULL,
  check_number    VARCHAR(50)     NULL,
  payment_date    DATE            NULL,
  amount          DECIMAL(12,2)   NULL,
  due_amount      DECIMAL(12,2)   NULL COMMENT 'Balance due for this payment type',
  is_paid         TINYINT(1)      NOT NULL DEFAULT 0,
  memo            VARCHAR(255)    NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_payments_type (order_id, payment_type),
  CONSTRAINT fk_order_payments_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_notes (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id        BIGINT UNSIGNED NOT NULL,
  note_date       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by      BIGINT UNSIGNED NULL,
  author_name     VARCHAR(150)    NOT NULL,
  note            VARCHAR(1000)   NOT NULL,
  callback_date   DATE            NULL,
  attachment_path VARCHAR(500)    NULL,
  is_called       TINYINT(1)      NOT NULL DEFAULT 0,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_notes_order (order_id),
  KEY idx_order_notes_callback (callback_date),
  CONSTRAINT fk_order_notes_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_notes_created_by
    FOREIGN KEY (created_by) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_activity_logs (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id        BIGINT UNSIGNED NOT NULL,
  activity_date   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  performed_by    BIGINT UNSIGNED NULL,
  author_name     VARCHAR(150)    NOT NULL,
  callback_date   DATE            NULL,
  note            TEXT            NULL,
  attachment_path VARCHAR(500)    NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_activity_order (order_id),
  KEY idx_order_activity_date (activity_date),
  CONSTRAINT fk_order_activity_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_activity_performed_by
    FOREIGN KEY (performed_by) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_additional_documents (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id          BIGINT UNSIGNED NOT NULL,
  document_name     VARCHAR(255)    NOT NULL COMMENT 'User-entered label from New Order form',
  original_file_name VARCHAR(255)   NOT NULL COMMENT 'Original uploaded filename',
  mime_type         VARCHAR(100)    NULL COMMENT 'e.g. application/pdf, image/jpeg',
  storage_path      VARCHAR(500)    NOT NULL,
  file_size_bytes   BIGINT UNSIGNED NULL,
  page_count        INT UNSIGNED    NULL,
  uploaded_by       BIGINT UNSIGNED NULL COMMENT 'FK → matrix_employees.id',
  uploaded_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_deleted        TINYINT(1)      NOT NULL DEFAULT 0 COMMENT 'Soft delete only',
  deleted_at        DATETIME        NULL,
  deleted_by        BIGINT UNSIGNED NULL,
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_additional_documents_order_id (order_id),
  KEY idx_order_additional_documents_uploaded_by (uploaded_by),
  KEY idx_order_additional_documents_is_deleted (is_deleted),
  CONSTRAINT fk_order_additional_documents_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_order_additional_documents_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES matrix_employees (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_order_additional_documents_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES matrix_employees (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE unprocessed_subpoenas (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference_code  VARCHAR(50)     NOT NULL COMMENT 'Batch parent e.g. BATCH-A7F3C891',
  file_name       VARCHAR(255)    NOT NULL,
  storage_path    VARCHAR(500)    NOT NULL,
  mime_type       VARCHAR(100)    NULL,
  file_size_bytes BIGINT UNSIGNED NULL,
  page_count      INT UNSIGNED    NULL,
  uploaded_by     BIGINT UNSIGNED NULL,
  uploaded_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  order_id        BIGINT UNSIGNED NULL,
  is_processed    TINYINT(1)      NOT NULL DEFAULT 0,
  processed_at    DATETIME        NULL,
  is_deleted      TINYINT(1)      NOT NULL DEFAULT 0,
  deleted_at      DATETIME        NULL,
  deleted_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_unprocessed_subpoenas_ref (reference_code),
  KEY idx_unprocessed_subpoenas_order_id (order_id),
  KEY idx_unprocessed_subpoenas_uploaded_at (uploaded_at),
  KEY idx_unprocessed_subpoenas_is_processed (is_processed),
  KEY idx_unprocessed_subpoenas_is_deleted (is_deleted),
  CONSTRAINT fk_unprocessed_subpoenas_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES matrix_employees (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_unprocessed_subpoenas_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_unprocessed_subpoenas_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES matrix_employees (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE batch_scan_extracts (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_id           BIGINT UNSIGNED NOT NULL,
  reference_code      VARCHAR(50)     NOT NULL,
  subpoena_index      INT UNSIGNED    NOT NULL DEFAULT 1,
  file_name           VARCHAR(255)    NOT NULL,
  storage_path        VARCHAR(500)    NOT NULL,
  mime_type           VARCHAR(100)    NULL DEFAULT 'application/pdf',
  file_size_bytes     BIGINT UNSIGNED NULL,
  page_count          INT UNSIGNED    NULL,
  page_range_start    INT UNSIGNED    NULL,
  page_range_end      INT UNSIGNED    NULL,
  applicant_name      VARCHAR(200)    NULL,
  case_name           VARCHAR(255)    NULL,
  order_number        VARCHAR(50)     NULL,
  ssn                 VARCHAR(20)     NULL,
  date_of_birth       DATE            NULL,
  date_of_injury      DATE            NULL,
  customer            VARCHAR(200)    NULL,
  company_name        VARCHAR(255)    NULL,
  company_address     VARCHAR(500)    NULL,
  specific_doctor     VARCHAR(200)    NULL,
  doctor_address      VARCHAR(500)    NULL,
  record_type         VARCHAR(100)    NULL,
  requested_record    TEXT            NULL,
  subpoena_date       DATE            NULL,
  date_requested      DATE            NULL,
  depo_due_date       DATE            NULL,
  amount              VARCHAR(50)     NULL,
  cheque_date         DATE            NULL,
  cheque_number       VARCHAR(50)     NULL,
  extraction_confidence JSON          NULL,
  raw_extraction      JSON            NULL,
  order_id            BIGINT UNSIGNED NULL,
  is_processed        TINYINT(1)      NOT NULL DEFAULT 0,
  processed_at        DATETIME        NULL,
  is_deleted          TINYINT(1)      NOT NULL DEFAULT 0,
  deleted_at          DATETIME        NULL,
  deleted_by          BIGINT UNSIGNED NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_batch_scan_extracts_ref (reference_code),
  KEY idx_batch_scan_extracts_parent (parent_id),
  KEY idx_batch_scan_extracts_order_id (order_id),
  KEY idx_batch_scan_extracts_is_processed (is_processed),
  KEY idx_batch_scan_extracts_is_deleted (is_deleted),
  CONSTRAINT fk_batch_scan_extracts_parent
    FOREIGN KEY (parent_id) REFERENCES unprocessed_subpoenas (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_batch_scan_extracts_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_batch_scan_extracts_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES matrix_employees (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reminders (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id        BIGINT UNSIGNED NULL,
  case_number     VARCHAR(50)     NOT NULL,
  applicant_name  VARCHAR(200)    NOT NULL,
  note            TEXT            NOT NULL,
  callback_date   DATE            NOT NULL,
  assigned_to     BIGINT UNSIGNED NULL,
  created_by      BIGINT UNSIGNED NULL,
  author_name     VARCHAR(150)    NOT NULL,
  attachment_path VARCHAR(500)    NULL,
  is_completed    TINYINT(1)      NOT NULL DEFAULT 0,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reminders_case_number (case_number),
  KEY idx_reminders_callback_date (callback_date),
  KEY idx_reminders_assigned_to (assigned_to),
  CONSTRAINT fk_reminders_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_reminders_assigned_to
    FOREIGN KEY (assigned_to) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_reminders_created_by
    FOREIGN KEY (created_by) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. INVOICING
-- -----------------------------------------------------------------------------
CREATE TABLE invoices (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_number    VARCHAR(50)     NULL,
  order_id          BIGINT UNSIGNED NOT NULL,
  facility_id       BIGINT UNSIGNED NOT NULL,
  status            ENUM(
    'Pending', 'Created', 'Partial', 'Needs Resend',
    'Unpaid', 'Paid', 'Written Off'
  ) NOT NULL DEFAULT 'Pending',
  invoice_date      DATE            NULL,
  sent_date         DATE            NULL,
  page_count        INT UNSIGNED    NOT NULL DEFAULT 0,
  per_page_amount   DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  clerical_time_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
  clerical_hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  shipping_handling DECIMAL(10,2)   NOT NULL DEFAULT 0,
  storage_fee       DECIMAL(10,2)   NOT NULL DEFAULT 0,
  total_amount      DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  amount_paid       DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  amount_due        DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  writeoff_amount   DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  writeoff_date     DATE            NULL,
  writeoff_by       BIGINT UNSIGNED NULL,
  writeoff_reason   TEXT            NULL,
  notes             TEXT            NULL,
  send_order_details TINYINT(1)     NOT NULL DEFAULT 0,
  is_rush_order     TINYINT(1)      NOT NULL DEFAULT 0,
  recipient_emails  VARCHAR(500)    NULL,
  created_by        BIGINT UNSIGNED NULL,
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoices_order (order_id),
  KEY idx_invoices_facility (facility_id),
  KEY idx_invoices_status (status),
  KEY idx_invoices_invoice_date (invoice_date),
  KEY idx_invoices_writeoff_by (writeoff_by),
  CONSTRAINT fk_invoices_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_invoices_facility
    FOREIGN KEY (facility_id) REFERENCES facilities (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_invoices_created_by
    FOREIGN KEY (created_by) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_invoices_writeoff_by
    FOREIGN KEY (writeoff_by) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_xray_details (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id            BIGINT UNSIGNED NOT NULL,
  xray_invoice_date   DATE            NULL,
  exam_date           DATE            NULL,
  view_count          INT UNSIGNED    NOT NULL DEFAULT 0,
  per_view_amount     DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  payment             DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  check_number        VARCHAR(50)     NULL,
  description         TEXT            NULL,
  sent_date           DATE            NULL,
  recipient_emails    VARCHAR(500)    NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoice_xray_details_order (order_id),
  CONSTRAINT fk_invoice_xray_details_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. AUDIT, NOTIFICATIONS & AUTH
-- -----------------------------------------------------------------------------
CREATE TABLE activity_logs (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  log_date        DATE            NOT NULL,
  log_time        TIME            NOT NULL,
  action          VARCHAR(100)    NOT NULL,
  module          VARCHAR(50)     NOT NULL,
  company_name    VARCHAR(200)    NULL,
  facility_id     BIGINT UNSIGNED NULL,
  performed_by    BIGINT UNSIGNED NULL,
  performer_name  VARCHAR(150)    NOT NULL,
  performer_initials CHAR(5)      NULL,
  details         TEXT            NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activity_logs_date (log_date, log_time),
  KEY idx_activity_logs_module (module),
  KEY idx_activity_logs_facility (facility_id),
  KEY idx_activity_logs_performed_by (performed_by),
  KEY idx_activity_logs_milestone (performed_by, module, action, log_date),
  CONSTRAINT fk_activity_logs_facility
    FOREIGN KEY (facility_id) REFERENCES facilities (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_activity_logs_performed_by
    FOREIGN KEY (performed_by) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id     BIGINT UNSIGNED NOT NULL,
  notification_type ENUM('Order', 'Invoice', 'Reminder', 'Activity') NOT NULL,
  title           VARCHAR(255)    NOT NULL,
  description     TEXT            NULL,
  reference_type  VARCHAR(50)     NULL,
  reference_id    BIGINT UNSIGNED NULL,
  is_read         TINYINT(1)      NOT NULL DEFAULT 0,
  read_at         DATETIME        NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_employee (employee_id),
  KEY idx_notifications_read (employee_id, is_read),
  KEY idx_notifications_type (notification_type),
  CONSTRAINT fk_notifications_employee
    FOREIGN KEY (employee_id) REFERENCES matrix_employees (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE employee_settings (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id     BIGINT UNSIGNED NOT NULL,
  notify_new_orders       TINYINT(1) NOT NULL DEFAULT 1,
  notify_invoice_reminders TINYINT(1) NOT NULL DEFAULT 1,
  notify_employee_activity TINYINT(1) NOT NULL DEFAULT 0,
  notify_case_status      TINYINT(1) NOT NULL DEFAULT 1,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employee_settings_employee (employee_id),
  CONSTRAINT fk_employee_settings_employee
    FOREIGN KEY (employee_id) REFERENCES matrix_employees (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auth_sessions (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id     BIGINT UNSIGNED NOT NULL,
  session_token   VARCHAR(255)    NOT NULL,
  trust_device    TINYINT(1)      NOT NULL DEFAULT 0,
  two_factor_verified TINYINT(1)  NOT NULL DEFAULT 0,
  ip_address      VARCHAR(45)     NULL,
  user_agent      VARCHAR(500)    NULL,
  expires_at      DATETIME        NOT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_sessions_token (session_token),
  KEY idx_auth_sessions_employee (employee_id),
  KEY idx_auth_sessions_expires (expires_at),
  CONSTRAINT fk_auth_sessions_employee
    FOREIGN KEY (employee_id) REFERENCES matrix_employees (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  actor_id BIGINT UNSIGNED NOT NULL,
  actor_name VARCHAR(255) NOT NULL,
  actor_role VARCHAR(50) NULL,
  target_employee_id BIGINT UNSIGNED NULL,
  target_type VARCHAR(50) NULL,
  target_id BIGINT NULL,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  callback VARCHAR(100) NULL,
  description TEXT NOT NULL,
  metadata JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_activity_actor_id (actor_id),
  INDEX idx_activity_target_employee_id (target_employee_id),
  INDEX idx_activity_created_at (created_at),
  INDEX idx_activity_module_action (module, action),
  CONSTRAINT fk_activity_actor
    FOREIGN KEY (actor_id) REFERENCES matrix_employees (id),
  CONSTRAINT fk_activity_target_employee
    FOREIGN KEY (target_employee_id) REFERENCES matrix_employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Employee order milestone rollup (View Milestone — fast reads on large activity_logs).
-- Populated when order actions occur; backfill from logs for existing data.
CREATE TABLE employee_order_milestone_events (
  employee_id   BIGINT UNSIGNED NOT NULL,
  order_id        BIGINT UNSIGNED NOT NULL,
  metric_type     ENUM('created', 'updated', 'completed', 'cancelled', 'deleted') NOT NULL,
  event_date      DATE            NOT NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (employee_id, metric_type, order_id, event_date),
  KEY idx_milestone_events_lookup (employee_id, metric_type, event_date),
  KEY idx_milestone_events_order (order_id),
  CONSTRAINT fk_milestone_events_employee
    FOREIGN KEY (employee_id) REFERENCES matrix_employees (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_milestone_events_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- SOFT DELETE & FK POLICY (application layer)
-- =============================================================================
-- 1. Never hard-delete: matrix_employees, office_managers, facility_documents,
--    order_additional_documents, unprocessed_subpoenas.
-- 2. order_records: one row per (order_id, record_type); storage_path = scanned PDF.
-- 3. orders no longer stores order_type, flag_*, or medical_records_storage_path.
-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
