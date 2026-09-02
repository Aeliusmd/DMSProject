require("dotenv").config();
const mysql = require("mysql2/promise");
const config = require("../src/config");

async function main() {
  const conn = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  });

  const email = "chamodyaagra2000@gmail.com";

  const [emps] = await conn.query(
    `SELECT id, name, email FROM matrix_employees
     WHERE LOWER(email) = LOWER(?)
     LIMIT 5`,
    [email]
  );
  console.log("EMPLOYEES:", JSON.stringify(emps, null, 2));

  const [orders] = await conn.query(
    `SELECT o.id, o.order_number, o.facility_id, o.creation_source, o.created_at,
            o.status, o.facility_mismatch, o.extracted_facility_id,
            f.facility_name, me.email AS created_by_email, me.name AS created_by_name
     FROM orders o
     LEFT JOIN facilities f ON f.id = o.facility_id
     LEFT JOIN matrix_employees me ON me.id = o.created_by
     WHERE o.creation_source = 'auto'
       AND (me.email = ? OR o.id = 75)
     ORDER BY o.id DESC
     LIMIT 10`,
    [email]
  );
  console.log("ORDERS:", JSON.stringify(orders, null, 2));

  const [extracts] = await conn.query(
    `SELECT e.id, e.order_id, e.customer, e.is_processed, e.parent_id, e.created_at
     FROM batch_scan_extracts e
     ORDER BY e.id DESC
     LIMIT 10`
  );
  console.log("EXTRACTS:", JSON.stringify(extracts, null, 2));

  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
