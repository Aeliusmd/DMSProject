require("dotenv").config();

const mysql = require("mysql2/promise");
const config = require("../src/config");

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  });

  const [columns] = await connection.execute(
    `SELECT COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'activity_logs'
       AND COLUMN_NAME = 'module'`,
    [config.db.database]
  );

  const current = columns[0];
  console.log("Current module column:", current?.COLUMN_TYPE || "not found");

  if (!current) {
    throw new Error("activity_logs.module column not found");
  }

  const columnType = String(current.COLUMN_TYPE || "").toLowerCase();

  if (columnType.startsWith("varchar(50)")) {
    console.log("module column already VARCHAR(50) — no migration needed");
  } else {
    await connection.execute(
      `ALTER TABLE activity_logs
       MODIFY COLUMN module VARCHAR(50) NOT NULL`
    );
    console.log("Updated activity_logs.module to VARCHAR(50)");
  }

  await connection.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
