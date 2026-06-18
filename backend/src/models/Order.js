/**
 * Order model — DMS order records.
 */

const { getPool } = require("../config/database");

const ORDER_COLUMNS = `
  order_number, facility_id, provider_id, order_type, status, court,
  case_number, order_ref, ssn_last_four, dob,
  applicant_first_name, applicant_middle_name, applicant_last_name,
  applicant_aka, defendant, injury_type,
  serve_company_name, serve_address, serve_zip, serve_city, serve_state,
  serve_phone, serve_fax, serve_email,
  contact1_name, contact1_title, contact1_phone, contact1_fax, contact1_email,
  contact2_name, contact2_title, contact2_phone, contact2_fax, contact2_email,
  date_served, depo_due_date, delivery_date, subpoena_date,
  ready_date, invoice_date, xray_invoice_date,
  flag_medical_records, flag_billing_records, flag_employment_records,
  flag_xrays, flag_other_record,
  specific_record, specific_doctor, full_address,
  certificate_no_records, cnr_reason, cnr_delivery, cnr_date_sent, cnr_memo,
  subpoena_storage_path, has_note, has_subpoena, created_by`;

const ORDER_VALUES = `
  :orderNumber, :facilityId, :providerId, :orderType, :status, :court,
  :caseNumber, :orderRef, :ssnLastFour, :dob,
  :applicantFirstName, :applicantMiddleName, :applicantLastName,
  :applicantAka, :defendant, :injuryType,
  :serveCompanyName, :serveAddress, :serveZip, :serveCity, :serveState,
  :servePhone, :serveFax, :serveEmail,
  :contact1Name, :contact1Title, :contact1Phone, :contact1Fax, :contact1Email,
  :contact2Name, :contact2Title, :contact2Phone, :contact2Fax, :contact2Email,
  :dateServed, :depoDueDate, :deliveryDate, :subpoenaDate,
  :readyDate, :invoiceDate, :xrayInvoiceDate,
  :flagMedicalRecords, :flagBillingRecords, :flagEmploymentRecords,
  :flagXrays, :flagOtherRecord,
  :specificRecord, :specificDoctor, :fullAddress,
  :certificateNoRecords, :cnrReason, :cnrDelivery, :cnrDateSent, :cnrMemo,
  :subpoenaStoragePath, :hasNote, :hasSubpoena, :createdBy`;

const ORDER_UPDATE_SET = `
  order_number = :orderNumber,
  facility_id = :facilityId,
  provider_id = :providerId,
  order_type = :orderType,
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
  ready_date = :readyDate,
  invoice_date = :invoiceDate,
  xray_invoice_date = :xrayInvoiceDate,
  flag_medical_records = :flagMedicalRecords,
  flag_billing_records = :flagBillingRecords,
  flag_employment_records = :flagEmploymentRecords,
  flag_xrays = :flagXrays,
  flag_other_record = :flagOtherRecord,
  specific_record = :specificRecord,
  specific_doctor = :specificDoctor,
  full_address = :fullAddress,
  certificate_no_records = :certificateNoRecords,
  cnr_reason = :cnrReason,
  cnr_delivery = :cnrDelivery,
  cnr_date_sent = :cnrDateSent,
  cnr_memo = :cnrMemo,
  subpoena_storage_path = :subpoenaStoragePath,
  has_subpoena = :hasSubpoena,
  updated_at = NOW()`;

const ORDER_DETAIL_SELECT = `
  SELECT o.*, f.facility_name, f.slug AS facility_slug,
         p.company_name AS provider_name
  FROM orders o
  LEFT JOIN facilities f ON f.id = o.facility_id
  LEFT JOIN providers p ON p.id = o.provider_id`;

class Order {
  static async findAll(filters = {}) {
    const pool = getPool();

    const conditions = [];
    const params = {};

    if (filters.facilityId) {
      conditions.push("o.facility_id = :facilityId");
      params.facilityId = filters.facilityId;
    }

    if (filters.status) {
      conditions.push("o.status = :status");
      params.status = filters.status;
    }

    if (filters.year) {
      conditions.push("YEAR(o.subpoena_date) = :year");
      params.year = filters.year;
    }

    if (filters.search) {
      conditions.push(`(
        o.order_number LIKE :search
        OR o.case_number LIKE :search
        OR o.order_ref LIKE :search
        OR o.serve_company_name LIKE :search
        OR CONCAT_WS(' ', o.applicant_first_name, o.applicant_middle_name, o.applicant_last_name) LIKE :search
      )`);
      params.search = `%${filters.search}%`;
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const [rows] = await pool.execute(
      `${ORDER_DETAIL_SELECT}
       ${whereClause}
       ORDER BY o.id DESC`,
      params
    );

    return rows;
  }

  static async findById(id) {
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

  static async findPaymentsByOrderId(orderId) {
    const pool = getPool();

    const [rows] = await pool.execute(
      `SELECT id, order_id, payment_type, check_number, payment_date, amount, is_paid, memo
       FROM order_payments
       WHERE order_id = :orderId`,
      { orderId }
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
        (order_id, payment_type, check_number, payment_date, amount, is_paid, memo, created_at, updated_at)
       VALUES
        (:orderId, :paymentType, :checkNumber, :paymentDate, :amount, :isPaid, :memo, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
        check_number = VALUES(check_number),
        payment_date = VALUES(payment_date),
        amount = VALUES(amount),
        is_paid = VALUES(is_paid),
        memo = VALUES(memo),
        updated_at = NOW()`,
      payment
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

  static async upsertWorkflowStage(orderId, stageName, stageStatus, completedAt) {
    const pool = getPool();

    await pool.execute(
      `INSERT INTO order_workflow_stages
        (order_id, stage_name, stage_status, completed_at, created_at, updated_at)
       VALUES (:orderId, :stageName, :stageStatus, :completedAt, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
        stage_status = VALUES(stage_status),
        completed_at = VALUES(completed_at),
        updated_at = NOW()`,
      { orderId, stageName, stageStatus, completedAt }
    );
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
    const conditions = [];
    const params = {};

    if (createdBy) {
      conditions.push("n.created_by = :createdBy");
      params.createdBy = createdBy;
    }

    const [rows] = await pool.execute(
      `SELECT n.id AS note_id, n.order_id, n.note_date, n.created_by,
              n.author_name, n.note, n.callback_date, n.attachment_path, n.is_called,
              o.order_number, o.case_number,
              o.applicant_first_name, o.applicant_middle_name, o.applicant_last_name
       FROM order_notes n
       INNER JOIN orders o ON o.id = n.order_id
       ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
       ORDER BY n.callback_date ASC, n.note_date DESC
       LIMIT ${Number(limit)}`,
      params
    );

    return rows;
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

  static async deleteById(id) {
    const pool = getPool();

    const [result] = await pool.execute(
      `DELETE FROM orders WHERE id = :id`,
      { id }
    );

    return result.affectedRows > 0;
  }
}

module.exports = Order;
