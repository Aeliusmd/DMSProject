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

  await ensureColumn(
    pool,
    "company_portal_orders",
    "company_city",
    "company_city VARCHAR(100) NULL AFTER company_address"
  );
  await ensureColumn(
    pool,
    "company_portal_orders",
    "company_state",
    "company_state VARCHAR(2) NULL AFTER company_city"
  );
  await ensureColumn(
    pool,
    "company_portal_orders",
    "company_zip",
    "company_zip VARCHAR(20) NULL AFTER company_state"
  );
  await ensureColumn(
    pool,
    "company_portal_orders",
    "medical_records",
    "medical_records TINYINT(1) NOT NULL DEFAULT 0 AFTER requested_record"
  );
  await ensureColumn(
    pool,
    "company_portal_orders",
    "billing_records",
    "billing_records TINYINT(1) NOT NULL DEFAULT 0 AFTER medical_records"
  );
  await ensureColumn(
    pool,
    "company_portal_orders",
    "employment_records",
    "employment_records TINYINT(1) NOT NULL DEFAULT 0 AFTER billing_records"
  );
  await ensureColumn(
    pool,
    "company_portal_orders",
    "xrays",
    "xrays TINYINT(1) NOT NULL DEFAULT 0 AFTER employment_records"
  );
  await ensureColumn(
    pool,
    "company_portal_orders",
    "other_record",
    "other_record TINYINT(1) NOT NULL DEFAULT 0 AFTER xrays"
  );

  await pool.end();
  console.log("Company portal record types + company address columns ready");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
