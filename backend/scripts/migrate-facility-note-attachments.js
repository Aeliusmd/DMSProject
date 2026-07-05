require("dotenv").config();

const mysql = require("mysql2/promise");
const config = require("../src/config");

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  const [tables] = await connection.execute(
    `SELECT TABLE_NAME
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = 'facility_note_attachments'`,
    [config.db.database]
  );

  if (tables.length) {
    console.log("facility_note_attachments already exists — no migration needed");
  } else {
    await connection.execute(`
      CREATE TABLE facility_note_attachments (
        id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        facility_note_id  BIGINT UNSIGNED NOT NULL,
        storage_path      VARCHAR(500)    NOT NULL,
        original_filename VARCHAR(255)    NOT NULL,
        mime_type         VARCHAR(100)    NULL,
        file_size_bytes   INT UNSIGNED    NULL,
        created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_facility_note_attachments_note (facility_note_id),
        CONSTRAINT fk_facility_note_attachments_note
          FOREIGN KEY (facility_note_id) REFERENCES facility_notes (id) ON DELETE CASCADE
      )
    `);
    console.log("Created facility_note_attachments table");
  }

  await connection.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
