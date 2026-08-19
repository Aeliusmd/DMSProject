/**
 * Widen orders.ssn_last_four so formatted SSNs (XXX-XX-1234 / 123-45-6789) fit.
 * Databases created from recreate_orders_table.sql have CHAR(4), which makes
 * every order save with an SSN fail with ER_DATA_TOO_LONG.
 *
 * Run: node scripts/migrate-orders-ssn-storage.js
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const config = require("../src/config");

const REQUIRED_LENGTH = 11;

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  try {
    const [[current] = []] = await connection.query(
      `SELECT CHARACTER_MAXIMUM_LENGTH AS maxLength, COLUMN_TYPE AS columnType
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'orders'
          AND COLUMN_NAME = 'ssn_last_four'`
    );

    if (!current) {
      throw new Error("orders.ssn_last_four column not found.");
    }

    if (Number(current.maxLength) >= REQUIRED_LENGTH) {
      console.log(
        `orders.ssn_last_four is already ${current.columnType} — skipping.`
      );
      return;
    }

    console.log(`Widening orders.ssn_last_four from ${current.columnType}...`);

    const sqlPath = path.join(
      __dirname,
      "../migrations/expand_orders_ssn_storage.sql"
    );
    await connection.query(fs.readFileSync(sqlPath, "utf8"));

    const [rows] = await connection.query(
      `SHOW COLUMNS FROM orders WHERE Field = 'ssn_last_four'`
    );
    console.log("Migration applied. Column type:");
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
