/**
 * Add indexes that speed up Orders tab filtering.
 * Run: node scripts/migrate-orders-filter-indexes.js
 */

require("dotenv").config();

const mysql = require("mysql2/promise");
const config = require("../src/config");

const INDEX_STATEMENTS = [
  "CREATE INDEX idx_orders_created_at ON orders (created_at)",
  "CREATE INDEX idx_orders_facility_status_id ON orders (facility_id, status, id)",
  "CREATE INDEX idx_orders_status_created_id ON orders (status, created_at, id)",
  "CREATE INDEX idx_orders_facility_created_id ON orders (facility_id, created_at, id)",
  "CREATE INDEX idx_orders_serve_company ON orders (serve_company_name)",
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
  console.log("Orders filter indexes migration complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
