/**
 * Add treating_doctor + is_manual_lookup to personal_request_facilities.
 * Usage (from backend): node scripts/run-personal-request-facility-manual-lookup-migration.js
 */
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?`,
    [table, column]
  );
  return Number(rows[0]?.cnt || 0) > 0;
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "dms_db",
  });

  try {
    if (!(await columnExists(connection, "personal_request_facilities", "treating_doctor"))) {
      await connection.query(`
        ALTER TABLE personal_request_facilities
          ADD COLUMN treating_doctor VARCHAR(255) NULL AFTER facility_address
      `);
      console.log("OK added treating_doctor");
    } else {
      console.log("SKIP treating_doctor already exists");
    }

    if (!(await columnExists(connection, "personal_request_facilities", "is_manual_lookup"))) {
      await connection.query(`
        ALTER TABLE personal_request_facilities
          ADD COLUMN is_manual_lookup TINYINT(1) NOT NULL DEFAULT 0
            COMMENT '1 when facility was typed manually (not matched to facilities.id)'
            AFTER treating_doctor
      `);
      console.log("OK added is_manual_lookup");
    } else {
      console.log("SKIP is_manual_lookup already exists");
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
