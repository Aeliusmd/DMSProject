require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const config = require("../src/config");

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  try {
    const sqlPath = path.join(
      __dirname,
      "../migrations/alter_orders_specific_record_text.sql"
    );
    const sql = fs.readFileSync(sqlPath, "utf8");
    await connection.query(sql);

    const [rows] = await connection.query(
      `SHOW COLUMNS FROM orders WHERE Field IN ('specific_record', 'specific_doctor')`
    );
    console.log("Migration applied. Column types:");
    console.log(JSON.stringify(rows, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
