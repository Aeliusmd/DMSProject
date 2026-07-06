/**
 * Order model — DMS order records.
 */

const { getPool } = require("../config/database");
const { RUSH_READY_MIN_DAYS, ORDER_AGE_SQL_ALIAS } = require("../utils/rushUtils");

const REQUIRED_WORKFLOW_COMPLETION = {
  "Review Records": "complete",
  Serve: "complete",
  Custodian: "complete",
  SENT: "sent",
};

const WORKFLOW_AUTO_COMPLETE_EXCLUDED_STATUSES = new Set([
  "Cancelled",
  "Deleted",
  "Completed",
  "Ready to Pickup",
  "Write Offs",
]);

const INACTIVE_ORDER_STATUSES = ["Cancelled", "Deleted"];
const ACTIVE_ORDER = `(status NOT IN ('Cancelled', 'Deleted'))`;
const ACTIVE_ORDER_ALIAS = `(o.status NOT IN ('Cancelled', 'Deleted'))`;
const ORDER_COLUMNS = `
  order_number, rec_number, facility_id, provider_id, status, court,
  case_number, order_ref, ssn_last_four, dob,
  applicant_first_name, applicant_middle_name, applicant_last_name,
  applicant_aka, defendant, injury_type, injury_date, injury_date_begin, injury_date_end,
  serve_company_name, serve_address, serve_zip, serve_city, serve_state,
  serve_phone, serve_fax, serve_email,
  contact1_name, contact1_title, contact1_phone, contact1_fax, contact1_email,
  contact2_name, contact2_title, contact2_phone, contact2_fax, contact2_email,
  date_served, depo_due_date, delivery_date, subpoena_date, date_requested,
  ready_date, invoice_date, xray_invoice_date,
  specific_record, specific_doctor, specific_doctor_is_default, full_address,
  certificate_no_records, cnr_reason, cnr_delivery, cnr_date_sent, cnr_memo,
  subpoena_storage_path, has_note, has_subpoena, creation_source, created_by`;

const ORDER_VALUES = `
  :orderNumber, :recNumber, :facilityId, :providerId, :status, :court,
  :caseNumber, :orderRef, :ssnLastFour, :dob,
  :applicantFirstName, :applicantMiddleName, :applicantLastName,
  :applicantAka, :defendant, :injuryType, :injuryDate, :injuryDateBegin, :injuryDateEnd,
  :serveCompanyName, :serveAddress, :serveZip, :serveCity, :serveState,
  :servePhone, :serveFax, :serveEmail,
  :contact1Name, :contact1Title, :contact1Phone, :contact1Fax, :contact1Email,
  :contact2Name, :contact2Title, :contact2Phone, :contact2Fax, :contact2Email,
  :dateServed, :depoDueDate, :deliveryDate, :subpoenaDate, :dateRequested,
  :readyDate, :invoiceDate, :xrayInvoiceDate,
  :specificRecord, :specificDoctor, :specificDoctorIsDefault, :fullAddress,
  :certificateNoRecords, :cnrReason, :cnrDelivery, :cnrDateSent, :cnrMemo,
  :subpoenaStoragePath, :hasNote, :hasSubpoena, :creationSource, :createdBy`;

const ORDER_UPDATE_SET = `
  order_number = :orderNumber,
  rec_number = :recNumber,
  facility_id = :facilityId,
  provider_id = :providerId,
  court = :court,
  case_number = :caseNumber,
  order_ref = :orderRef,
  ssn_last_four = :ssnLastFour,
  dob = :dob,
  applicant_first_name = :applicantFirstName,
  applicant_middle_name = :applicantMiddleName,
  applicant_last_name = :applicantLastName,
  applicant_aka = :applicantAka,
  defendant = :defendant,
  injury_type = :injuryType,
  injury_date = :injuryDate,
  injury_date_begin = :injuryDateBegin,
  injury_date_end = :injuryDateEnd,
  serve_company_name = :serveCompanyName,
  serve_address = :serveAddress,
  serve_zip = :serveZip,
  serve_city = :serveCity,
  serve_state = :serveState,
  serve_phone = :servePhone,
  serve_fax = :serveFax,
  serve_email = :serveEmail,
  contact1_name = :contact1Name,
  contact1_title = :contact1Title,
  contact1_phone = :contact1Phone,
  contact1_fax = :contact1Fax,
  contact1_email = :contact1Email,
  contact2_name = :contact2Name,
  contact2_title = :contact2Title,
  contact2_phone = :contact2Phone,
  contact2_fax = :contact2Fax,
  contact2_email = :contact2Email,
  date_served = :dateServed,
  depo_due_date = :depoDueDate,
  delivery_date = :deliveryDate,
  subpoena_date = :subpoenaDate,
  date_requested = :dateRequested,
  ready_date = :readyDate,
  invoice_date = :invoiceDate,
  xray_invoice_date = :xrayInvoiceDate,
  specific_record = :specificRecord,
  specific_doctor = :specificDoctor,
  specific_doctor_is_default = :specificDoctorIsDefault,
  full_address = :fullAddress,
  certificate_no_records = :certificateNoRecords,
  cnr_reason = :cnrReason,
  cnr_delivery = :cnrDelivery,
  cnr_date_sent = :cnrDateSent,
  cnr_memo = :cnrMemo,
  subpoena_storage_path = :subpoenaStoragePath,
  has_subpoena = :hasSubpoena,
  creation_source = :creationSource,
  updated_at = NOW()`;

const ORDER_DETAIL_SELECT = `
  SELECT o.*, f.facility_name, f.slug AS facility_slug,
         f.address AS facility_address, f.city AS facility_city,
         f.state AS facility_state, f.zip_code AS facility_zip,
         p.company_name AS provider_name,
         p.email AS provider_email
  FROM orders o
  LEFT JOIN facilities f ON f.id = o.facility_id
  LEFT JOIN providers p ON p.id = o.provider_id`;

class Order {
  static async findAll(filters = {}) {
    const pool = getPool();

    const conditions = [];
    const params = {};

    if (filters.readyFilter) {
      conditions.push(`(
        o.status IN ('Ready', 'Ready to Pickup')
        OR (
          o.status = 'Active'
          AND DATEDIFF(CURDATE(), ${ORDER_AGE_SQL_ALIAS}) >= :rushReadyMinDays
        )
      )`);
      params.rushReadyMinDays = RUSH_READY_MIN_DAYS;
    } else if (filters.status) {
      conditions.push("o.status = :status");
      params.status = filters.status;
    } else if (filters.search) {
      conditions.push(`o.status <> 'Deleted'`);
    } else {
      conditions.push(ACTIVE_ORDER_ALIAS);
    }

    if (filters.facilityId) {
      conditions.push("o.facility_id = :facilityId");
      params.facilityId = filters.facilityId;
    }

    if (filters.company) {
      conditions.push(`(
        LOWER(TRIM(o.serve_company_name)) = LOWER(TRIM(:company))
        OR LOWER(TRIM(p.company_name)) = LOWER(TRIM(:company))
      )`);
      params.company = filters.company;
    }

    if (filters.year) {
      conditions.push(
        "YEAR(COALESCE(o.subpoena_date, o.created_at)) = :year"
      );
      params.year = Number(filters.year);
    }

    if (filters.periodFrom) {
      conditions.push("DATE(o.created_at) >= :periodFrom");
      params.periodFrom = filters.periodFrom;
    }

    if (filters.createdFrom) {
      conditions.push("DATE(o.created_at) >= :createdFrom");
      params.createdFrom = filters.createdFrom;
    }

    if (filters.createdTo) {
      conditions.push("DATE(o.created_at) <= :createdTo");
      params.createdTo = filters.createdTo;
    }

    if (filters.search) {
      conditions.push(`(
        o.order_number LIKE :search
        OR o.rec_number LIKE :search
        OR o.case_number LIKE :search
        OR o.order_ref LIKE :search
        OR o.court LIKE :search
        OR o.applicant_first_name LIKE :search
        OR o.applicant_middle_name LIKE :search
        OR o.applicant_last_name LIKE :search
        OR o.applicant_aka LIKE :search
        OR o.defendant LIKE :search
        OR o.serve_company_name LIKE :search
        OR o.serve_address LIKE :search
        OR o.serve_city LIKE :search
        OR o.serve_state LIKE :search
        OR o.serve_zip LIKE :search
        OR o.serve_phone LIKE :search
        OR o.serve_fax LIKE :search
        OR o.serve_email LIKE :search
        OR o.contact1_name LIKE :search
        OR o.contact1_title LIKE :search
        OR o.contact1_phone LIKE :search
        OR o.contact1_fax LIKE :search
        OR o.contact1_email LIKE :search
        OR o.contact2_name LIKE :search
        OR o.contact2_title LIKE :search
        OR o.contact2_phone LIKE :search
        OR o.contact2_fax LIKE :search
        OR o.contact2_email LIKE :search
        OR o.injury_type LIKE :search
        OR o.cancel_reason LIKE :search
        OR o.specific_doctor LIKE :search
        OR o.specific_record LIKE :search
        OR CAST(o.ssn_last_four AS CHAR) LIKE :search
        OR CAST(o.status AS CHAR) LIKE :search
        OR DATE_FORMAT(o.dob, '%m/%d/%Y') LIKE :search
        OR DATE_FORMAT(o.dob, '%Y-%m-%d') LIKE :search
        OR DATE_FORMAT(o.injury_date, '%m/%d/%Y') LIKE :search
        OR DATE_FORMAT(o.injury_date, '%Y-%m-%d') LIKE :search
        OR DATE_FORMAT(o.injury_date_begin, '%m/%d/%Y') LIKE :search
        OR DATE_FORMAT(o.injury_date_end, '%m/%d/%Y') LIKE :search
        OR f.facility_name LIKE :search
        OR f.address LIKE :search
        OR f.city LIKE :search
        OR f.state LIKE :search
        OR f.zip_code LIKE :search
        OR p.company_name LIKE :search
        OR CONCAT_WS(' ', o.applicant_first_name, o.applicant_middle_name, o.applicant_last_name) LIKE :search
      )`);
      params.search = `%${filters.search}%`;
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const limit =
      filters.limit && Number(filters.limit) > 0
        ? Math.min(Number(filters.limit), 500)
        : null;

    const [rows] = await pool.execute(
      `${ORDER_DETAIL_SELECT}
       ${whereClause}
       ORDER BY o.id DESC
       ${limit ? `LIMIT ${limit}` : ""}`,
      params
    );

    return rows;
  }

  static async findDistinctCompanyNames() {
    const pool = getPool();

    const [rows] = await pool.execute(`
      SELECT DISTINCT company_name
      FROM (
        SELECT TRIM(o.serve_company_name) AS company_name
        FROM orders o
        WHERE o.serve_company_name IS NOT NULL
          AND TRIM(o.serve_company_name) != ''
        UNION
        SELECT TRIM(p.company_name) AS company_name
        FROM orders o
        INNER JOIN providers p ON p.id = o.provider_id
        WHERE p.company_name IS NOT NULL
          AND TRIM(p.company_name) != ''
      ) AS companies
      WHERE company_name IS NOT NULL
        AND company_name != ''
      ORDER BY company_name ASC
    `);

    return rows.map((row) => row.company_name);
  }

  static async searchDoctors(query, limit = 10) {
    const pool = getPool();
    const trimmed = `${query || ""}`.trim();

    if (!trimmed) return [];

    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);

    const [rows] = await pool.execute(
      `SELECT DISTINCT TRIM(specific_doctor) AS name
       FROM orders
       WHERE specific_doctor IS NOT NULL
         AND TRIM(specific_doctor) <> ''
         AND specific_doctor LIKE :query
       ORDER BY name ASC
       LIMIT ${safeLimit}`,
      { query: `%${trimmed}%` }
    );

    return rows.map((row) => row.name).filter(Boolean);
  }

  static async searchDoctorAddresses(query, limit = 10) {
    const pool = getPool();
    const trimmed = `${query || ""}`.trim();

    if (!trimmed) return [];

    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);

    const [rows] = await pool.execute(
      `SELECT DISTINCT TRIM(full_address) AS address
       FROM orders
       WHERE full_address IS NOT NULL
         AND TRIM(full_address) <> ''
         AND full_address LIKE :query
       ORDER BY address ASC
       LIMIT ${safeLimit}`,
      { query: `%${trimmed}%` }
    );

    return rows.map((row) => row.address).filter(Boolean);
  }

  static async findForReport(filters = {}) {
    const pool = getPool();
    const conditions = [ACTIVE_ORDER_ALIAS];
    const params = {};

    if (filters.orderNo) {
      conditions.push("o.order_number LIKE :orderNo");
      params.orderNo = `%${filters.orderNo}%`;
    }

    if (filters.caseNumber) {
      conditions.push("o.case_number LIKE :caseNumber");
      params.caseNumber = `%${filters.caseNumber}%`;
    }

    if (filters.doctor) {
      conditions.push("o.specific_doctor LIKE :doctor");
      params.doctor = `%${filters.doctor}%`;
    }

    if (filters.dateFrom) {
      conditions.push("DATE(o.subpoena_date) >= :dateFrom");
      params.dateFrom = filters.dateFrom;
    }

    if (filters.dateTo) {
      conditions.push("DATE(o.subpoena_date) <= :dateTo");
      params.dateTo = filters.dateTo;
    }

    if (filters.unpaidOnly) {
      conditions.push("(i.id IS NULL OR COALESCE(i.total_amount, 0) <= 0)");
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [rows] = await pool.execute(
      `SELECT o.*, f.facility_name, f.slug AS facility_slug,
              p.company_name AS provider_name,
              i.id AS invoice_id,
              i.total_amount,
              i.amount_paid,
              i.amount_due,
              i.status AS invoice_status
       FROM orders o
       LEFT JOIN facilities f ON f.id = o.facility_id
       LEFT JOIN providers p ON p.id = o.provider_id
       LEFT JOIN invoices i ON i.id = (
         SELECT i2.id
         FROM invoices i2
         WHERE i2.order_id = o.id
         ORDER BY i2.id DESC
         LIMIT 1
       )
       ${whereClause}
       ORDER BY o.subpoena_date DESC, o.id DESC`,
      params
    );

    return rows;
  }

  static async countStats() {
    const pool = getPool();

    const [rows] = await pool.execute(`
      SELECT
        COUNT(*) AS total_orders,
        SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) AS active_cases,
        SUM(
          CASE
            WHEN status IN ('Ready', 'Ready to Pickup') THEN 1
            ELSE 0
          END
        ) AS ready_to_pickup,
        SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS completed
      FROM orders
      WHERE ${ACTIVE_ORDER}
    `);

    return rows[0] || {};
  }

  static async findById(id, connection = null) {
    const db = connection || getPool();

    const [rows] = await db.execute(
      `${ORDER_DETAIL_SELECT}
       WHERE o.id = :id AND ${ACTIVE_ORDER_ALIAS}
       LIMIT 1`,
      { id }
    );

    return rows[0] || null;
  }

  static async findByIdRaw(id) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `${ORDER_DETAIL_SELECT}
       WHERE o.id = :id
       LIMIT 1`,
      { id }
    );

    return rows[0] || null;
  }

  static async findByOrderNumber(orderNumber, excludeId = null) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id FROM orders
       WHERE order_number = :orderNumber
         ${excludeId ? "AND id <> :excludeId" : ""}
       LIMIT 1`,
      { orderNumber, excludeId }
    );

    return rows[0] || null;
  }

  static async findPaymentsByOrderId(orderId, connection = null) {
    const db = connection || getPool();

    const [rows] = await db.execute(
      `SELECT id, order_id, payment_type, check_number, payment_date, amount, due_amount, is_paid, memo
       FROM order_payments
       WHERE order_id = :orderId`,
      { orderId }
    );

    return rows;
  }

  static async findPaymentsByOrderIds(orderIds = []) {
    if (!orderIds.length) return [];

    const pool = getPool();

    const placeholders = orderIds.map((_, index) => `:id${index}`).join(", ");
    const params = orderIds.reduce((acc, id, index) => {
      acc[`id${index}`] = id;
      return acc;
    }, {});

    const [rows] = await pool.execute(
      `SELECT id, order_id, payment_type, check_number, payment_date, amount, due_amount, is_paid, memo
       FROM order_payments
       WHERE order_id IN (${placeholders})`,
      params
    );

    return rows;
  }

  static async create(connection, data) {
    const [result] = await connection.execute(
      `INSERT INTO orders (${ORDER_COLUMNS}, created_at, updated_at)
       VALUES (${ORDER_VALUES}, NOW(), NOW())`,
      data
    );

    return result.insertId;
  }

  static async update(connection, id, data) {
    await connection.execute(
      `UPDATE orders SET ${ORDER_UPDATE_SET} WHERE id = :id`,
      { ...data, id }
    );
  }

  static async upsertPayment(connection, payment) {
    await connection.execute(
      `INSERT INTO order_payments
        (order_id, payment_type, check_number, payment_date, amount, due_amount, is_paid, memo, created_at, updated_at)
       VALUES
        (:orderId, :paymentType, :checkNumber, :paymentDate, :amount, :dueAmount, :isPaid, :memo, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
        check_number = VALUES(check_number),
        payment_date = VALUES(payment_date),
        amount = VALUES(amount),
        due_amount = VALUES(due_amount),
        is_paid = VALUES(is_paid),
        memo = VALUES(memo),
        updated_at = NOW()`,
      {
        orderId: payment.orderId,
        paymentType: payment.paymentType,
        checkNumber: payment.checkNumber ?? null,
        paymentDate: payment.paymentDate ?? null,
        amount: payment.amount ?? null,
        dueAmount: payment.dueAmount ?? null,
        isPaid: payment.isPaid ?? 0,
        memo: payment.memo ?? null,
      }
    );
  }

  static async deletePaymentByType(connection, orderId, paymentType) {
    await connection.execute(
      `DELETE FROM order_payments
       WHERE order_id = :orderId
         AND payment_type = :paymentType`,
      { orderId, paymentType }
    );
  }

  static async createAdditionalDocument(connection, data) {
    const [result] = await connection.execute(
      `INSERT INTO order_additional_documents
        (order_id, document_name, original_file_name, mime_type, storage_path,
         file_size_bytes, uploaded_by, uploaded_at, created_at, updated_at)
       VALUES
        (:orderId, :documentName, :originalFileName, :mimeType, :storagePath,
         :fileSizeBytes, :uploadedBy, NOW(), NOW(), NOW())`,
      data
    );

    return result.insertId;
  }

  static async findDocumentsByOrderId(orderId) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, order_id, document_name, original_file_name, mime_type,
              storage_path, file_size_bytes, uploaded_at
       FROM order_additional_documents
       WHERE order_id = :orderId AND is_deleted = 0
       ORDER BY id DESC`,
      { orderId }
    );

    return rows;
  }

  static async seedWorkflowStages(connection, orderId) {
    const stages = ["Review Records", "Serve", "Custodian", "SENT"];

    for (const stageName of stages) {
      await connection.execute(
        `INSERT INTO order_workflow_stages
          (order_id, stage_name, stage_status, created_at, updated_at)
         VALUES (:orderId, :stageName, 'pending', NOW(), NOW())
         ON DUPLICATE KEY UPDATE updated_at = updated_at`,
        { orderId, stageName }
      );
    }
  }

  static async findWorkflowStagesByOrderId(orderId) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, order_id, stage_name, stage_status, completed_at
       FROM order_workflow_stages
       WHERE order_id = :orderId
       ORDER BY FIELD(stage_name, 'Review Records', 'Serve', 'Custodian', 'SENT')`,
      { orderId }
    );

    return rows;
  }

  static async findWorkflowStagesByOrderIds(orderIds = []) {
    if (!orderIds.length) return [];

    const pool = getPool();

    const placeholders = orderIds.map((_, index) => `:id${index}`).join(", ");
    const params = orderIds.reduce((acc, id, index) => {
      acc[`id${index}`] = id;
      return acc;
    }, {});

    const [rows] = await pool.execute(
      `SELECT id, order_id, stage_name, stage_status, completed_at
       FROM order_workflow_stages
       WHERE order_id IN (${placeholders})
       ORDER BY FIELD(stage_name, 'Review Records', 'Serve', 'Custodian', 'SENT')`,
      params
    );

    return rows;
  }

  static isWorkflowFullyComplete(stages = []) {
    const statusByName = new Map(
      stages.map((stage) => [stage.stage_name, stage.stage_status])
    );

    return Object.entries(REQUIRED_WORKFLOW_COMPLETION).every(
      ([stageName, requiredStatus]) =>
        statusByName.get(stageName) === requiredStatus
    );
  }

  static async syncOrderStatusFromWorkflow(orderId, connection = null) {
    const db = connection || getPool();

    const [orders] = await db.execute(
      `SELECT id, status
       FROM orders
       WHERE id = :orderId AND ${ACTIVE_ORDER}
       LIMIT 1`,
      { orderId }
    );
    const order = orders[0];

    if (!order || WORKFLOW_AUTO_COMPLETE_EXCLUDED_STATUSES.has(order.status)) {
      return false;
    }

    if (order.status !== "Active") {
      return false;
    }

    const [stageRows] = await db.execute(
      `SELECT stage_name, stage_status
       FROM order_workflow_stages
       WHERE order_id = :orderId`,
      { orderId }
    );

    if (!Order.isWorkflowFullyComplete(stageRows)) {
      return false;
    }

    await db.execute(
      `UPDATE orders
       SET status = 'Ready to Pickup', updated_at = NOW()
       WHERE id = :orderId`,
      { orderId }
    );

    return true;
  }

  static async upsertWorkflowStage(
    orderId,
    stageName,
    stageStatus,
    completedAt,
    connection = null
  ) {
    const db = connection || getPool();

    await db.execute(
      `INSERT INTO order_workflow_stages
        (order_id, stage_name, stage_status, completed_at, created_at, updated_at)
       VALUES (:orderId, :stageName, :stageStatus, :completedAt, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
        stage_status = VALUES(stage_status),
        completed_at = VALUES(completed_at),
        updated_at = NOW()`,
      { orderId, stageName, stageStatus, completedAt }
    );

    await Order.syncOrderStatusFromWorkflow(orderId, connection);
  }

  static async findNotesByOrderId(orderId, pendingOnly = false) {
    const pool = getPool();

    const conditions = ["order_id = :orderId"];
    if (pendingOnly) {
      conditions.push("is_called = 0");
    }

    const [rows] = await pool.execute(
      `SELECT id, order_id, note_date, created_by, author_name, note,
              callback_date, attachment_path, is_called
       FROM order_notes
       WHERE ${conditions.join(" AND ")}
       ORDER BY note_date DESC, id DESC`,
      { orderId }
    );

    return rows;
  }

  static async findReminders({ createdBy = null, limit = 500 } = {}) {
    const pool = getPool();
    const conditions = ["n.callback_date IS NOT NULL"];
    const params = {};

    if (createdBy) {
      conditions.push("n.created_by = :createdBy");
      params.createdBy = createdBy;
    }

    const [rows] = await pool.execute(
      `SELECT n.id AS note_id, n.order_id, n.note_date, n.created_by,
              n.author_name, n.note, n.callback_date, n.attachment_path,
              n.is_called,
              o.order_number, o.case_number,
              o.applicant_first_name, o.applicant_middle_name, o.applicant_last_name
       FROM order_notes n
       INNER JOIN orders o ON o.id = n.order_id AND ${ACTIVE_ORDER_ALIAS}
       WHERE ${conditions.join(" AND ")}
       ORDER BY n.callback_date ASC, n.note_date DESC
       LIMIT ${Number(limit)}`,
      params
    );

    return rows;
  }

  static async findDueRemindersOnDate({ createdBy = null, date }) {
    const pool = getPool();
    const conditions = [
      "n.callback_date IS NOT NULL",
      "n.is_called = 0",
      "DATE(n.callback_date) = :dueDate",
    ];
    const params = { dueDate: date };

    if (createdBy) {
      conditions.push("n.created_by = :createdBy");
      params.createdBy = createdBy;
    }

    const [rows] = await pool.execute(
      `SELECT n.id AS note_id, n.order_id, n.note_date, n.created_by,
              n.author_name, n.note, n.callback_date, n.attachment_path,
              n.is_called,
              o.order_number, o.case_number,
              o.applicant_first_name, o.applicant_middle_name, o.applicant_last_name
       FROM order_notes n
       INNER JOIN orders o ON o.id = n.order_id AND ${ACTIVE_ORDER_ALIAS}
       WHERE ${conditions.join(" AND ")}
       ORDER BY n.callback_date ASC, o.order_number ASC`,
      params
    );

    return rows;
  }

  static async findRecentNotesByOrderIds(orderIds = [], limitPerOrder = 2) {
    if (!orderIds.length) return {};

    const pool = getPool();
    const placeholders = orderIds.map(() => "?").join(", ");

    const [rows] = await pool.execute(
      `SELECT id, order_id, note_date, created_by, author_name, note,
              callback_date, attachment_path, is_called
       FROM order_notes
       WHERE order_id IN (${placeholders})
       ORDER BY note_date DESC, id DESC`,
      orderIds
    );

    const grouped = {};

    rows.forEach((row) => {
      if (!grouped[row.order_id]) grouped[row.order_id] = [];
      if (grouped[row.order_id].length < limitPerOrder) {
        grouped[row.order_id].push(row);
      }
    });

    return grouped;
  }

  static async findActiveReminderFlagsByOrderIds(orderIds = []) {
    if (!orderIds.length) return {};

    const pool = getPool();
    const placeholders = orderIds.map(() => "?").join(", ");

    const [rows] = await pool.execute(
      `SELECT order_id, COUNT(*) AS reminder_count
       FROM order_notes
       WHERE order_id IN (${placeholders})
         AND callback_date IS NOT NULL
         AND is_called = 0
       GROUP BY order_id`,
      orderIds
    );

    return rows.reduce((acc, row) => {
      acc[row.order_id] = Number(row.reminder_count) > 0;
      return acc;
    }, {});
  }

  static async createNote(data) {
    const pool = getPool();

    const [result] = await pool.execute(
      `INSERT INTO order_notes
        (order_id, note_date, created_by, author_name, note,
         callback_date, attachment_path, is_called, created_at, updated_at)
       VALUES
        (:orderId, NOW(), :createdBy, :authorName, :note,
         :callbackDate, :attachmentPath, :isCalled, NOW(), NOW())`,
      data
    );

    await pool.execute(
      `UPDATE orders SET has_note = 1, updated_at = NOW() WHERE id = :orderId`,
      { orderId: data.orderId }
    );

    return result.insertId;
  }

  static async updateNote(connection, id, data) {
    // attachmentPath is COALESCE'd so passing null keeps the existing file.
    await connection.execute(
      `UPDATE order_notes
       SET note = :note,
           callback_date = :callbackDate,
           attachment_path = COALESCE(:attachmentPath, attachment_path),
           is_called = :isCalled,
           updated_at = NOW()
       WHERE id = :id`,
      { ...data, id }
    );
  }

  static async createActivityLog(data, connection = null) {
    const db = connection || getPool();

    const [result] = await db.execute(
      `INSERT INTO order_activity_logs
        (order_id, activity_date, performed_by, author_name,
         callback_date, note, attachment_path, created_at)
       VALUES
        (:orderId, :activityDate, :performedBy, :authorName,
         :callbackDate, :note, :attachmentPath, NOW())`,
      data
    );

    return result.insertId;
  }

  static async findActivityLogsByOrderId(orderId) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, order_id, activity_date, performed_by, author_name,
              callback_date, note, attachment_path
       FROM order_activity_logs
       WHERE order_id = :orderId
       ORDER BY activity_date DESC, id DESC`,
      { orderId }
    );

    return rows;
  }

  static async findNoteById(id, connection = null) {
    const db = connection || getPool();

    const [rows] = await db.execute(
      `SELECT id, order_id, note_date, created_by, author_name, note,
              callback_date, attachment_path, is_called
       FROM order_notes
       WHERE id = :id
       LIMIT 1`,
      { id }
    );

    return rows[0] || null;
  }

  static async deleteById(id, { deletedBy } = {}) {
    const pool = getPool();

    const [result] = await pool.execute(
      `UPDATE orders
       SET status_before_inactive = status,
           status = 'Deleted',
           deleted_at = NOW(),
           deleted_by = :deletedBy,
           updated_at = NOW()
       WHERE id = :id AND ${ACTIVE_ORDER}`,
      { id, deletedBy: deletedBy || null }
    );

    return result.affectedRows > 0;
  }

  static async cancelById(id, { reason, actorId }) {
    const pool = getPool();

    const [result] = await pool.execute(
      `UPDATE orders
       SET status_before_inactive = status,
           status = 'Cancelled',
           cancel_reason = :reason,
           cancelled_at = NOW(),
           cancelled_by = :actorId,
           updated_at = NOW()
       WHERE id = :id AND ${ACTIVE_ORDER}`,
      { id, reason, actorId: actorId || null }
    );

    return result.affectedRows > 0;
  }

  static async restoreById(id) {
    const pool = getPool();

    const [result] = await pool.execute(
      `UPDATE orders
       SET status = COALESCE(status_before_inactive, 'Active'),
           status_before_inactive = NULL,
           cancel_reason = NULL,
           cancelled_at = NULL,
           cancelled_by = NULL,
           deleted_at = NULL,
           deleted_by = NULL,
           updated_at = NOW()
       WHERE id = :id
         AND status IN ('Cancelled', 'Deleted')`,
      { id }
    );

    return result.affectedRows > 0;
  }
}

module.exports = Order;
