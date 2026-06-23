/**
 * Add invoices clerical time and shipping/handling columns.
 * Run: node scripts/migrate-invoice-clerical-shipping.js
 */

const { connectDatabase, getPool } = require("../src/config/database");

async function main() {
  await connectDatabase();
  const pool = getPool();

  const statements = [
    `ALTER TABLE invoices
       ADD COLUMN clerical_time_hours DECIMAL(10, 2) NOT NULL DEFAULT 0
         COMMENT 'Clerical time in hours'
         AFTER per_page_amount`,
    `ALTER TABLE invoices
       ADD COLUMN clerical_hourly_rate DECIMAL(10, 2) NOT NULL DEFAULT 0
         COMMENT 'Clerical hourly charge rate'
         AFTER clerical_time_hours`,
    `ALTER TABLE invoices
       ADD COLUMN shipping_handling DECIMAL(10, 2) NOT NULL DEFAULT 0
         COMMENT 'Shipping and handling fee'
         AFTER clerical_hourly_rate`,
  ];

  for (const sql of statements) {
    try {
      await pool.execute(sql);
      console.log("Applied:", sql.split("\n")[0].trim());
    } catch (error) {
      if (error.code === "ER_DUP_FIELDNAME") {
        console.log("Column already exists — skipping.");
        continue;
      }

      throw error;
    }
  }

  console.log("Invoice clerical/shipping migration complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
