require("dotenv").config();

const { connectDatabase, getPool } = require("../src/config/database");

const TARGET_STATUS_ENUM = [
  "Active",
  "Ready",
  "Ready to Pickup",
  "Completed",
  "Cancelled",
  "Deleted",
  "Write Offs",
];

async function getStatusColumnType(pool) {
  const [rows] = await pool.query(
    `SELECT COLUMN_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'orders'
       AND COLUMN_NAME = 'status'
     LIMIT 1`
  );

  return rows[0]?.COLUMN_TYPE || "";
}

function enumIncludes(columnType, value) {
  return columnType.includes(`'${value}'`);
}

async function run() {
  await connectDatabase();
  const pool = getPool();

  const columnType = await getStatusColumnType(pool);

  if (!columnType) {
    throw new Error("orders.status column not found");
  }

  if (!enumIncludes(columnType, "Deleted")) {
    const enumSql = TARGET_STATUS_ENUM.map((value) => `'${value}'`).join(", ");

    await pool.query(
      `ALTER TABLE orders
       MODIFY COLUMN status ENUM(${enumSql}) NOT NULL DEFAULT 'Active'`
    );
    console.log("Added 'Deleted' to orders.status enum");
  } else {
    console.log("orders.status already includes 'Deleted'");
  }

  const [deletedFlagCols] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'orders'
       AND COLUMN_NAME = 'is_deleted'`
  );

  if (deletedFlagCols.length > 0) {
    await pool.query(
      `UPDATE orders
       SET status = 'Deleted'
       WHERE is_deleted = 1
         AND status <> 'Deleted'`
    );

    const [indexes] = await pool.query(`SHOW INDEX FROM orders WHERE Key_name = 'idx_orders_is_deleted'`);

    if (indexes.length > 0) {
      await pool.query(`ALTER TABLE orders DROP INDEX idx_orders_is_deleted`);
      console.log("Dropped idx_orders_is_deleted");
    }

    await pool.query(`ALTER TABLE orders DROP COLUMN is_deleted`);
    console.log("Dropped is_deleted column");
  } else {
    console.log("is_deleted column not present — skipped");
  }

  const updatedType = await getStatusColumnType(pool);
  console.log("Current orders.status:", updatedType);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
