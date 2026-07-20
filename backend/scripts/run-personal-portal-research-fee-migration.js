/**
 * Add research fee columns for personal portal post-verification $5 fee.
 * Usage (from backend): node scripts/run-personal-portal-research-fee-migration.js
 */
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?`,
    [table, column]
  );
  return Number(rows[0]?.cnt || 0) > 0;
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "dms_db",
  });

  try {
    if (!(await columnExists(connection, "personal_request_orders", "research_fee_status"))) {
      await connection.query(`
        ALTER TABLE personal_request_orders
          ADD COLUMN research_fee_status ENUM('none', 'pending', 'paid', 'waived')
            NOT NULL DEFAULT 'none'
            AFTER processing_fee_paid,
          ADD COLUMN research_fee_requested_at DATETIME NULL
            AFTER research_fee_status,
          ADD COLUMN research_fee_paid_at DATETIME NULL
            AFTER research_fee_requested_at,
          ADD COLUMN research_fee_checkout_session_id VARCHAR(255) NULL
            AFTER research_fee_paid_at
      `);
      console.log("OK personal_request_orders research fee columns");
    } else {
      console.log("SKIP personal_request_orders research fee columns");
    }

    if (!(await columnExists(connection, "personal_request_stripe_payments", "payment_kind"))) {
      await connection.query(`
        ALTER TABLE personal_request_stripe_payments
          ADD COLUMN payment_kind ENUM('processing_fee', 'research_fee')
            NOT NULL DEFAULT 'processing_fee'
            AFTER personal_request_order_id
      `);
      console.log("OK personal_request_stripe_payments.payment_kind");
    } else {
      console.log("SKIP payment_kind already exists");
    }
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
