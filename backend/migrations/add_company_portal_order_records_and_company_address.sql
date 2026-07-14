-- Company portal: split company address + record type flags

ALTER TABLE company_portal_orders
  ADD COLUMN company_city VARCHAR(100) NULL AFTER company_address,
  ADD COLUMN company_state VARCHAR(2) NULL AFTER company_city,
  ADD COLUMN company_zip VARCHAR(20) NULL AFTER company_state,
  ADD COLUMN medical_records TINYINT(1) NOT NULL DEFAULT 0 AFTER requested_record,
  ADD COLUMN billing_records TINYINT(1) NOT NULL DEFAULT 0 AFTER medical_records,
  ADD COLUMN employment_records TINYINT(1) NOT NULL DEFAULT 0 AFTER billing_records,
  ADD COLUMN xrays TINYINT(1) NOT NULL DEFAULT 0 AFTER employment_records,
  ADD COLUMN other_record TINYINT(1) NOT NULL DEFAULT 0 AFTER xrays;
