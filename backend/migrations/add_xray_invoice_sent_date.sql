-- Track when an X-Ray invoice was emailed/marked sent.
ALTER TABLE invoice_xray_details
  ADD COLUMN sent_date DATE NULL
  AFTER description;
