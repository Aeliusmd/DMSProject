require("dotenv").config();

const { connectDatabase, getPool } = require("../src/config/database");

async function run() {
  await connectDatabase();
  const pool = getPool();

  const [cols] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'invoice_xray_details'
       AND COLUMN_NAME = 'sent_date'`
  );

  if (cols.length) {
    console.log("invoice_xray_details.sent_date already exists");
    return;
  }

  await pool.query(
    `ALTER TABLE invoice_xray_details
     ADD COLUMN sent_date DATE NULL
     AFTER description`
  );

  console.log("Added invoice_xray_details.sent_date");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
