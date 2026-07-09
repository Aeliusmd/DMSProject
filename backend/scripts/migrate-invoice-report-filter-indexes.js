/**
 * Add indexes that speed up invoice report filtering/search/pagination.
 * Run: node scripts/migrate-invoice-report-filter-indexes.js
 */

require("dotenv").config();

const mysql = require("mysql2/promise");
const config = require("../src/config");

const INDEX_STATEMENTS = [
  "CREATE INDEX idx_invoices_status_sent_date_due_date_id ON invoices (status, sent_date, amount_due, invoice_date, id)",
  "CREATE INDEX idx_invoices_invoice_date_facility_id ON invoices (invoice_date, facility_id, id)",
  "CREATE INDEX idx_invoice_xray_sent_date_payment_order ON invoice_xray_details (sent_date, xray_invoice_date, order_id)",
  "CREATE INDEX idx_facilities_name ON facilities (facility_name)",
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
  console.log("Invoice report filter indexes migration complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
