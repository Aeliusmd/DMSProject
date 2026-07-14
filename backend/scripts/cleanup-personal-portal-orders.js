require("dotenv").config();
const mysql = require("mysql2/promise");

/**
 * Removes leftover staff orders created by the old personal-portal flow
 * (creation_source = 'personal_portal'). Does not touch personal_request_* tables.
 */
(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: false,
  });

  try {
    await c.beginTransaction();

    const [targets] = await c.execute(
      `SELECT id, order_number FROM orders WHERE creation_source = 'personal_portal'`
    );

    if (!targets.length) {
      console.log("No personal_portal rows in orders. Nothing to clean.");
      await c.commit();
      await c.end();
      return;
    }

    console.log("Removing leftover personal_portal orders:", targets);

    for (const row of targets) {
      const orderId = row.id;

      // Unlink personal requests if any still point here
      await c.execute(
        `UPDATE personal_request_orders SET order_id = NULL WHERE order_id = ?`,
        [orderId]
      );

      // Clear optional payment mirror
      try {
        await c.execute(`DELETE FROM stripe_online_payments WHERE order_id = ?`, [
          orderId,
        ]);
      } catch (_) {
        /* table may not exist / FK differ */
      }

      try {
        await c.execute(
          `DELETE FROM invoice_payment_access_tokens WHERE order_id = ?`,
          [orderId]
        );
      } catch (_) {}

      try {
        await c.execute(`DELETE FROM invoices WHERE order_id = ?`, [orderId]);
      } catch (_) {}

      try {
        await c.execute(`DELETE FROM invoice_xray_details WHERE order_id = ?`, [
          orderId,
        ]);
      } catch (_) {}

      try {
        await c.execute(`DELETE FROM order_payments WHERE order_id = ?`, [orderId]);
      } catch (_) {}

      try {
        await c.execute(`DELETE FROM order_workflow_stages WHERE order_id = ?`, [
          orderId,
        ]);
      } catch (_) {}

      try {
        await c.execute(`DELETE FROM order_records WHERE order_id = ?`, [orderId]);
      } catch (_) {}

      try {
        await c.execute(`DELETE FROM order_additional_documents WHERE order_id = ?`, [
          orderId,
        ]);
      } catch (_) {}

      try {
        await c.execute(`DELETE FROM order_notes WHERE order_id = ?`, [orderId]);
      } catch (_) {}

      await c.execute(`DELETE FROM orders WHERE id = ?`, [orderId]);
      console.log(`Deleted orders.id=${orderId} (${row.order_number})`);
    }

    await c.commit();
    console.log("Cleanup complete.");
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
