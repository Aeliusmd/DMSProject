/**
 * Apply company portal employees + wallet migration.
 * Usage: node scripts/run-company-portal-employees-wallet-migration.js
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [table]
  );
  return Number(rows[0]?.cnt || 0) > 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    if (await tableExists(conn, "company_portal_employees")) {
      console.log("company_portal_employees already exists — skipping migration.");
      return;
    }

    const sqlPath = path.join(
      __dirname,
      "..",
      "migrations",
      "add_company_portal_employees_and_wallet.sql"
    );
    const sql = fs.readFileSync(sqlPath, "utf8");
    await conn.query(sql);
    console.log("Company portal employees + wallet migration applied.");
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
