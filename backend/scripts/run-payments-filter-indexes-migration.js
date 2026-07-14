require("dotenv").config();

const { connectDatabase, getPool } = require("../src/config/database");

const INDEXES = [
  {
    table: "invoices",
    name: "idx_invoices_manual_payment_date_id",
    ddl: "CREATE INDEX idx_invoices_manual_payment_date_id ON invoices (payment_method, payment_date, id)",
  },
  {
    table: "invoice_xray_details",
    name: "idx_invoice_xray_manual_payment_date_id",
    ddl: "CREATE INDEX idx_invoice_xray_manual_payment_date_id ON invoice_xray_details (payment_method, payment_date, id)",
  },
  {
    table: "invoices",
    name: "idx_invoices_invoice_number",
    ddl: "CREATE INDEX idx_invoices_invoice_number ON invoices (invoice_number)",
  },
  {
    table: "invoice_xray_details",
    name: "idx_invoice_xray_invoice_number",
    ddl: "CREATE INDEX idx_invoice_xray_invoice_number ON invoice_xray_details (invoice_number)",
  },
  {
    table: "stripe_online_payments",
    name: "idx_stripe_succeeded_id",
    ddl: "CREATE INDEX idx_stripe_succeeded_id ON stripe_online_payments (status, id)",
  },
  {
    table: "stripe_online_payments",
    name: "idx_stripe_succeeded_paid_at_id",
    ddl: "CREATE INDEX idx_stripe_succeeded_paid_at_id ON stripe_online_payments (status, paid_at, id)",
  },
  {
    table: "stripe_online_payments",
    name: "idx_stripe_invoice_number",
    ddl: "CREATE INDEX idx_stripe_invoice_number ON stripe_online_payments (invoice_number)",
  },
];

async function indexExists(pool, table, indexName) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND INDEX_NAME = ?
     LIMIT 1`,
    [table, indexName]
  );
  return rows.length > 0;
}

async function run() {
  await connectDatabase();
  const pool = getPool();

  for (const index of INDEXES) {
    if (await indexExists(pool, index.table, index.name)) {
      console.log(`${index.name} already exists`);
      continue;
    }
    await pool.query(index.ddl);
    console.log(`Created ${index.name}`);
  }

  await pool.end();
  console.log("Payment filter indexes ready");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
