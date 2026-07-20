/**
 * Make personal_portal_users.password_hash nullable for OTP-only accounts.
 * Usage (from backend): node scripts/run-nullable-personal-portal-password-migration.js
 */
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "dms_db",
    namedPlaceholders: true,
  });

  try {
    await connection.query(`
      ALTER TABLE personal_portal_users
        MODIFY COLUMN password_hash VARCHAR(255) NULL
    `);
    console.log("OK personal_portal_users.password_hash is now nullable");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
