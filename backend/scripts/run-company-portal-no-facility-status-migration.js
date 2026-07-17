/**
 * Add 'No facility' status to company_portal_orders and an invoice_billed_at
 * column to company_portal_new_facility.
 * Run: node scripts/run-company-portal-no-facility-status-migration.js
 */

require("dotenv").config();

const { connectDatabase, getPool } = require("../src/config/database");

async function columnExists(pool, table, column) {
  const [rows] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function run() {
  await connectDatabase();
  const pool = getPool();

  await pool.query(
    `ALTER TABLE company_portal_orders
       MODIFY COLUMN status ENUM(
         'Draft',
         'Awaiting Payment',
         'In Process',
         'Invoice',
         'Paid',
         'Released',
         'Cancelled',
         'No facility'
       ) NOT NULL DEFAULT 'Draft'`
  );
  console.log("company_portal_orders.status enum now includes 'No facility'");

  if (await columnExists(pool, "company_portal_new_facility", "invoice_billed_at")) {
    console.log("company_portal_new_facility.invoice_billed_at already exists");
  } else {
    await pool.query(
      `ALTER TABLE company_portal_new_facility
         ADD COLUMN invoice_billed_at DATETIME NULL AFTER status`
    );
    console.log("Added company_portal_new_facility.invoice_billed_at");
  }

  await pool.end();
  console.log("No-facility status migration complete");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
