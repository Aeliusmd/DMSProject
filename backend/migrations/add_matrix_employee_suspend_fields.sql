-- Suspend / scheduled reactivation fields for matrix employees.
-- Run in MySQL Workbench if not already applied.

USE dms_db;

ALTER TABLE matrix_employees
  ADD COLUMN is_suspended TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = account suspended; user cannot log in until reactivated'
    AFTER is_terminated;

ALTER TABLE matrix_employees
  ADD COLUMN suspended_by BIGINT UNSIGNED NULL
    COMMENT 'matrix_employees.id (admin) who suspended the account'
    AFTER is_suspended;

ALTER TABLE matrix_employees
  ADD COLUMN reactivated_date DATETIME NULL
    COMMENT 'Scheduled date/time to automatically reactivate a suspended account'
    AFTER suspended_by;

ALTER TABLE matrix_employees
  ADD KEY idx_matrix_employees_suspended (is_suspended);

ALTER TABLE matrix_employees
  ADD KEY idx_matrix_employees_reactivated_date (reactivated_date);

ALTER TABLE matrix_employees
  ADD CONSTRAINT fk_matrix_employees_suspended_by
    FOREIGN KEY (suspended_by) REFERENCES matrix_employees (id)
    ON DELETE SET NULL ON UPDATE CASCADE;
