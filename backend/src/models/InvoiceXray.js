const { getPool } = require("../config/database");

class InvoiceXray {
  static async findByOrderId(orderId, connection = null) {
    const db = connection || getPool();

    const [rows] = await db.execute(
      `SELECT *
       FROM invoice_xray_details
       WHERE order_id = :orderId
       LIMIT 1`,
      { orderId }
    );

    return rows[0] || null;
  }

  static async findByOrderIds(orderIds = []) {
    if (!orderIds.length) return {};

    const pool = getPool();
    const placeholders = orderIds.map((_, index) => `:orderId${index}`).join(", ");
    const params = orderIds.reduce((acc, id, index) => {
      acc[`orderId${index}`] = id;
      return acc;
    }, {});

    const [rows] = await pool.execute(
      `SELECT *
       FROM invoice_xray_details
       WHERE order_id IN (${placeholders})`,
      params
    );

    return rows.reduce((acc, row) => {
      acc[row.order_id] = row;
      return acc;
    }, {});
  }

  static async upsert(connection, orderId, data) {
    const db = connection || getPool();

    await db.execute(
      `INSERT INTO invoice_xray_details (
         order_id, xray_invoice_date, exam_date,
         view_count, per_view_amount, payment,
         check_number, description,
         created_at, updated_at
       ) VALUES (
         :orderId, :xrayInvoiceDate, :examDate,
         :viewCount, :perViewAmount, :payment,
         :checkNumber, :description,
         NOW(), NOW()
       )
       ON DUPLICATE KEY UPDATE
         xray_invoice_date = VALUES(xray_invoice_date),
         exam_date = VALUES(exam_date),
         view_count = VALUES(view_count),
         per_view_amount = VALUES(per_view_amount),
         payment = VALUES(payment),
         check_number = VALUES(check_number),
         description = VALUES(description),
         updated_at = NOW()`,
      {
        orderId,
        xrayInvoiceDate: data.xrayInvoiceDate,
        examDate: data.examDate,
        viewCount: data.viewCount,
        perViewAmount: data.perViewAmount,
        payment: data.payment,
        checkNumber: data.checkNumber,
        description: data.description,
      }
    );
  }
}

module.exports = InvoiceXray;
