require("dotenv").config();

const { connectDatabase, getPool } = require("../src/config/database");

const COLUMNS = [
  "reminder_1_sent_at",
  "reminder_2_sent_at",
  "reminder_3_sent_at",
];

async function ensureColumns(pool, tableName) {
  const [existing] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME IN (?, ?, ?)`,
    [tableName, ...COLUMNS]
  );

  const present = new Set(existing.map((row) => row.COLUMN_NAME));
  const missing = COLUMNS.filter((column) => !present.has(column));

  if (!missing.length) {
    console.log(`${tableName}: reminder columns already exist`);
    return;
  }

  await pool.query(
    `ALTER TABLE ${tableName}
     ADD COLUMN reminder_1_sent_at DATETIME NULL,
     ADD COLUMN reminder_2_sent_at DATETIME NULL,
     ADD COLUMN reminder_3_sent_at DATETIME NULL`
  );

  console.log(`Added reminder columns to ${tableName}`);
}

async function run() {
  await connectDatabase();
  const pool = getPool();

  await ensureColumns(pool, "invoices");
  await ensureColumns(pool, "invoice_xray_details");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
