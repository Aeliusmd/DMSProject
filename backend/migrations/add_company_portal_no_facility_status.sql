-- Add 'No facility' status to company portal orders and track facility-search
-- fee billing on new-facility requests.

ALTER TABLE company_portal_orders
  MODIFY COLUMN status ENUM(
    'Draft',
    'Awaiting Payment',
    'In Process',
    'Invoice',
    'Paid',
    'Released',
    'Cancelled',
    'No facility'
  ) NOT NULL DEFAULT 'Draft';

ALTER TABLE company_portal_new_facility
  ADD COLUMN invoice_billed_at DATETIME NULL AFTER status;
