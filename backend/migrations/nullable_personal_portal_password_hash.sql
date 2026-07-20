-- Allow passwordless (email + OTP) personal portal accounts.
ALTER TABLE personal_portal_users
  MODIFY COLUMN password_hash VARCHAR(255) NULL;
