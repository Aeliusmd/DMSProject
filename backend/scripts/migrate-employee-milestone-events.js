require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const config = require("../src/config");

async function tableExists(connection, tableName) {
  const [rows] = await connection.execute(
    `SELECT 1
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
     LIMIT 1`,
    [config.db.database, tableName]
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

  if (await tableExists(connection, "employee_order_milestone_events")) {
    console.log("employee_order_milestone_events already exists");
  } else {
    const sqlPath = path.join(
      __dirname,
      "../migrations/add_employee_milestone_events.sql"
    );
    const sql = fs.readFileSync(sqlPath, "utf8");
    await connection.query(sql);
    console.log("Created employee_order_milestone_events table");
  }

  await connection.query(
    "DROP PROCEDURE IF EXISTS sp_employee_order_milestone_stats"
  );
  console.log("Dropped sp_employee_order_milestone_stats (if existed)");

  await connection.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
