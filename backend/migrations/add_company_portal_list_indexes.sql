-- Company portal list performance indexes (orders, wallet txs, employees)
-- Safe to run on existing databases.
USE dms_db;

-- Portal dashboard / track order keyset: ORDER BY created_at DESC, id DESC
CREATE INDEX idx_cpo_user_created_id
  ON company_portal_orders (company_user_id, created_at, id);

-- Employee-scoped portal order lists
CREATE INDEX idx_cpo_user_employee_created_id
  ON company_portal_orders (company_user_id, company_portal_employee_id, created_at, id);

-- Wallet recent transactions keyset
CREATE INDEX idx_wallet_tx_company_created_id
  ON company_portal_wallet_transactions (company_user_id, created_at, id);

-- Employees page keyset: ORDER BY name ASC, id ASC
CREATE INDEX idx_cpe_company_name_id
  ON company_portal_employees (company_user_id, name, id);
