const { getPool } = require("../config/database");

const ORDER_VISIBLE = "o.status NOT IN ('Cancelled', 'Deleted')";

const XRAY_INVOICE_SELECT = `
  SELECT x.*,
         o.order_number,
         o.case_number,
         o.defendant,
         (SELECT GROUP_CONCAT(
            r.record_type
            ORDER BY FIELD(r.record_type, 'medical', 'billing', 'employment', 'xrays', 'other')
            SEPARATOR ','
          )
          FROM order_records r
          WHERE r.order_id = o.id) AS order_record_types,
         o.subpoena_date,
         o.created_at AS order_created_at,
         o.serve_company_name,
         o.serve_email,
         o.applicant_first_name,
         o.applicant_middle_name,
         o.applicant_last_name,
         o.facility_id,
         f.facility_name,
         f.email AS facility_email,
         p.email AS provider_email,
         p.company_name AS provider_name
  FROM invoice_xray_details x
  INNER JOIN orders o ON o.id = x.order_id
  INNER JOIN facilities f ON f.id = o.facility_id
  LEFT JOIN providers p ON p.id = o.provider_id`;

class InvoiceXray {
  static async findByOrderId(orderId, connection = null) {
    const db = connection || getPool();

    const [rows] = await db.execute(
      `${XRAY_INVOICE_SELECT}
       WHERE x.order_id = :orderId AND ${ORDER_VISIBLE}
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

  static async findOutstanding(filters = {}) {
    const pool = getPool();
    const conditions = [ORDER_VISIBLE, "x.sent_date IS NULL"];
    const params = {};

    if (filters.dateFrom) {
      conditions.push("x.xray_invoice_date >= :dateFrom");
      params.dateFrom = filters.dateFrom;
    }

    if (filters.dateTo) {
      conditions.push("x.xray_invoice_date <= :dateTo");
      params.dateTo = filters.dateTo;
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [rows] = await pool.execute(
      `${XRAY_INVOICE_SELECT}
       ${whereClause}
       ORDER BY f.facility_name ASC, x.xray_invoice_date ASC, o.order_number ASC`,
      params
    );

    return rows;
  }

  static async findByFacilityId(facilityId, filters = {}) {
    const pool = getPool();
    const conditions = [
      ORDER_VISIBLE,
      "o.facility_id = :facilityId",
      "x.sent_date IS NULL",
    ];
    const params = { facilityId };

    if (filters.dateFrom) {
      conditions.push("x.xray_invoice_date >= :dateFrom");
      params.dateFrom = filters.dateFrom;
    }

    if (filters.dateTo) {
      conditions.push("x.xray_invoice_date <= :dateTo");
      params.dateTo = filters.dateTo;
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [rows] = await pool.execute(
      `${XRAY_INVOICE_SELECT}
       ${whereClause}
       ORDER BY x.xray_invoice_date DESC, o.order_number ASC`,
      params
    );

    return rows;
  }

  static async findResendByFacilityId(facilityId, filters = {}) {
    const pool = getPool();
    const conditions = [
      ORDER_VISIBLE,
      "o.facility_id = :facilityId",
      "x.sent_date IS NOT NULL",
    ];
    const params = { facilityId };

    if (filters.dateFrom) {
      conditions.push("x.xray_invoice_date >= :dateFrom");
      params.dateFrom = filters.dateFrom;
    }

    if (filters.dateTo) {
      conditions.push("x.xray_invoice_date <= :dateTo");
      params.dateTo = filters.dateTo;
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [rows] = await pool.execute(
      `${XRAY_INVOICE_SELECT}
       ${whereClause}
       ORDER BY x.xray_invoice_date DESC, o.order_number ASC`,
      params
    );

    return rows;
  }

  static async findResend(filters = {}) {
    const pool = getPool();
    const conditions = [ORDER_VISIBLE, "x.sent_date IS NOT NULL"];
    const params = {};

    if (filters.dateFrom) {
      conditions.push("x.xray_invoice_date >= :dateFrom");
      params.dateFrom = filters.dateFrom;
    }

    if (filters.dateTo) {
      conditions.push("x.xray_invoice_date <= :dateTo");
      params.dateTo = filters.dateTo;
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [rows] = await pool.execute(
      `${XRAY_INVOICE_SELECT}
       ${whereClause}
       ORDER BY x.xray_invoice_date ASC, f.facility_name ASC`,
      params
    );

    return rows;
  }

  static async findByOrderIdsWithDetails(orderIds = []) {
    if (!orderIds.length) return [];

    const pool = getPool();
    const placeholders = orderIds.map((_, index) => `:orderId${index}`).join(", ");
    const params = orderIds.reduce((acc, id, index) => {
      acc[`orderId${index}`] = id;
      return acc;
    }, {});

    const [rows] = await pool.execute(
      `${XRAY_INVOICE_SELECT}
       WHERE x.order_id IN (${placeholders}) AND ${ORDER_VISIBLE}`,
      params
    );

    return rows;
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

  static async markAsSent(orderId, connection = null) {
    const db = connection || getPool();

    const [result] = await db.execute(
      `UPDATE invoice_xray_details
       SET sent_date = CURDATE(), updated_at = NOW()
       WHERE order_id = :orderId
         AND sent_date IS NULL`,
      { orderId }
    );

    return result.affectedRows;
  }
}

module.exports = InvoiceXray;
