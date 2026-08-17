/**
 * Expand orders.ssn_last_four from CHAR(4) to VARCHAR(11) for full/masked SSN storage.
 * Run from backend: node scripts/run-expand-orders-ssn-storage-migration.js
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { connectDatabase, getPool } = require("../src/config/database");

async function run() {
  await connectDatabase();
  const pool = getPool();

  const sqlPath = path.join(
    __dirname,
    "..",
    "migrations",
    "expand_orders_ssn_storage.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");

  await pool.query(sql);
  console.log("orders.ssn_last_four expanded to VARCHAR(11)");

  const [col] = await pool.query("SHOW COLUMNS FROM orders LIKE 'ssn_last_four'");
  console.log("Column now:", col[0]?.Type);

  await pool.end();
  console.log("SSN storage migration complete");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
