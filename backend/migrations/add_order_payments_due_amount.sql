-- Balance due per payment type (custodian / xray / prepayment)
ALTER TABLE order_payments
  ADD COLUMN due_amount DECIMAL(12,2) NULL
    COMMENT 'Balance due for this payment type'
    AFTER amount;
