require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { connectDatabase, getPool } = require("../src/config/database");

async function tableExists(pool, tableName) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [tableName]
  );
  return rows.length > 0;
}

async function run() {
  await connectDatabase();
  const pool = getPool();

  const hasTokens = await tableExists(pool, "invoice_payment_access_tokens");
  const hasPayments = await tableExists(pool, "stripe_online_payments");

  if (hasTokens && hasPayments) {
    console.log("Stripe online payments tables already exist");
    return;
  }

  const sqlPath = path.join(
    __dirname,
    "..",
    "migrations",
    "add_stripe_online_payments.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");
  const statements = sql
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await pool.query(statement);
    console.log("Executed migration statement");
  }

  console.log("Stripe online payments migration complete");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
