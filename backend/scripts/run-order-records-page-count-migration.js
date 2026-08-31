/**
 * Adds order_records.page_count and backfills counts from existing PDFs.
 * Usage: node scripts/run-order-records-page-count-migration.js
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { ORDER_UPLOADS_ROOT } = require("../src/middleware/uploadMiddleware");
const { getPdfPageCount } = require("../src/utils/pdfSplit");
const { toStoredPageCount } = require("../src/utils/orderRecordPageCount");

function resolveStorageAbsolutePath(storagePath) {
  const normalized = String(storagePath || "").replace(/\\/g, "/");
  if (!normalized) return null;
  return path.join(ORDER_UPLOADS_ROOT, normalized);
}

async function backfillPageCounts(connection) {
  const [rows] = await connection.query(
    `SELECT id, storage_path
     FROM order_records
     WHERE storage_path IS NOT NULL
       AND TRIM(storage_path) <> ''
       AND page_count IS NULL`
  );

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const absolutePath = resolveStorageAbsolutePath(row.storage_path);
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      skipped += 1;
      continue;
    }

    try {
      const buffer = await fs.promises.readFile(absolutePath);
      const pageCount = toStoredPageCount(await getPdfPageCount(buffer));
      await connection.execute(
        `UPDATE order_records SET page_count = :pageCount WHERE id = :id`,
        { id: row.id, pageCount }
      );
      updated += 1;
    } catch {
      skipped += 1;
    }
  }

  console.log(`Backfill complete. Updated ${updated}, skipped ${skipped}.`);
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "dms_db",
    multipleStatements: true,
    namedPlaceholders: true,
  });

  try {
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'order_records'
         AND COLUMN_NAME = 'page_count'`,
      [process.env.DB_NAME || "dms_db"]
    );

    if (!columns.length) {
      const sql = fs.readFileSync(
        path.join(__dirname, "..", "migrations", "add_order_records_page_count.sql"),
        "utf8"
      );
      await connection.query(sql);
      console.log("Added order_records.page_count column.");
    } else {
      console.log("order_records.page_count already exists.");
    }

    await backfillPageCounts(connection);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
