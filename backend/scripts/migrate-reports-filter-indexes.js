/**
 * Add indexes that speed up Reports tab filtering/search.
 * Run: node scripts/migrate-reports-filter-indexes.js
 */

require("dotenv").config();

const mysql = require("mysql2/promise");
const config = require("../src/config");

const INDEX_STATEMENTS = [
  "CREATE INDEX idx_orders_status_subpoena_id ON orders (status, subpoena_date, id)",
  "CREATE INDEX idx_orders_facility_status_created_id ON orders (facility_id, status, created_at, id)",
  "CREATE INDEX idx_orders_case_number ON orders (case_number)",
  "CREATE INDEX idx_orders_order_number ON orders (order_number)",
  "CREATE INDEX idx_orders_specific_doctor ON orders (specific_doctor)",
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
  console.log("Reports filter indexes migration complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
