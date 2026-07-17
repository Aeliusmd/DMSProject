/**
 * Creates order_record_download_links if missing.
 * Usage: node scripts/run-order-record-download-links-migration.js
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "dms_db",
    multipleStatements: true,
  });

  try {
    const sql = fs.readFileSync(
      path.join(__dirname, "..", "migrations", "add_order_record_download_links.sql"),
      "utf8"
    );
    await connection.query(sql);
    const [rows] = await connection.query(
      "SHOW TABLES LIKE 'order_record_download_links'"
    );
    console.log("Migration complete.", rows);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
