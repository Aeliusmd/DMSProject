/**
 * Add batch scan chosen facility + mismatch columns.
 * Run: node scripts/migrate-batch-scan-chosen-facility.js
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const config = require("../src/config");

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function main() {
  const sqlPath = path.join(
    __dirname,
    "../migrations/add_batch_scan_chosen_facility.sql"
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
    const alreadyApplied = await columnExists(
      connection,
      "unprocessed_subpoenas",
      "chosen_facility_id"
    );

    if (alreadyApplied) {
      console.log("Batch scan chosen facility migration already applied.");
      return;
    }

    await connection.query(sql);
    console.log("Batch scan chosen facility migration complete.");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
