/**
 * Create company_portal_activity_logs table.
 * Run: node scripts/migrate-company-portal-activity-logs.js
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const config = require("../src/config");

async function main() {
  const sqlPath = path.join(
    __dirname,
    "../migrations/add_company_portal_activity_logs.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");

  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  try {
    await connection.query(sql);
    console.log("company_portal_activity_logs migration complete.");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
