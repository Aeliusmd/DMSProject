const { getPool } = require("../config/database");

const INVOICE_SELECT = `
  SELECT i.*,
         o.order_number,
         o.applicant_first_name,
         o.applicant_middle_name,
         o.applicant_last_name,
         f.facility_name,
         f.email AS facility_email,
         p.email AS provider_email,
         p.company_name AS provider_name
  FROM invoices i
  INNER JOIN orders o ON o.id = i.order_id
  INNER JOIN facilities f ON f.id = i.facility_id
  LEFT JOIN providers p ON p.id = o.provider_id`;

class Invoice {
  static async findById(id) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `${INVOICE_SELECT}
       WHERE i.id = :id
       LIMIT 1`,
      { id }
    );

    return rows[0] || null;
  }

  static async findByOrderId(orderId) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `${INVOICE_SELECT}
       WHERE i.order_id = :orderId
       ORDER BY i.id DESC
       LIMIT 1`,
      { orderId }
    );

    return rows[0] || null;
  }

  static async findByOrderIds(orderIds = []) {
    if (!orderIds.length) return [];

    const pool = getPool();
    const placeholders = orderIds.map((_, index) => `:orderId${index}`).join(", ");
    const params = orderIds.reduce((acc, id, index) => {
      acc[`orderId${index}`] = id;
      return acc;
    }, {});

    const [rows] = await pool.execute(
      `${INVOICE_SELECT}
       WHERE i.order_id IN (${placeholders})
       ORDER BY i.id DESC`,
      params
    );

    const byOrderId = {};
    rows.forEach((row) => {
      if (!byOrderId[row.order_id]) {
        byOrderId[row.order_id] = row;
      }
    });

    return byOrderId;
  }

  static async findOutstanding(filters = {}) {
    const pool = getPool();
    const conditions = ["i.status NOT IN ('Paid', 'Needs Resend')"];
    const params = {};

    if (filters.dateFrom) {
      conditions.push("i.invoice_date >= :dateFrom");
      params.dateFrom = filters.dateFrom;
    }

    if (filters.dateTo) {
      conditions.push("i.invoice_date <= :dateTo");
      params.dateTo = filters.dateTo;
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [rows] = await pool.execute(
      `${INVOICE_SELECT}
       ${whereClause}
       ORDER BY f.facility_name ASC, i.invoice_date ASC, o.order_number ASC`,
      params
    );

    return rows;
  }

  static async findResend(filters = {}) {
    const pool = getPool();
    const conditions = ["i.status = 'Needs Resend'"];
    const params = {};

    if (filters.dateFrom) {
      conditions.push("i.invoice_date >= :dateFrom");
      params.dateFrom = filters.dateFrom;
    }

    if (filters.dateTo) {
      conditions.push("i.invoice_date <= :dateTo");
      params.dateTo = filters.dateTo;
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [rows] = await pool.execute(
      `${INVOICE_SELECT}
       ${whereClause}
       ORDER BY i.invoice_date ASC, f.facility_name ASC`,
      params
    );

    return rows;
  }

  static async findByFacilityId(facilityId, filters = {}) {
    const pool = getPool();
    const conditions = [
      "i.facility_id = :facilityId",
      "i.status NOT IN ('Paid', 'Needs Resend')",
    ];
    const params = { facilityId };

    if (filters.dateFrom) {
      conditions.push("i.invoice_date >= :dateFrom");
      params.dateFrom = filters.dateFrom;
    }

    if (filters.dateTo) {
      conditions.push("i.invoice_date <= :dateTo");
      params.dateTo = filters.dateTo;
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const [rows] = await pool.execute(
      `${INVOICE_SELECT}
       ${whereClause}
       ORDER BY i.invoice_date DESC, o.order_number ASC`,
      params
    );

    return rows;
  }

  static async create(connection, data) {
    const db = connection || getPool();

    const [result] = await db.execute(
      `INSERT INTO invoices (
         invoice_number, order_id, facility_id, status,
         invoice_date, service_date, sent_date,
         served_amount, service_fee, custodian_fee, xray_fee,
         mileage, parking, other_fee,
         page_count, per_page_amount, total_amount, amount_paid, amount_due,
         notes, send_order_details, is_rush_order, recipient_emails, created_by,
         created_at, updated_at
       ) VALUES (
         :invoiceNumber, :orderId, :facilityId, :status,
         :invoiceDate, :serviceDate, :sentDate,
         :servedAmount, :serviceFee, :custodianFee, :xrayFee,
         :mileage, :parking, :otherFee,
         :pageCount, :perPageAmount, :totalAmount, :amountPaid, :amountDue,
         :notes, :sendOrderDetails, :isRushOrder, :recipientEmails, :createdBy,
         NOW(), NOW()
       )`,
      data
    );

    return result.insertId;
  }

  static async update(connection, id, data) {
    const db = connection || getPool();

    await db.execute(
      `UPDATE invoices SET
         status = :status,
         invoice_date = :invoiceDate,
         service_date = :serviceDate,
         sent_date = :sentDate,
         served_amount = :servedAmount,
         service_fee = :serviceFee,
         custodian_fee = :custodianFee,
         xray_fee = :xrayFee,
         mileage = :mileage,
         parking = :parking,
         other_fee = :otherFee,
         page_count = :pageCount,
         per_page_amount = :perPageAmount,
         total_amount = :totalAmount,
         amount_paid = :amountPaid,
         amount_due = :amountDue,
         notes = :notes,
         send_order_details = :sendOrderDetails,
         is_rush_order = :isRushOrder,
         recipient_emails = :recipientEmails,
         updated_at = NOW()
       WHERE id = :id`,
      { ...data, id }
    );
  }

  static async findByIds(ids = []) {
    if (!ids.length) return [];

    const pool = getPool();
    const placeholders = ids.map((_, index) => `:id${index}`).join(", ");
    const params = ids.reduce((acc, id, index) => {
      acc[`id${index}`] = id;
      return acc;
    }, {});

    const [rows] = await pool.execute(
      `SELECT id, sent_date, status, amount_due
       FROM invoices
       WHERE id IN (${placeholders})`,
      params
    );

    return rows;
  }

  static async writeOff(connection, id, data) {
    const db = connection || getPool();

    await db.execute(
      `UPDATE invoices SET
         status = :status,
         amount_due = :amountDue,
         writeoff_amount = :writeoffAmount,
         writeoff_date = CURDATE(),
         writeoff_by = :writeoffBy,
         writeoff_reason = :writeoffReason,
         updated_at = NOW()
       WHERE id = :id`,
      { ...data, id }
    );
  }

  static async markAsSent(ids = []) {
    if (!ids.length) return 0;

    const pool = getPool();
    const placeholders = ids.map((_, index) => `:id${index}`).join(", ");
    const params = ids.reduce((acc, id, index) => {
      acc[`id${index}`] = id;
      return acc;
    }, {});

    const [result] = await pool.execute(
      `UPDATE invoices
       SET sent_date = CURDATE(),
           status = 'Needs Resend',
           updated_at = NOW()
       WHERE id IN (${placeholders})
         AND sent_date IS NULL`,
      params
    );

    return result.affectedRows || 0;
  }

  static async markAsResent(ids = []) {
    if (!ids.length) return 0;

    const pool = getPool();
    const placeholders = ids.map((_, index) => `:id${index}`).join(", ");
    const params = ids.reduce((acc, id, index) => {
      acc[`id${index}`] = id;
      return acc;
    }, {});

    const [result] = await pool.execute(
      `UPDATE invoices
       SET sent_date = CURDATE(), updated_at = NOW()
       WHERE id IN (${placeholders})
         AND status = 'Needs Resend'`,
      params
    );

    return result.affectedRows || 0;
  }
}

module.exports = Invoice;
