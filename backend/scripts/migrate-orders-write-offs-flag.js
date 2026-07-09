/**
 * Add orders.is_subpoena and orders.is_write_offs if missing.
 * Run: node scripts/migrate-orders-write-offs-flag.js
 */

require("dotenv").config();

const mysql = require("mysql2/promise");
const config = require("../src/config");

async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [config.db.database, tableName, columnName]
  );

  return rows.length > 0;
}

async function addColumn(connection, sql, label) {
  try {
    await connection.execute(sql);
    console.log(`Added: ${label}`);
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log(`Already exists: ${label}`);
      return;
    }

    throw error;
  }
}

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  });

  const hasIsSubpoena = await columnExists(connection, "orders", "is_subpoena");
  const hasIsWriteOffs = await columnExists(connection, "orders", "is_write_offs");

  if (!hasIsSubpoena) {
    await addColumn(
      connection,
      `ALTER TABLE orders
       ADD COLUMN is_subpoena TINYINT(1) NOT NULL DEFAULT 0
         COMMENT '1 = subpoena on file, 0 = no subpoena'
         AFTER status`,
      "orders.is_subpoena"
    );
  } else {
    console.log("Already exists: orders.is_subpoena");
  }

  if (!hasIsWriteOffs) {
    await addColumn(
      connection,
      `ALTER TABLE orders
       ADD COLUMN is_write_offs TINYINT(1) NOT NULL DEFAULT 0
         COMMENT '1 = order has invoice write-off'
         AFTER is_subpoena`,
      "orders.is_write_offs"
    );
  } else {
    console.log("Already exists: orders.is_write_offs");
  }

  if (!hasIsWriteOffs) {
    await connection.execute(
      `UPDATE orders
       SET is_write_offs = 1
       WHERE status = 'Write Offs'`
    );
    console.log("Backfilled is_write_offs for existing Write Offs orders");
  }

  await connection.end();
  console.log("Orders write-off flag migration complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
