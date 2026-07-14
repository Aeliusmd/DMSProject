const { getPool } = require("../config/database");

const SELECT_COLUMNS = `
  id, company_user_id, order_number, status,
  facility_name, facility_address, facility_city, facility_state, facility_zip, treating_doctor,
  applicant_name, case_name, case_number, rec_number, ssn,
  date_of_birth, date_of_injury, date_of_injury_text,
  company_name, company_address, company_city, company_state, company_zip, doctor_address,
  record_type, requested_record,
  medical_records, billing_records, employment_records, xrays, other_record,
  subpoena_date, date_requested, depo_due_date,
  contact_email, contact_phone,
  subpoena_file_name, subpoena_storage_path, subpoena_file_size, extraction_raw,
  payment_amount, payment_status, stripe_checkout_session_id, stripe_payment_intent_id,
  stripe_receipt_url, paid_at,
  created_at, updated_at
`;

class CompanyPortalOrder {
  static async findById(id, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT ${SELECT_COLUMNS}
       FROM company_portal_orders
       WHERE id = :id
       LIMIT 1`,
      { id }
    );
    return rows[0] || null;
  }

  static async findByIdForUser(id, companyUserId, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT ${SELECT_COLUMNS}
       FROM company_portal_orders
       WHERE id = :id
         AND company_user_id = :companyUserId
       LIMIT 1`,
      { id, companyUserId }
    );
    return rows[0] || null;
  }

  static async findByCheckoutSessionId(sessionId, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT ${SELECT_COLUMNS}
       FROM company_portal_orders
       WHERE stripe_checkout_session_id = :sessionId
       LIMIT 1`,
      { sessionId }
    );
    return rows[0] || null;
  }

  static async findByOrderNumber(orderNumber, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT ${SELECT_COLUMNS}
       FROM company_portal_orders
       WHERE order_number = :orderNumber
       LIMIT 1`,
      { orderNumber }
    );
    return rows[0] || null;
  }

  static async findByOrderNumberForUser(
    orderNumber,
    companyUserId,
    connection = null
  ) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT ${SELECT_COLUMNS}
       FROM company_portal_orders
       WHERE order_number = :orderNumber
         AND company_user_id = :companyUserId
         AND status <> 'Draft'
       LIMIT 1`,
      { orderNumber, companyUserId }
    );
    return rows[0] || null;
  }

  static async createPaidOrder(data, connection = null) {
    const db = connection || getPool();
    const [result] = await db.execute(
      `INSERT INTO company_portal_orders
        (company_user_id, order_number, status, facility_name, facility_address, facility_city, facility_state, facility_zip, treating_doctor,
         applicant_name, case_name, case_number, rec_number, ssn,
         date_of_birth, date_of_injury, date_of_injury_text,
         company_name, company_address, company_city, company_state, company_zip, doctor_address,
         record_type, requested_record,
         medical_records, billing_records, employment_records, xrays, other_record,
         subpoena_date, date_requested, depo_due_date,
         contact_email, contact_phone,
         subpoena_file_name, subpoena_storage_path, subpoena_file_size, extraction_raw,
         payment_amount, payment_status, stripe_checkout_session_id, stripe_payment_intent_id,
         stripe_receipt_url, paid_at, created_at, updated_at)
       VALUES
        (:companyUserId, :orderNumber, 'In Process', :facilityName, :facilityAddress, :facilityCity, :facilityState, :facilityZip, :treatingDoctor,
         :applicantName, :caseName, :caseNumber, :recNumber, :ssn,
         :dateOfBirth, :dateOfInjury, :dateOfInjuryText,
         :companyName, :companyAddress, :companyCity, :companyState, :companyZip, :doctorAddress,
         :recordType, :requestedRecord,
         :medicalRecords, :billingRecords, :employmentRecords, :xrays, :otherRecord,
         :subpoenaDate, :dateRequested, :depoDueDate,
         :contactEmail, :contactPhone,
         :subpoenaFileName, :subpoenaStoragePath, :subpoenaFileSize, :extractionRaw,
         :paymentAmount, 'paid', :stripeCheckoutSessionId, :stripePaymentIntentId,
         :stripeReceiptUrl, NOW(), NOW(), NOW())`,
      data
    );

    return this.findById(result.insertId, connection);
  }

  static async updateDetails(id, companyUserId, data, connection = null) {
    const db = connection || getPool();
    await db.execute(
      `UPDATE company_portal_orders
       SET facility_name = :facilityName,
           facility_address = :facilityAddress,
           facility_city = :facilityCity,
           facility_state = :facilityState,
           facility_zip = :facilityZip,
           treating_doctor = :treatingDoctor,
           applicant_name = :applicantName,
           case_name = :caseName,
           case_number = :caseNumber,
           rec_number = :recNumber,
           ssn = :ssn,
           date_of_birth = :dateOfBirth,
           date_of_injury = :dateOfInjury,
           date_of_injury_text = :dateOfInjuryText,
           company_name = :companyName,
           company_address = :companyAddress,
           company_city = :companyCity,
           company_state = :companyState,
           company_zip = :companyZip,
           doctor_address = :doctorAddress,
           record_type = :recordType,
           requested_record = :requestedRecord,
           medical_records = :medicalRecords,
           billing_records = :billingRecords,
           employment_records = :employmentRecords,
           xrays = :xrays,
           other_record = :otherRecord,
           subpoena_date = :subpoenaDate,
           date_requested = :dateRequested,
           depo_due_date = :depoDueDate,
           contact_email = :contactEmail,
           contact_phone = :contactPhone,
           status = :status,
           updated_at = NOW()
       WHERE id = :id
         AND company_user_id = :companyUserId`,
      { ...data, id, companyUserId }
    );

    return this.findByIdForUser(id, companyUserId, connection);
  }

  static async markAwaitingPayment(id, sessionId, connection = null) {
    const db = connection || getPool();
    await db.execute(
      `UPDATE company_portal_orders
       SET status = 'Awaiting Payment',
           payment_status = 'pending',
           stripe_checkout_session_id = :sessionId,
           updated_at = NOW()
       WHERE id = :id`,
      { id, sessionId }
    );
  }

  static async markPaid(
    id,
    { orderNumber, paymentIntentId, receiptUrl },
    connection = null
  ) {
    const db = connection || getPool();
    await db.execute(
      `UPDATE company_portal_orders
       SET order_number = :orderNumber,
           status = 'In Process',
           payment_status = 'paid',
           stripe_payment_intent_id = :paymentIntentId,
           stripe_receipt_url = COALESCE(:receiptUrl, stripe_receipt_url),
           paid_at = NOW(),
           updated_at = NOW()
       WHERE id = :id`,
      {
        id,
        orderNumber,
        paymentIntentId: paymentIntentId || null,
        receiptUrl: receiptUrl || null,
      }
    );

    return this.findById(id, connection);
  }

  static async updateReceiptUrl(id, receiptUrl, connection = null) {
    if (!receiptUrl) return this.findById(id, connection);
    const db = connection || getPool();
    await db.execute(
      `UPDATE company_portal_orders
       SET stripe_receipt_url = COALESCE(stripe_receipt_url, :receiptUrl),
           updated_at = NOW()
       WHERE id = :id`,
      { id, receiptUrl }
    );
    return this.findById(id, connection);
  }

  static async listForUser(companyUserId, { limit = 50 } = {}, connection = null) {
    const db = connection || getPool();
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const [rows] = await db.execute(
      `SELECT ${SELECT_COLUMNS}
       FROM company_portal_orders
       WHERE company_user_id = :companyUserId
         AND status <> 'Draft'
         AND order_number IS NOT NULL
       ORDER BY created_at DESC, id DESC
       LIMIT ${safeLimit}`,
      { companyUserId }
    );
    return rows;
  }

  static async getStatsForUser(companyUserId, connection = null) {
    const db = connection || getPool();
    const [rows] = await db.execute(
      `SELECT
         COUNT(*) AS total_orders,
         SUM(CASE WHEN status = 'In Process' THEN 1 ELSE 0 END) AS in_process,
         SUM(CASE WHEN status = 'Invoice' THEN 1 ELSE 0 END) AS invoice,
         SUM(CASE WHEN status = 'Paid' THEN 1 ELSE 0 END) AS paid,
         SUM(CASE WHEN status = 'Released' THEN 1 ELSE 0 END) AS released
       FROM company_portal_orders
       WHERE company_user_id = :companyUserId
         AND status <> 'Draft'
         AND order_number IS NOT NULL`,
      { companyUserId }
    );

    const row = rows[0] || {};
    return {
      totalOrders: Number(row.total_orders) || 0,
      inProcess: Number(row.in_process) || 0,
      invoice: Number(row.invoice) || 0,
      paid: Number(row.paid) || 0,
      released: Number(row.released) || 0,
    };
  }
}

module.exports = CompanyPortalOrder;
