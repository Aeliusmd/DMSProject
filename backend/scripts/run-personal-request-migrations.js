/**
 * Run personal-request related SQL migrations against local DB (.env).
 * Usage (from backend): node scripts/run-personal-request-migrations.js
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

const REQUIRED = [
  "add_personal_request_orders_tables.sql",
  "add_personal_request_stripe_payments.sql",
];

const OPTIONAL_IF_STRIPE_TABLE_MISSING = ["add_stripe_online_payments.sql"];
const OPTIONAL_IF_STRIPE_TABLE_EXISTS = [
  "alter_stripe_online_payments_personal_portal.sql",
];

async function runFile(connection, fileName) {
  const fullPath = path.join(MIGRATIONS_DIR, fileName);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Migration not found: ${fileName}`);
  }
  const sql = fs.readFileSync(fullPath, "utf8");
  await connection.query(sql);
  console.log(`OK  ${fileName}`);
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "dms_db",
    multipleStatements: true,
  });

  try {
    for (const file of REQUIRED) {
      await runFile(connection, file);
    }

    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'stripe_online_payments'"
    );

    if (!tables.length) {
      for (const file of OPTIONAL_IF_STRIPE_TABLE_MISSING) {
        await runFile(connection, file);
      }
    } else {
      console.log("skip add_stripe_online_payments.sql (already exists)");
    }

    for (const file of OPTIONAL_IF_STRIPE_TABLE_EXISTS) {
      await runFile(connection, file);
    }

    console.log("\nAll personal-request migrations applied.");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Migration failed:", error.message);
  process.exit(1);
});
