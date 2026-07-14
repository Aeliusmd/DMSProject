/**
 * Apply company portal ↔ internal order link migration.
 * Usage: node scripts/run-company-portal-internal-order-link-migration.js
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [table, column]
  );
  return Number(rows[0]?.cnt || 0) > 0;
}

async function main() {
  const sqlPath = path.join(
    __dirname,
    "..",
    "migrations",
    "add_company_portal_internal_order_link.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    if (await columnExists(conn, "company_portal_orders", "internal_order_id")) {
      console.log("internal_order_id already exists — skipping migration body.");
      // Still try to ensure ENUM includes company_portal.
      await conn.query(`
        ALTER TABLE orders
          MODIFY COLUMN creation_source ENUM(
            'manual',
            'auto',
            'personal_portal',
            'company_portal'
          ) NOT NULL DEFAULT 'manual'
      `);
      console.log("Ensured creation_source includes company_portal.");
      return;
    }

    await conn.query(sql);
    console.log("Migration applied successfully.");
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
