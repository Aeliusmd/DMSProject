/**
 * Add order_payments.due_amount column.
 * Run: node scripts/run-order-payments-due-migration.js
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { connectDatabase, getPool } = require("../src/config/database");

async function main() {
  await connectDatabase();
  const pool = getPool();
  const sqlPath = path.join(
    __dirname,
    "..",
    "migrations",
    "add_order_payments_due_amount.sql"
  );

  try {
    await pool.query(fs.readFileSync(sqlPath, "utf8"));
    console.log("order_payments.due_amount column is ready.");
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("due_amount column already exists — skipping.");
    } else {
      throw error;
    }
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
