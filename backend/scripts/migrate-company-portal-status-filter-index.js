/**
 * Add index for company portal status filtering on Orders/Reports.
 * Run: node scripts/migrate-company-portal-status-filter-index.js
 */

require("dotenv").config();

const mysql = require("mysql2/promise");
const config = require("../src/config");

const STATEMENT =
  "CREATE INDEX idx_company_portal_orders_status_internal ON company_portal_orders (status, internal_order_id)";

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  });

  try {
    await connection.execute(STATEMENT);
    console.log(`Created: ${STATEMENT}`);
  } catch (error) {
    if (error.code === "ER_DUP_KEYNAME") {
      console.log(`Already exists: ${STATEMENT}`);
    } else {
      throw error;
    }
  }

  await connection.end();
  console.log("Company portal status filter index migration complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
