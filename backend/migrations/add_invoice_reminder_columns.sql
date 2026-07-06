-- Automatic invoice reminder tracking (standard + x-ray invoices)
ALTER TABLE invoices
  ADD COLUMN reminder_1_sent_at DATETIME NULL AFTER recipient_emails,
  ADD COLUMN reminder_2_sent_at DATETIME NULL AFTER reminder_1_sent_at,
  ADD COLUMN reminder_3_sent_at DATETIME NULL AFTER reminder_2_sent_at;

ALTER TABLE invoice_xray_details
  ADD COLUMN reminder_1_sent_at DATETIME NULL AFTER recipient_emails,
  ADD COLUMN reminder_2_sent_at DATETIME NULL AFTER reminder_1_sent_at,
  ADD COLUMN reminder_3_sent_at DATETIME NULL AFTER reminder_2_sent_at;
