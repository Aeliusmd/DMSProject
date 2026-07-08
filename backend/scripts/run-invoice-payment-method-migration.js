require("dotenv").config();

const { connectDatabase, getPool } = require("../src/config/database");

async function ensureColumn(pool, table, column, definition) {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  );

  if (cols.length) {
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
    "invoices",
    "payment_method",
    "payment_method ENUM('manual', 'online') NULL AFTER amount_due"
  );
  await ensureColumn(
    pool,
    "invoices",
    "payment_check_number",
    "payment_check_number VARCHAR(50) NULL AFTER payment_method"
  );
  await ensureColumn(
    pool,
    "invoices",
    "payment_date",
    "payment_date DATE NULL AFTER payment_check_number"
  );
  await ensureColumn(
    pool,
    "invoices",
    "payment_recorded_by",
    "payment_recorded_by BIGINT UNSIGNED NULL AFTER payment_date"
  );
  await ensureColumn(
    pool,
    "invoices",
    "payment_recorded_at",
    "payment_recorded_at DATETIME NULL AFTER payment_recorded_by"
  );

  await ensureColumn(
    pool,
    "invoice_xray_details",
    "payment_method",
    "payment_method ENUM('manual', 'online') NULL AFTER payment"
  );
  await ensureColumn(
    pool,
    "invoice_xray_details",
    "payment_check_number",
    "payment_check_number VARCHAR(50) NULL AFTER payment_method"
  );
  await ensureColumn(
    pool,
    "invoice_xray_details",
    "payment_date",
    "payment_date DATE NULL AFTER payment_check_number"
  );
  await ensureColumn(
    pool,
    "invoice_xray_details",
    "notes",
    "notes TEXT NULL AFTER payment_date"
  );
  await ensureColumn(
    pool,
    "invoice_xray_details",
    "payment_recorded_by",
    "payment_recorded_by BIGINT UNSIGNED NULL AFTER notes"
  );
  await ensureColumn(
    pool,
    "invoice_xray_details",
    "payment_recorded_at",
    "payment_recorded_at DATETIME NULL AFTER payment_recorded_by"
  );
  await ensureColumn(
    pool,
    "invoice_xray_details",
    "amount_paid",
    "amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER payment_recorded_at"
  );
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
