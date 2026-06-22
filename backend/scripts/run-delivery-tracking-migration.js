require("dotenv").config();

const { connectDatabase, getPool } = require("../src/config/database");

async function run() {
  await connectDatabase();
  const pool = getPool();

  const [cols] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'orders'
       AND COLUMN_NAME IN ('mail_sent_date', 'pickup_person_name')`
  );

  const existing = new Set(cols.map((column) => column.COLUMN_NAME));

  if (!existing.has("mail_sent_date")) {
    await pool.query(
      `ALTER TABLE orders
       ADD COLUMN mail_sent_date DATE NULL
       COMMENT 'Date records mail was sent'
       AFTER delivery_date`
    );
    console.log("Added mail_sent_date");
  } else {
    console.log("mail_sent_date already exists");
  }

  if (!existing.has("pickup_person_name")) {
    await pool.query(
      `ALTER TABLE orders
       ADD COLUMN pickup_person_name VARCHAR(150) NULL
       COMMENT 'Person who picked up records'
       AFTER mail_sent_date`
    );
    console.log("Added pickup_person_name");
  } else {
    console.log("pickup_person_name already exists");
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
