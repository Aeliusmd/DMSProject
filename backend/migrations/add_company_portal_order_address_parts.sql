-- Split facility address into street / city / state / zip for company portal orders

ALTER TABLE company_portal_orders
  ADD COLUMN facility_city VARCHAR(100) NULL AFTER facility_address,
  ADD COLUMN facility_state VARCHAR(2) NULL AFTER facility_city,
  ADD COLUMN facility_zip VARCHAR(20) NULL AFTER facility_state;
