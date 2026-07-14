-- Payment list filter indexes for large-dataset keyset pagination
-- Manual: payment_method + payment_date + id
-- Online: status + id / paid_at
-- Lookup: invoice_number prefix search

CREATE INDEX idx_invoices_manual_payment_date_id
  ON invoices (payment_method, payment_date, id);

CREATE INDEX idx_invoice_xray_manual_payment_date_id
  ON invoice_xray_details (payment_method, payment_date, id);

CREATE INDEX idx_invoices_invoice_number
  ON invoices (invoice_number);

CREATE INDEX idx_invoice_xray_invoice_number
  ON invoice_xray_details (invoice_number);

CREATE INDEX idx_stripe_succeeded_id
  ON stripe_online_payments (status, id);

CREATE INDEX idx_stripe_succeeded_paid_at_id
  ON stripe_online_payments (status, paid_at, id);

CREATE INDEX idx_stripe_invoice_number
  ON stripe_online_payments (invoice_number);
