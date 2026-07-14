-- Store Stripe-hosted receipt URL for company portal payments
ALTER TABLE company_portal_orders
  ADD COLUMN stripe_receipt_url VARCHAR(500) NULL AFTER stripe_payment_intent_id;
