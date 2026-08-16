-- Staff can end personal portal orders when the requested facility cannot be found.
ALTER TABLE personal_request_orders
  MODIFY COLUMN portal_status ENUM(
    'pending_payment',
    'in_process',
    'invoice',
    'paid',
    'released',
    'no_facility'
  ) NOT NULL DEFAULT 'pending_payment';

-- Legacy table (if still present in some environments)
ALTER TABLE personal_portal_requests
  MODIFY COLUMN portal_status ENUM(
    'pending_payment',
    'in_process',
    'invoice',
    'paid',
    'released',
    'no_facility'
  ) NOT NULL DEFAULT 'pending_payment';
