/**
 * Expand ZIP columns to VARCHAR(20) for ZIP+4 from subpoena extraction.
 * Run from backend: node scripts/run-expand-zip-for-subpoena-migration.js
 */

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { connectDatabase, getPool } = require("../src/config/database");

const MIGRATION_FILES = [
  "expand_zip_for_subpoena.sql",
  "expand_orders_case_number.sql",
];

const COLUMNS_TO_VERIFY = [
  { table: "orders", column: "serve_zip", expected: "varchar(20)" },
  { table: "providers", column: "zip_code", expected: "varchar(20)" },
  { table: "facilities", column: "zip_code", expected: "varchar(20)" },
];

function readMigrationStatements(file) {
  const sqlPath = path.join(__dirname, "..", "migrations", file);
  return fs
    .readFileSync(sqlPath, "utf8")
    .replace(/--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function run() {
  await connectDatabase();
  const pool = getPool();

  for (const file of MIGRATION_FILES) {
    const statements = readMigrationStatements(file);
    for (const statement of statements) {
      await pool.query(statement);
      console.log(`Applied from ${file}: ${statement.split("\n")[0].trim()}...`);
    }
  }

  for (const { table, column, expected } of COLUMNS_TO_VERIFY) {
    const [col] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [
      column,
    ]);
    const type = String(col[0]?.Type || "").toLowerCase();
    console.log(`${table}.${column}: ${type}`);
    if (type !== expected) {
      throw new Error(
        `${table}.${column} is ${type}, expected ${expected}`
      );
    }
  }

  await pool.end();
  console.log("ZIP storage migration complete");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
