require("dotenv").config();

const { connectDatabase, getPool } = require("../src/config/database");

async function hasIndex(pool, table, keyName) {
  const [rows] = await pool.query(
    `SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`,
    [keyName]
  );
  return rows.length > 0;
}

async function hasColumn(pool, table, column) {
  const [rows] = await pool.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [
    column,
  ]);
  return rows.length > 0;
}

async function tableExists(pool, table) {
  const [rows] = await pool.query(`SHOW TABLES LIKE ?`, [table]);
  return rows.length > 0;
}

async function hasConstraint(pool, table, constraintName) {
  const [rows] = await pool.query(
    `SELECT CONSTRAINT_NAME
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?`,
    [table, constraintName]
  );
  return rows.length > 0;
}

async function run() {
  await connectDatabase();
  const pool = getPool();

  if (!(await hasColumn(pool, "order_records", "original_file_name"))) {
    await pool.query(`
      ALTER TABLE order_records
        ADD COLUMN original_file_name VARCHAR(255) NULL
        COMMENT 'Original PDF filename'
        AFTER storage_path
    `);
    console.log("Added order_records.original_file_name");
  } else {
    console.log("order_records.original_file_name already exists");
  }

  if (
    (await tableExists(pool, "order_record_files")) &&
    (await hasConstraint(
      pool,
      "order_record_files",
      "fk_order_record_files_order_type"
    ))
  ) {
    await pool.query(
      "ALTER TABLE order_record_files DROP FOREIGN KEY fk_order_record_files_order_type"
    );
    console.log("Dropped fk_order_record_files_order_type");
  }

  if (await hasIndex(pool, "order_records", "uq_order_records_order_type")) {
    await pool.query(
      "ALTER TABLE order_records DROP INDEX uq_order_records_order_type"
    );
    console.log("Dropped UNIQUE uq_order_records_order_type");
  } else {
    console.log("UNIQUE uq_order_records_order_type already dropped");
  }

  if (!(await hasIndex(pool, "order_records", "idx_order_records_order_type"))) {
    await pool.query(
      "ALTER TABLE order_records ADD INDEX idx_order_records_order_type (order_id, record_type)"
    );
    console.log("Added idx_order_records_order_type");
  } else {
    console.log("idx_order_records_order_type already exists");
  }

  await pool.query(`
    UPDATE order_records
    SET original_file_name = COALESCE(
      NULLIF(SUBSTRING_INDEX(REPLACE(storage_path, '\\\\', '/'), '/', -1), ''),
      NULL
    )
    WHERE storage_path IS NOT NULL
      AND TRIM(storage_path) <> ''
      AND (original_file_name IS NULL OR original_file_name = '')
  `);

  await pool.end();
  console.log("Multiple records-per-type migration complete");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
