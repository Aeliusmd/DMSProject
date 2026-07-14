require("dotenv").config();
const mysql = require("mysql2/promise");

(async () => {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [orders] = await c.execute(
    `SELECT id, order_number, creation_source, created_at
     FROM orders
     WHERE creation_source = 'personal_portal'
     ORDER BY id DESC
     LIMIT 15`
  );

  const [personal] = await c.execute(
    `SELECT id, confirmation_reference, order_id, processing_fee_paid, portal_status, created_at, updated_at
     FROM personal_request_orders
     ORDER BY id DESC
     LIMIT 15`
  );

  console.log("=== orders WHERE creation_source=personal_portal ===");
  console.table(orders);
  console.log("=== personal_request_orders (latest) ===");
  console.table(personal);

  await c.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
