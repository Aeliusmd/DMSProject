/**
 * Add indexes that speed up company invoice filtering/search/pagination.
 * Run: node scripts/migrate-company-invoices-filter-indexes.js
 */

require("dotenv").config();

const mysql = require("mysql2/promise");
const config = require("../src/config");

const INDEX_STATEMENTS = [
  "CREATE INDEX idx_invoices_provider_invoice_date_id ON invoices (invoice_date, id)",
  "CREATE INDEX idx_orders_provider_id ON orders (provider_id, id)",
  "CREATE INDEX idx_invoice_xray_provider_invoice_date_order ON invoice_xray_details (xray_invoice_date, order_id)",
  "CREATE INDEX idx_orders_order_number ON orders (order_number)",
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
  console.log("Company invoice filter indexes migration complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
