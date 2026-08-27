-- Upgrade calendar DATE callback/sent/note fields to DATETIME (UTC session).
-- Existing DATE values become midnight UTC of that day; app treats them as instants.

ALTER TABLE order_notes
  MODIFY COLUMN callback_date DATETIME NULL;

ALTER TABLE order_activity_logs
  MODIFY COLUMN callback_date DATETIME NULL;

ALTER TABLE invoices
  MODIFY COLUMN sent_date DATETIME NULL;

ALTER TABLE invoice_xray_details
  MODIFY COLUMN sent_date DATETIME NULL;

ALTER TABLE facility_notes
  MODIFY COLUMN note_date DATETIME NOT NULL;
