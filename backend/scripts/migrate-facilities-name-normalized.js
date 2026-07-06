require("dotenv").config();

const mysql = require("mysql2/promise");
const config = require("../src/config");
const { normalizeFacilityName } = require("../src/utils/facilityNameUtils");

async function columnExists(connection, columnName) {
  const [rows] = await connection.execute(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'facilities'
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [config.db.database, columnName]
  );

  return rows.length > 0;
}

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  if (!(await columnExists(connection, "name_normalized"))) {
    const sql = require("fs").readFileSync(
      require("path").join(__dirname, "../migrations/add_facilities_name_normalized.sql"),
      "utf8"
    );
    await connection.query(sql);
    console.log("Added name_normalized column");
  } else {
    console.log("name_normalized column already exists");
  }

  const [facilities] = await connection.execute(
    `SELECT id, facility_name
     FROM facilities
     WHERE name_normalized IS NULL OR name_normalized = ''`
  );

  for (const facility of facilities) {
    await connection.execute(
      `UPDATE facilities
       SET name_normalized = :normalized
       WHERE id = :id`,
      {
        id: facility.id,
        normalized: normalizeFacilityName(facility.facility_name),
      }
    );
  }

  console.log(`Backfilled name_normalized for ${facilities.length} facilities`);

  await connection.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
