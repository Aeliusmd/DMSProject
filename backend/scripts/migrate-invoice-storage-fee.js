/**
 * Add invoices.storage_fee column and migrate legacy other_fee values.
 * Run: node scripts/migrate-invoice-storage-fee.js
 */

const { connectDatabase, getPool } = require("../src/config/database");

async function main() {
  await connectDatabase();
  const pool = getPool();

  try {
    await pool.execute(
      `ALTER TABLE invoices
       ADD COLUMN storage_fee DECIMAL(10, 2) NOT NULL DEFAULT 0
         COMMENT 'Storage fee'
         AFTER shipping_handling`
    );
    console.log("Added invoices.storage_fee column.");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }

    console.log("storage_fee column already exists — skipping add.");
  }

  const [result] = await pool.execute(
    `UPDATE invoices
     SET storage_fee = other_fee
     WHERE storage_fee = 0
       AND other_fee > 0`
  );

  console.log(
    `Migrated ${result.affectedRows || 0} legacy other_fee value(s) to storage_fee.`
  );
  console.log("Invoice storage fee migration complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
