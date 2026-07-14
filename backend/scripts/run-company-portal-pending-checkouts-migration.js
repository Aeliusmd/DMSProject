require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { connectDatabase, getPool } = require("../src/config/database");

async function run() {
  await connectDatabase();
  const pool = getPool();
  const sqlPath = path.join(
    __dirname,
    "../migrations/add_company_portal_pending_checkouts.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");
  await pool.query(sql);
  await pool.end();
  console.log("company_portal_pending_checkouts table ready");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
