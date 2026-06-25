/**
 * Add orders.rec_number column.
 * Run: node scripts/migrate-orders-rec-number.js
 */

const { getPool } = require("../src/config/database");

async function main() {
  const pool = getPool();

  try {
    await pool.execute(`
      ALTER TABLE orders
        ADD COLUMN rec_number VARCHAR(50) NULL
          COMMENT 'REC number from subpoena or manual entry'
          AFTER order_number
    `);
    console.log("Added orders.rec_number column.");
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("orders.rec_number already exists — skipping.");
      process.exit(0);
    }

    throw error;
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
