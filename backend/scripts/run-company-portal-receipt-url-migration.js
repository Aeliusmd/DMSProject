require("dotenv").config();

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

async function run() {
  await connectDatabase();
  const pool = getPool();

  if (await columnExists(pool, "company_portal_orders", "stripe_receipt_url")) {
    console.log("company_portal_orders.stripe_receipt_url already exists");
  } else {
    await pool.query(
      `ALTER TABLE company_portal_orders
       ADD COLUMN stripe_receipt_url VARCHAR(500) NULL AFTER stripe_payment_intent_id`
    );
    console.log("Added company_portal_orders.stripe_receipt_url");
  }

  await pool.end();
  console.log("Company portal receipt URL column ready");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
