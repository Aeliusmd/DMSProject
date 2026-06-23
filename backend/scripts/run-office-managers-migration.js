/**
 * Create office_managers table.
 * Run: node scripts/run-office-managers-migration.js
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { connectDatabase, getPool } = require("../src/config/database");

async function main() {
  await connectDatabase();
  const pool = getPool();
  const sqlPath = path.join(__dirname, "..", "migrations", "create_office_managers.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  await pool.query(sql);
  console.log("office_managers table is ready.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
