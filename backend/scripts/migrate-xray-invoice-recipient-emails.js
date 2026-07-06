/**
 * Add invoice_xray_details.recipient_emails column.
 * Run: node scripts/migrate-xray-invoice-recipient-emails.js
 */

const { connectDatabase, getPool } = require("../src/config/database");

async function main() {
  await connectDatabase();
  const pool = getPool();

  try {
    await pool.execute(
      `ALTER TABLE invoice_xray_details
       ADD COLUMN recipient_emails VARCHAR(500) NULL AFTER sent_date`
    );
    console.log("Added invoice_xray_details.recipient_emails column.");
  } catch (error) {
    if (error.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }

    console.log("recipient_emails column already exists — skipping add.");
  }

  console.log("X-Ray invoice recipient emails migration complete.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
