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
    `SELECT COLUMN_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'order_activity_logs'
       AND COLUMN_NAME = 'attachment_path'`,
    [config.db.database]
  );

  if (columns.length > 0) {
    console.log("Column attachment_path already exists on order_activity_logs");
  } else {
    await connection.execute(
      `ALTER TABLE order_activity_logs
       ADD COLUMN attachment_path VARCHAR(500) NULL
       AFTER note`
    );
    console.log("Added attachment_path column to order_activity_logs");
  }

  await connection.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
