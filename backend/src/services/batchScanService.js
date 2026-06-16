const path = require("path");
const { randomUUID } = require("crypto");
const ApiError = require("../utils/ApiError");
const fileStorage = require("../utils/fileStorage");
const { getPdfPageCount, extractPageRange } = require("../utils/pdfSplit");
const { mapSchemaToExtractRow, mapSchemaToOrderHints } = require("../utils/extractionMapper");
const subpoenaExtractionService = require("./subpoenaExtractionService");
const batchScanRepository = require("../repositories/batchScanRepository");
const { withTransaction } = require("../config/database");

const MIME_PDF = "application/pdf";

function buildDocumentId() {
  return randomUUID().replace(/-/g, "");
}

function buildBatchReference(documentId) {
  return `BATCH-${documentId.slice(0, 12).toUpperCase()}`;
}

function buildChildReference(documentId, index) {
  return `SUB-${documentId.slice(0, 12).toUpperCase()}-${String(index).padStart(3, "0")}`;
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function formatUploadDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const hours = date.getHours();
  const mins = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${mm}/${dd}/${yy} ${h12}:${mins} ${ampm}`;
}

function mapExtractRowToApi(row) {
  const confidence =
    typeof row.extraction_confidence === "string"
      ? JSON.parse(row.extraction_confidence || "{}")
      : row.extraction_confidence || {};
  const rawExtraction =
    typeof row.raw_extraction === "string"
      ? JSON.parse(row.raw_extraction || "{}")
      : row.raw_extraction || {};

  return {
    id: row.id,
    parentId: row.parent_id,
    referenceCode: row.reference_code,
    subpoenaIndex: row.subpoena_index,
    fileName: row.file_name,
    storagePath: row.storage_path,
    pageCount: row.page_count,
    size: formatBytes(row.file_size_bytes),
    fileSizeBytes: row.file_size_bytes,
    uploadedAt: formatUploadDate(row.uploaded_at || row.created_at),
    isProcessed: Boolean(row.is_processed),
    orderHints: mapSchemaToOrderHints(rawExtraction),
    extractionConfidence: confidence,
    batchReferenceCode: row.batch_reference_code,
    batchFileName: row.batch_file_name,
    batchStoragePath: row.batch_storage_path,
    pageRange: {
      start: row.page_range_start,
      end: row.page_range_end,
    },
    applicantName: row.applicant_name,
    caseName: row.case_name,
    orderNumber: row.order_number,
  };
}

async function processBatchScan(file, uploadedBy) {
  if (!file?.buffer?.length) {
    throw new ApiError(400, "No file uploaded");
  }

  const userId = Number(uploadedBy);
  if (!userId) {
    throw new ApiError(400, "uploadedBy is required (matrix employee id)");
  }

  const employee = await batchScanRepository.findEmployeeById(userId);
  if (!employee) {
    throw new ApiError(400, "Invalid uploadedBy — employee not found or terminated");
  }

  const originalName = file.originalname || "batch.pdf";
  if (path.extname(originalName).toLowerCase() !== ".pdf") {
    throw new ApiError(400, "Only PDF files are supported");
  }

  const documentId = buildDocumentId();
  const stem = fileStorage.sanitizeFileStem(originalName);
  const parentFileName = `${stem}_${userId}_${documentId}.pdf`;

  const extraction = await subpoenaExtractionService.processDocument(
    file.buffer,
    originalName
  );

  const results = Array.isArray(extraction.results) ? extraction.results : [];
  if (results.length === 0) {
    throw new ApiError(502, "Extraction service returned no subpoena results");
  }

  const parentPageCount = await getPdfPageCount(file.buffer);
  const parentFile = fileStorage.saveBatchScanFile(
    userId,
    parentFileName,
    file.buffer
  );

  const preparedChildren = [];

  for (let idx = 0; idx < results.length; idx += 1) {
    const result = results[idx];
    const subpoenaIndex = result.subpoena_index ?? idx + 1;
    const pageRange = result.page_range || { start: 0, end: parentPageCount - 1 };
    const start = pageRange.start ?? 0;
    const end = pageRange.end ?? start;

    const childBuffer = await extractPageRange(file.buffer, start, end);
    const childFileName = `${documentId}_${subpoenaIndex}.pdf`;
    const childFile = fileStorage.saveBatchScanFile(
      userId,
      childFileName,
      childBuffer
    );
    const childPageCount = await getPdfPageCount(childBuffer);
    const schema = result.schema_extraction || {};
    const mapped = mapSchemaToExtractRow(schema);

    preparedChildren.push({
      reference_code: buildChildReference(documentId, subpoenaIndex),
      subpoena_index: subpoenaIndex,
      file_name: childFile.fileName,
      storage_path: childFile.relativePath,
      mime_type: MIME_PDF,
      file_size_bytes: childBuffer.length,
      page_count: childPageCount,
      page_range_start: start,
      page_range_end: end,
      ...mapped,
      order_hints: mapSchemaToOrderHints(schema),
    });
  }

  const parentReference = buildBatchReference(documentId);

  const dbResult = await withTransaction(async (conn) => {
    const parentId = await batchScanRepository.insertParentBatch(conn, {
      reference_code: parentReference,
      file_name: parentFile.fileName,
      storage_path: parentFile.relativePath,
      mime_type: MIME_PDF,
      file_size_bytes: file.buffer.length,
      page_count: parentPageCount,
      uploaded_by: userId,
    });

    const childIds = [];
    for (const child of preparedChildren) {
      const childId = await batchScanRepository.insertChildExtract(conn, {
        parent_id: parentId,
        reference_code: child.reference_code,
        subpoena_index: child.subpoena_index,
        file_name: child.file_name,
        storage_path: child.storage_path,
        mime_type: child.mime_type,
        file_size_bytes: child.file_size_bytes,
        page_count: child.page_count,
        page_range_start: child.page_range_start,
        page_range_end: child.page_range_end,
        applicant_name: child.applicant_name,
        case_name: child.case_name,
        order_number: child.order_number,
        ssn: child.ssn,
        date_of_birth: child.date_of_birth,
        date_of_injury: child.date_of_injury,
        customer: child.customer,
        company_name: child.company_name,
        company_address: child.company_address,
        specific_doctor: child.specific_doctor,
        doctor_address: child.doctor_address,
        record_type: child.record_type,
        requested_record: child.requested_record,
        subpoena_date: child.subpoena_date,
        date_requested: child.date_requested,
        depo_due_date: child.depo_due_date,
        amount: child.amount,
        cheque_date: child.cheque_date,
        cheque_number: child.cheque_number,
        extraction_confidence: child.extraction_confidence,
        raw_extraction: child.raw_extraction,
      });
      childIds.push(childId);
    }

    await batchScanRepository.insertActivityLog(conn, {
      action: "Batch Scan Uploaded",
      module: "Processing",
      performed_by: userId,
      performer_name: employee.name,
      details: `Batch ${parentReference}: ${originalName} → ${preparedChildren.length} subpoena(s). Parent: ${parentFile.relativePath}`,
    });

    return { parentId, childIds };
  });

  const children = preparedChildren.map((child, index) => ({
    id: dbResult.childIds[index],
    parentId: dbResult.parentId,
    referenceCode: child.reference_code,
    subpoenaIndex: child.subpoena_index,
    fileName: child.file_name,
    storagePath: child.storage_path,
    pageCount: child.page_count,
    fileSizeBytes: child.file_size_bytes,
    pageRange: {
      start: child.page_range_start,
      end: child.page_range_end,
    },
    orderHints: child.order_hints,
    extractionConfidence: child.extraction_confidence,
  }));

  return {
    documentId,
    parent: {
      id: dbResult.parentId,
      referenceCode: parentReference,
      fileName: parentFile.fileName,
      storagePath: parentFile.relativePath,
      pageCount: parentPageCount,
      fileSizeBytes: file.buffer.length,
      uploadedBy: userId,
      uploadedByName: employee.name,
    },
    total: children.length,
    isMulti: Boolean(extraction.is_multi),
    children,
  };
}

async function getUnprocessedQueue() {
  const rows = await batchScanRepository.listUnprocessedExtracts();
  return rows.map((row) => ({
    id: row.id,
    parentId: row.parent_id,
    referenceCode: row.reference_code,
    fileName: row.file_name,
    uploadedAt: formatUploadDate(row.uploaded_at),
    pages: row.page_count,
    size: formatBytes(row.file_size_bytes),
    applicantName: row.applicant_name,
    caseName: row.case_name,
    orderNumber: row.order_number,
    batchReferenceCode: row.batch_reference_code,
  }));
}

async function getUnprocessedExtract(extractId) {
  const row = await batchScanRepository.getExtractById(extractId);
  if (!row) {
    throw new ApiError(404, "Unprocessed subpoena not found");
  }
  return mapExtractRowToApi(row);
}

module.exports = {
  processBatchScan,
  getUnprocessedQueue,
  getUnprocessedExtract,
  mapExtractRowToApi,
};
