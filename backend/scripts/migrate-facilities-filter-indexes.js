/**
 * Add indexes that speed up Facilities tab filtering/search.
 * Run: node scripts/migrate-facilities-filter-indexes.js
 */

require("dotenv").config();

const mysql = require("mysql2/promise");
const config = require("../src/config");

const INDEX_STATEMENTS = [
  "CREATE INDEX idx_facilities_active_id ON facilities (is_active, id)",
  "CREATE INDEX idx_facilities_active_name_id ON facilities (is_active, facility_name, id)",
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
  console.log("Facilities filter indexes migration complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
