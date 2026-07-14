-- Extend staff online payments to include personal portal processing fees.
-- Prerequisites: stripe_online_payments (from add_stripe_online_payments.sql)

ALTER TABLE stripe_online_payments
  MODIFY COLUMN invoice_type ENUM('regular', 'xray', 'personal_portal') NOT NULL;
