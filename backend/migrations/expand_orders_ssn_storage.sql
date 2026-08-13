-- Store full/masked SSN from subpoena in order format (XXX-XX-1234 or 123-45-6789).
ALTER TABLE orders
  MODIFY COLUMN ssn_last_four VARCHAR(11) NULL
  COMMENT 'Formatted SSN from order/subpoena (XXX-XX-1234 or ###-##-####); legacy rows may be 4 digits only';
