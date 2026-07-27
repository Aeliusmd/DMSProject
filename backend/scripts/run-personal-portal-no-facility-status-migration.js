/**
 * Add no_facility to personal_request_orders.portal_status (and legacy table if present).
 * Run from backend: node scripts/run-personal-portal-no-facility-status-migration.js
 */

require("dotenv").config();

const { connectDatabase, getPool } = require("../src/config/database");

async function tableExists(pool, table) {
  const [rows] = await pool.query("SHOW TABLES LIKE ?", [table]);
  return rows.length > 0;
}

async function run() {
  await connectDatabase();
  const pool = getPool();

  await pool.query(
    `ALTER TABLE personal_request_orders
       MODIFY COLUMN portal_status ENUM(
         'pending_payment',
         'in_process',
         'invoice',
         'paid',
         'released',
         'no_facility'
       ) NOT NULL DEFAULT 'pending_payment'`
  );
  console.log("personal_request_orders.portal_status now includes no_facility");

  if (await tableExists(pool, "personal_portal_requests")) {
    await pool.query(
      `ALTER TABLE personal_portal_requests
         MODIFY COLUMN portal_status ENUM(
           'pending_payment',
           'in_process',
           'invoice',
           'paid',
           'released',
           'no_facility'
         ) NOT NULL DEFAULT 'pending_payment'`
    );
    console.log("personal_portal_requests.portal_status now includes no_facility");
  } else {
    console.log("personal_portal_requests not present — skipped");
  }

  await pool.end();
  console.log("Personal portal no_facility migration complete");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
