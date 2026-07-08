/**
 * Add indexes that speed up Activity Log filtering/search/pagination.
 * Run: node scripts/migrate-activity-logs-filter-indexes.js
 */

require("dotenv").config();

const mysql = require("mysql2/promise");
const config = require("../src/config");

const INDEX_STATEMENTS = [
  "CREATE INDEX idx_activity_logs_module_id ON activity_logs (module, id)",
  "CREATE INDEX idx_activity_logs_log_date_id ON activity_logs (log_date, id)",
  "CREATE INDEX idx_activity_logs_performed_by_id ON activity_logs (performed_by, id)",
  "CREATE INDEX idx_activity_logs_performer_name ON activity_logs (performer_name)",
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
  console.log("Activity logs filter indexes migration complete.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
