/**
 * Clear legacy auto+slug@facility.pending emails from auto-created facilities.
 * Run: node scripts/migrate-clear-facility-placeholder-emails.js
 */

const { connectDatabase, getPool } = require("../src/config/database");

async function main() {
  await connectDatabase();
  const pool = getPool();

  const [result] = await pool.execute(
    `UPDATE facilities
     SET email = '',
         updated_at = NOW()
     WHERE LOWER(email) LIKE '%@facility.pending'`
  );

  console.log(
    `Cleared ${result.affectedRows || 0} legacy placeholder facility email(s).`
  );
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
