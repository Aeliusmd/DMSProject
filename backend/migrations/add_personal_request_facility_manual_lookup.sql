-- Optional treating doctor + flag when facility was entered manually
-- (not selected from known facilities list).
ALTER TABLE personal_request_facilities
  ADD COLUMN treating_doctor VARCHAR(255) NULL AFTER facility_address,
  ADD COLUMN is_manual_lookup TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 when facility was typed manually (not matched to facilities.id)'
    AFTER treating_doctor;
