/**
 * Add indexes that speed up Employees tab filtering/search.
 * Run: node scripts/migrate-employees-filter-indexes.js
 */

require("dotenv").config();

const mysql = require("mysql2/promise");
const config = require("../src/config");

const INDEX_STATEMENTS = [
  "CREATE INDEX idx_matrix_employees_deleted_id ON matrix_employees (deleted_at, id)",
  "CREATE INDEX idx_matrix_employees_deleted_name_id ON matrix_employees (deleted_at, name, id)",
];

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  });

  for (const statement of INDEX_STATEMENTS) {
    try {
      await connection.execute(statement);
      console.log(`Created: ${statement}`);
    } catch (error) {
      if (error.code === "ER_DUP_KEYNAME") {
        console.log(`Already exists: ${statement}`);
        continue;
      }

      throw error;
    }
  }

  await connection.end();
  console.log("Employees filter indexes migration complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
