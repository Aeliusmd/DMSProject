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

async function ensureColumn(pool, table, column, definition) {
  if (await columnExists(pool, table, column)) {
    console.log(`${table}.${column} already exists`);
    return;
  }

  await pool.query(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  console.log(`Added ${table}.${column}`);
}

async function run() {
  await connectDatabase();
  const pool = getPool();

  const hasStatus = await columnExists(pool, "invoice_xray_details", "status");

  if (!hasStatus) {
    const sqlPath = path.join(
      __dirname,
      "..",
      "migrations",
      "add_xray_invoice_writeoff_columns.sql"
    );
    const sql = fs.readFileSync(sqlPath, "utf8");
    const statements = sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await pool.query(statement);
      console.log("Executed migration statement");
    }
  } else {
    await ensureColumn(
      pool,
      "invoice_xray_details",
      "writeoff_amount",
      "writeoff_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER amount_paid"
    );
    await ensureColumn(
      pool,
      "invoice_xray_details",
      "writeoff_date",
      "writeoff_date DATE NULL AFTER writeoff_amount"
    );
    await ensureColumn(
      pool,
      "invoice_xray_details",
      "writeoff_by",
      "writeoff_by BIGINT UNSIGNED NULL AFTER writeoff_date"
    );
    await ensureColumn(
      pool,
      "invoice_xray_details",
      "writeoff_reason",
      "writeoff_reason TEXT NULL AFTER writeoff_by"
    );
  }

  await pool.end();
  console.log("X-Ray invoice write-off migration complete.");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
