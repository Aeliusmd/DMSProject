require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { connectDatabase, getPool } = require("../src/config/database");

async function tableExists(pool, table) {
  const [rows] = await pool.query(
    `SELECT TABLE_NAME
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?`,
    [table]
  );
  return rows.length > 0;
}

function splitSqlStatements(sql) {
  return sql
    .replace(/--.*$/gm, "")
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function run() {
  await connectDatabase();
  const pool = getPool();

  if (await tableExists(pool, "company_portal_orders")) {
    console.log("company_portal_orders already exists");
    await pool.end();
    return;
  }

  const sqlPath = path.join(
    __dirname,
    "..",
    "migrations",
    "add_company_portal_orders_table.sql"
  );
  const statements = splitSqlStatements(fs.readFileSync(sqlPath, "utf8"));

  for (const statement of statements) {
    await pool.query(statement);
    console.log("Executed company portal orders migration statement");
  }

  await pool.end();
  console.log("company_portal_orders ready");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
