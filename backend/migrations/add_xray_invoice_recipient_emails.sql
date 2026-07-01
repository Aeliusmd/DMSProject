-- Store recipient email(s) used when an X-Ray invoice was emailed.
ALTER TABLE invoice_xray_details
  ADD COLUMN recipient_emails VARCHAR(500) NULL AFTER sent_date;
