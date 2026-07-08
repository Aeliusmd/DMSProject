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
       AND COLUMN_NAME = 'invoice_number'`
  );

  if (!cols.length) {
    await pool.query(
      `ALTER TABLE invoice_xray_details
       ADD COLUMN invoice_number VARCHAR(50) NULL
       AFTER order_id`
    );
    console.log("Added invoice_xray_details.invoice_number");
  } else {
    console.log("invoice_xray_details.invoice_number already exists");
  }

  const [result] = await pool.query(
    `UPDATE invoice_xray_details x
     INNER JOIN orders o ON o.id = x.order_id
     SET x.invoice_number = CONCAT('INV-', o.order_number, 'X')
     WHERE x.invoice_number IS NULL OR TRIM(x.invoice_number) = ''`
  );

  console.log(`Backfilled ${result.affectedRows || 0} x-ray invoice numbers`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
