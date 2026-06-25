require("dotenv").config();

const { connectDatabase, getPool } = require("../src/config/database");
const invoiceService = require("../src/services/invoiceService");

async function main() {
  await connectDatabase();
  const pool = getPool();

  const [invoices] = await pool.execute(
    `SELECT id, order_id, facility_id, invoice_type, status, amount_due, total_amount
     FROM invoices ORDER BY id DESC LIMIT 5`
  );
  console.log("invoices:", invoices);

  const [joined] = await pool.execute(
    `SELECT i.id, i.invoice_type, i.status, f.facility_name, o.order_number
     FROM invoices i
     INNER JOIN orders o ON o.id = i.order_id
     INNER JOIN facilities f ON f.id = i.facility_id
     ORDER BY i.id DESC LIMIT 5`
  );
  console.log("joined:", joined);

  const outstanding = await invoiceService.getOutstandingInvoices({});
  console.log("outstanding:", JSON.stringify(outstanding, null, 2));

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
