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

  const sqlPath = path.join(
    __dirname,
    "..",
    "migrations",
    "add_company_portal_auth_tables.sql"
  );
  const statements = splitSqlStatements(fs.readFileSync(sqlPath, "utf8"));

  for (const statement of statements) {
    const createsUsers = /CREATE TABLE IF NOT EXISTS company_portal_users\b/i.test(
      statement
    );
    const createsSessions =
      /CREATE TABLE IF NOT EXISTS company_portal_sessions\b/i.test(statement);

    if (createsUsers && (await tableExists(pool, "company_portal_users"))) {
      console.log("company_portal_users already exists");
      continue;
    }

    if (createsSessions && (await tableExists(pool, "company_portal_sessions"))) {
      console.log("company_portal_sessions already exists");
      continue;
    }

    await pool.query(statement);
    console.log("Executed company portal migration statement");
  }

  await pool.end();
  console.log("Company portal auth tables ready");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
