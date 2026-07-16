/**
 * Remove LT-prefixed load-test rows from dms_db_backup only.
 *
 * Usage: node scripts/cleanup-load-test-data.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const mysql = require("mysql2/promise");

const ALLOWED_DB = "dms_db_backup";

async function assertSafeDatabase(connection) {
  const [[row]] = await connection.query("SELECT DATABASE() AS db");
  const dbName = row?.db || "";
  if (dbName !== ALLOWED_DB) {
    throw new Error(
      `Refusing to cleanup. Connected to "${dbName}" but only "${ALLOWED_DB}" is allowed.`
    );
  }
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
  });

  try {
    await assertSafeDatabase(connection);
    await connection.beginTransaction();

    const [orderRows] = await connection.query(
      `SELECT id FROM orders WHERE order_number LIKE 'LT-%'`
    );
    const orderIds = orderRows.map((row) => row.id);
    console.log(`Found ${orderIds.length} LT- orders`);

    if (orderIds.length) {
      const placeholders = orderIds.map(() => "?").join(",");

      await connection.query(
        `DELETE FROM invoices WHERE order_id IN (${placeholders})`,
        orderIds
      );
      await connection.query(
        `DELETE FROM order_payments WHERE order_id IN (${placeholders})`,
        orderIds
      );
      await connection.query(
        `DELETE FROM order_workflow_stages WHERE order_id IN (${placeholders})`,
        orderIds
      );
      await connection.query(
        `DELETE FROM order_records WHERE order_id IN (${placeholders})`,
        orderIds
      );
      await connection.query(
        `DELETE FROM order_notes WHERE order_id IN (${placeholders})`,
        orderIds
      );
      await connection.query(
        `DELETE FROM order_activity_logs WHERE order_id IN (${placeholders})`,
        orderIds
      );
      try {
        await connection.query(
          `DELETE FROM invoice_xray_details WHERE order_id IN (${placeholders})`,
          orderIds
        );
      } catch (_error) {
        // optional table
      }
      await connection.query(
        `DELETE FROM orders WHERE id IN (${placeholders})`,
        orderIds
      );
    }

    const [facIds] = await connection.query(
      `SELECT id FROM facilities WHERE facility_name LIKE 'LT Facility %' OR user_name LIKE 'lt_user_%'`
    );
    const facilityIds = facIds.map((row) => row.id);
    if (facilityIds.length) {
      const fph = facilityIds.map(() => "?").join(",");
      try {
        await connection.query(
          `DELETE FROM facility_doctors WHERE facility_id IN (${fph})`,
          facilityIds
        );
        await connection.query(
          `DELETE FROM facility_notes WHERE facility_id IN (${fph})`,
          facilityIds
        );
        await connection.query(
          `DELETE FROM office_managers WHERE facility_id IN (${fph})`,
          facilityIds
        );
        await connection.query(
          `DELETE FROM facility_documents WHERE facility_id IN (${fph})`,
          facilityIds
        );
      } catch (_error) {
        // related tables may vary by migration state
      }
      await connection.query(
        `DELETE FROM facilities WHERE id IN (${fph})`,
        facilityIds
      );
    }

    const [provResult] = await connection.query(
      `DELETE FROM providers WHERE company_name LIKE 'LT Provider %'`
    );

    await connection.commit();
    console.log(
      `Cleanup complete. facilities_removed=${facilityIds.length}, providers_removed=${provResult.affectedRows}`
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error("Cleanup failed:", error.message);
  process.exit(1);
});
