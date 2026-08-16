/**
 * Indexes for company portal / employee list keyset pagination.
 * Run: node scripts/migrate-company-portal-list-indexes.js
 */

require("dotenv").config();

const mysql = require("mysql2/promise");
const config = require("../src/config");

const INDEX_STATEMENTS = [
  "CREATE INDEX idx_cpo_user_created_id ON company_portal_orders (company_user_id, created_at, id)",
  "CREATE INDEX idx_cpo_user_employee_created_id ON company_portal_orders (company_user_id, company_portal_employee_id, created_at, id)",
  "CREATE INDEX idx_wallet_tx_company_created_id ON company_portal_wallet_transactions (company_user_id, created_at, id)",
  "CREATE INDEX idx_cpe_company_name_id ON company_portal_employees (company_user_id, name, id)",
];

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  });

  for (const statement of INDEX_STATEMENTS) {
    try {
      await connection.execute(statement);
      console.log(`Created: ${statement}`);
    } catch (error) {
      if (error.code === "ER_DUP_KEYNAME") {
        console.log(`Already exists: ${statement}`);
        continue;
      }
      throw error;
    }
  }

  await connection.end();
  console.log("Company portal list indexes migration complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
