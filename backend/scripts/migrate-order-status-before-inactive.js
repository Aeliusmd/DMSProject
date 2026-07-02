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
       AND TABLE_NAME = 'orders'
       AND COLUMN_NAME = 'status_before_inactive'`,
    [config.db.database]
  );

  if (columns.length) {
    console.log("status_before_inactive already exists — no migration needed");
  } else {
    await connection.execute(
      `ALTER TABLE orders
       ADD COLUMN status_before_inactive VARCHAR(50) NULL
         COMMENT 'Status before cancel or delete; used when restoring'
         AFTER status`
    );
    console.log("Added orders.status_before_inactive");
  }

  await connection.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
