require("dotenv").config();

const mysql = require("mysql2/promise");
const config = require("../src/config");

const ORDER_ID_EXPR = `CAST(
  NULLIF(TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(al.details, 'order_id:', -1), ' |', 1)), '')
  AS UNSIGNED
)`;

async function main() {
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    multipleStatements: true,
  });

  console.log("Backfilling employee_order_milestone_events from activity_logs...");

  await connection.query(`
    INSERT IGNORE INTO employee_order_milestone_events
      (employee_id, order_id, metric_type, event_date)
    SELECT performed_by, order_id, 'created', log_date
    FROM (
      SELECT al.performed_by, ${ORDER_ID_EXPR} AS order_id, al.log_date
      FROM activity_logs al
      WHERE al.performed_by IS NOT NULL
        AND al.module = 'Orders'
        AND al.action = 'Order Created'
        AND al.details LIKE '%order_id:%'
    ) src
    WHERE order_id IS NOT NULL AND order_id > 0
  `);

  await connection.query(`
    INSERT IGNORE INTO employee_order_milestone_events
      (employee_id, order_id, metric_type, event_date)
    SELECT performed_by, order_id, 'updated', log_date
    FROM (
      SELECT al.performed_by, ${ORDER_ID_EXPR} AS order_id, al.log_date
      FROM activity_logs al
      WHERE al.performed_by IS NOT NULL
        AND al.module = 'Orders'
        AND al.action = 'Order Updated'
        AND al.details LIKE '%order_id:%'
    ) src
    WHERE order_id IS NOT NULL AND order_id > 0
  `);

  await connection.query(`
    INSERT IGNORE INTO employee_order_milestone_events
      (employee_id, order_id, metric_type, event_date)
    SELECT performed_by, order_id, 'completed', log_date
    FROM (
      SELECT al.performed_by, ${ORDER_ID_EXPR} AS order_id, al.log_date
      FROM activity_logs al
      WHERE al.performed_by IS NOT NULL
        AND al.module = 'Orders'
        AND al.action IN ('Records Ready Email Sent', 'Order Pickup Recorded')
        AND al.details LIKE '%order_id:%'
      UNION ALL
      SELECT al.performed_by, ${ORDER_ID_EXPR} AS order_id, al.log_date
      FROM activity_logs al
      WHERE al.performed_by IS NOT NULL
        AND al.module = 'Billing'
        AND al.action = 'Invoice Written Off'
        AND al.details LIKE '%Status: Completed%'
        AND al.details LIKE '%order_id:%'
    ) src
    WHERE order_id IS NOT NULL AND order_id > 0
  `);

  await connection.query(`
    INSERT IGNORE INTO employee_order_milestone_events
      (employee_id, order_id, metric_type, event_date)
    SELECT performed_by, order_id, 'cancelled', log_date
    FROM (
      SELECT al.performed_by, ${ORDER_ID_EXPR} AS order_id, al.log_date
      FROM activity_logs al
      WHERE al.performed_by IS NOT NULL
        AND al.module = 'Orders'
        AND al.action = 'Order Cancelled'
        AND al.details LIKE '%order_id:%'
    ) src
    WHERE order_id IS NOT NULL AND order_id > 0
  `);

  await connection.query(`
    INSERT IGNORE INTO employee_order_milestone_events
      (employee_id, order_id, metric_type, event_date)
    SELECT performed_by, order_id, 'deleted', log_date
    FROM (
      SELECT al.performed_by, ${ORDER_ID_EXPR} AS order_id, al.log_date
      FROM activity_logs al
      WHERE al.performed_by IS NOT NULL
        AND al.module = 'Orders'
        AND al.action = 'Order Deleted'
        AND al.details LIKE '%order_id:%'
    ) src
    WHERE order_id IS NOT NULL AND order_id > 0
  `);

  console.log("Backfilling from orders.created_by / cancelled_by / deleted_by...");

  await connection.query(`
    INSERT IGNORE INTO employee_order_milestone_events
      (employee_id, order_id, metric_type, event_date)
    SELECT created_by, id, 'created', DATE(created_at)
    FROM orders
    WHERE created_by IS NOT NULL
  `);

  await connection.query(`
    INSERT IGNORE INTO employee_order_milestone_events
      (employee_id, order_id, metric_type, event_date)
    SELECT cancelled_by, id, 'cancelled', DATE(cancelled_at)
    FROM orders
    WHERE cancelled_by IS NOT NULL
      AND cancelled_at IS NOT NULL
  `);

  await connection.query(`
    INSERT IGNORE INTO employee_order_milestone_events
      (employee_id, order_id, metric_type, event_date)
    SELECT deleted_by, id, 'deleted', DATE(deleted_at)
    FROM orders
    WHERE deleted_by IS NOT NULL
      AND deleted_at IS NOT NULL
  `);

  const [rows] = await connection.execute(
    "SELECT COUNT(*) AS total FROM employee_order_milestone_events"
  );

  console.log(`Backfill complete. Total milestone event rows: ${rows[0]?.total || 0}`);

  await connection.end();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
