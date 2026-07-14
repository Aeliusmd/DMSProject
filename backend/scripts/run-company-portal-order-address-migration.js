require("dotenv").config();

const fs = require("fs");
const path = require("path");
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

  if (await columnExists(pool, "company_portal_orders", "facility_city")) {
    console.log("facility address parts already exist");
    await pool.end();
    return;
  }

  const sqlPath = path.join(
    __dirname,
    "..",
    "migrations",
    "add_company_portal_order_address_parts.sql"
  );
  const sql = fs
    .readFileSync(sqlPath, "utf8")
    .replace(/--.*$/gm, "")
    .trim();

  await pool.query(sql);
  console.log("Added facility_city / facility_state / facility_zip");
  await pool.end();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
