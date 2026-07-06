require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const config = require("../src/config");

async function indexExists(connection, indexName) {
  const [rows] = await connection.execute(
    `SELECT 1
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'activity_logs'
       AND INDEX_NAME = ?
     LIMIT 1`,
    [config.db.database, indexName]
  );

  return rows.length > 0;
}

async function procedureExists(connection, procedureName) {
  const [rows] = await connection.execute(
    `SELECT 1
     FROM information_schema.ROUTINES
     WHERE ROUTINE_SCHEMA = ?
       AND ROUTINE_TYPE = 'PROCEDURE'
       AND ROUTINE_NAME = ?
     LIMIT 1`,
    [config.db.database, procedureName]
  );

  return rows.length > 0;
}

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  if (!(await indexExists(connection, "idx_activity_logs_milestone"))) {
    await connection.execute(
      `CREATE INDEX idx_activity_logs_milestone
       ON activity_logs (performed_by, module, action, log_date)`
    );
    console.log("Created idx_activity_logs_milestone");
  } else {
    console.log("idx_activity_logs_milestone already exists");
  }

  const sqlPath = path.join(
    __dirname,
    "../migrations/add_employee_milestone_stats.sql"
  );
  const sql = fs.readFileSync(sqlPath, "utf8");
  const procedureBlock = sql
    .split("DROP PROCEDURE IF EXISTS sp_employee_order_milestone_stats;")[1]
    ?.trim();

  if (!procedureBlock) {
    throw new Error("Could not parse stored procedure from migration SQL");
  }

  if (await procedureExists(connection, "sp_employee_order_milestone_stats")) {
    await connection.query("DROP PROCEDURE sp_employee_order_milestone_stats");
    console.log("Dropped existing sp_employee_order_milestone_stats");
  }

  await connection.query(procedureBlock);
  console.log("Created sp_employee_order_milestone_stats");

  await connection.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
