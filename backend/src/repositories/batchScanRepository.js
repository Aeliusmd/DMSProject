const { query } = require("../config/database");
const ApiError = require("../utils/ApiError");

async function findEmployeeById(employeeId) {
  const rows = await query(
    `SELECT id, name, logon, email, role
     FROM matrix_employees
     WHERE id = :id AND is_terminated = 0
     LIMIT 1`,
    { id: employeeId }
  );
  return rows[0] || null;
}

async function insertParentBatch(conn, parent) {
  const [result] = await conn.execute(
    `INSERT INTO unprocessed_subpoenas (
      reference_code, file_name, storage_path, mime_type, file_size_bytes,
      page_count, uploaded_by, order_id, is_processed
    ) VALUES (
      :reference_code, :file_name, :storage_path, :mime_type, :file_size_bytes,
      :page_count, :uploaded_by, NULL, 0
    )`,
    parent
  );
  return result.insertId;
}

async function insertChildExtract(conn, child) {
  const [result] = await conn.execute(
    `INSERT INTO batch_scan_extracts (
      parent_id, reference_code, subpoena_index, file_name, storage_path,
      mime_type, file_size_bytes, page_count, page_range_start, page_range_end,
      applicant_name, case_name, order_number, ssn, date_of_birth, date_of_injury,
      customer, company_name, company_address, specific_doctor, doctor_address,
      record_type, requested_record, subpoena_date, date_requested, depo_due_date,
      amount, cheque_date, cheque_number, extraction_confidence, raw_extraction,
      is_processed
    ) VALUES (
      :parent_id, :reference_code, :subpoena_index, :file_name, :storage_path,
      :mime_type, :file_size_bytes, :page_count, :page_range_start, :page_range_end,
      :applicant_name, :case_name, :order_number, :ssn, :date_of_birth, :date_of_injury,
      :customer, :company_name, :company_address, :specific_doctor, :doctor_address,
      :record_type, :requested_record, :subpoena_date, :date_requested, :depo_due_date,
      :amount, :cheque_date, :cheque_number, :extraction_confidence, :raw_extraction,
      0
    )`,
    {
      ...child,
      extraction_confidence: JSON.stringify(child.extraction_confidence || {}),
      raw_extraction: JSON.stringify(child.raw_extraction || {}),
    }
  );
  return result.insertId;
}

async function insertActivityLog(conn, log) {
  await conn.execute(
    `INSERT INTO activity_logs (
      log_date, log_time, action, module, performed_by, performer_name, details
    ) VALUES (
      CURDATE(), CURTIME(), :action, :module, :performed_by, :performer_name, :details
    )`,
    log
  );
}

async function listUnprocessedExtracts() {
  return query(
    `SELECT
      e.id,
      e.parent_id,
      e.reference_code,
      e.subpoena_index,
      e.file_name,
      e.storage_path,
      e.file_size_bytes,
      e.page_count,
      e.is_processed,
      e.created_at AS uploaded_at,
      e.applicant_name,
      e.case_name,
      e.order_number,
      p.reference_code AS batch_reference_code,
      p.file_name AS batch_file_name
    FROM batch_scan_extracts e
    INNER JOIN unprocessed_subpoenas p ON p.id = e.parent_id
    WHERE e.is_deleted = 0
      AND e.is_processed = 0
      AND e.order_id IS NULL
      AND p.is_deleted = 0
    ORDER BY p.created_at DESC, e.subpoena_index ASC, e.id ASC`
  );
}

async function getExtractById(extractId) {
  const rows = await query(
    `SELECT
      e.*,
      p.reference_code AS batch_reference_code,
      p.file_name AS batch_file_name,
      p.storage_path AS batch_storage_path,
      p.uploaded_by,
      p.uploaded_at AS batch_uploaded_at
    FROM batch_scan_extracts e
    INNER JOIN unprocessed_subpoenas p ON p.id = e.parent_id
    WHERE e.id = :id
      AND e.is_deleted = 0
      AND p.is_deleted = 0
    LIMIT 1`,
    { id: extractId }
  );
  return rows[0] || null;
}

async function linkExtractToOrder(conn, { extractId, orderId }) {
  const [rows] = await conn.execute(
    `SELECT id, storage_path, is_processed
     FROM batch_scan_extracts
     WHERE id = :id AND is_deleted = 0
     LIMIT 1
     FOR UPDATE`,
    { id: extractId }
  );

  const row = rows[0];
  if (!row) {
    throw new ApiError(400, "Subpoena extract not found");
  }
  if (row.is_processed) {
    throw new ApiError(409, "This subpoena extract was already processed into an order");
  }

  await conn.execute(
    `UPDATE batch_scan_extracts
     SET order_id = :order_id, is_processed = 1, processed_at = NOW()
     WHERE id = :id`,
    { order_id: orderId, id: extractId }
  );

  return row.storage_path;
}

module.exports = {
  findEmployeeById,
  insertParentBatch,
  insertChildExtract,
  insertActivityLog,
  listUnprocessedExtracts,
  getExtractById,
  linkExtractToOrder,
};
