/**
 * Order business logic — called by orderController.
 */

const ApiError = require("../utils/ApiError");
const Order = require("../models/Order");
const Facility = require("../models/Facility");
const Provider = require("../models/Provider");
const Employee = require("../models/Employee");
const { getPool } = require("../config/database");
const { toRelativeStoragePath } = require("../middleware/uploadMiddleware");

const WORKFLOW_STAGE_NAMES = ["Review Records", "Serve", "Custodian", "SENT"];
const WORKFLOW_STAGE_STATUSES = ["pending", "complete", "failed", "sent"];

const STATUS_FILTER_MAP = {
  active: "Active",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

const ALLOWED_INJURY_TYPES = ["specific", "cumulative"];
const ALLOWED_CNR_DELIVERY = ["email", "fax", "pickup"];

const PAYMENT_PREFIXES = ["prepayment", "custodian", "xray"];

const RECORD_TITLES = {
  medical: "Medical Records",
  billing: "Billing Records",
  employment: "Employment Records",
  xrays: "X-Ray Films",
};

const DEFAULT_ORDER_FORMS = [
  "Send Copy/Letter",
  "Copy Center",
  "Certification",
  "Records",
  "CNR",
  "Called",
  "Edit Order",
];

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = `${value}`.trim();
  return trimmed === "" ? null : trimmed;
}

function dateOrNull(value) {
  const trimmed = trimOrNull(value);
  return trimmed;
}

function boolToInt(value) {
  // FormData/multipart sends booleans as strings ("true"/"false").
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" ||
      normalized === "1" ||
      normalized === "yes" ||
      normalized === "on"
      ? 1
      : 0;
  }
  return value ? 1 : 0;
}

function enumOrNull(value, allowed) {
  const trimmed = trimOrNull(value);
  if (!trimmed) return null;
  return allowed.includes(trimmed) ? trimmed : null;
}

function ssnLastFour(ssn) {
  const digits = `${ssn || ""}`.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function toInputDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toShortDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${month}/${day}/${year}`;
}

function buildFullName(first, middle, last) {
  return [first, middle, last].filter(Boolean).join(" ").trim();
}

function generateOrderNumber() {
  const stamp = Date.now().toString().slice(-7);
  return `${stamp}-1`;
}

function buildOrderDbPayload(data) {
  return {
    facilityId: Number(data.facility),
    providerId: data.providerId ? Number(data.providerId) : null,
    orderType: trimOrNull(data.type),
    court: trimOrNull(data.court) || "WCAB",
    caseNumber: trimOrNull(data.caseNumber),
    orderRef: trimOrNull(data.orderRef),
    ssnLastFour: ssnLastFour(data.ssn),
    dob: dateOrNull(data.dob),
    applicantFirstName: trimOrNull(data.firstName),
    applicantMiddleName: trimOrNull(data.middleName),
    applicantLastName: trimOrNull(data.lastName),
    applicantAka: trimOrNull(data.aka),
    defendant: trimOrNull(data.defendant),
    injuryType: enumOrNull(data.injuryType, ALLOWED_INJURY_TYPES),
    serveCompanyName: trimOrNull(data.serveCompanyName),
    serveAddress: trimOrNull(data.address),
    serveZip: trimOrNull(data.zip),
    serveCity: trimOrNull(data.city),
    serveState: trimOrNull(data.state),
    servePhone: trimOrNull(data.phone),
    serveFax: trimOrNull(data.fax),
    serveEmail: trimOrNull(data.email),
    contact1Name: trimOrNull(data.contact1Name),
    contact1Title: trimOrNull(data.contact1Title),
    contact1Phone: trimOrNull(data.contact1Phone),
    contact1Fax: trimOrNull(data.contact1Fax),
    contact1Email: trimOrNull(data.contact1Email),
    contact2Name: trimOrNull(data.contact2Name),
    contact2Title: trimOrNull(data.contact2Title),
    contact2Phone: trimOrNull(data.contact2Phone),
    contact2Fax: trimOrNull(data.contact2Fax),
    contact2Email: trimOrNull(data.contact2Email),
    dateServed: dateOrNull(data.dateServed),
    depoDueDate: dateOrNull(data.depoDueDate),
    deliveryDate: dateOrNull(data.deliveryDate),
    subpoenaDate: dateOrNull(data.subpoenaDate),
    readyDate: dateOrNull(data.readyDate),
    invoiceDate: dateOrNull(data.invoiceDate),
    xrayInvoiceDate: dateOrNull(data.xrayInvoiceDate),
    flagMedicalRecords: boolToInt(data.medicalRecords),
    flagBillingRecords: boolToInt(data.billingRecords),
    flagEmploymentRecords: boolToInt(data.employmentRecords),
    flagXrays: boolToInt(data.xrays),
    flagOtherRecord: boolToInt(data.otherRecord),
    specificRecord: trimOrNull(data.specificRecord),
    specificDoctor: trimOrNull(data.specificDoctor),
    fullAddress: trimOrNull(data.fullAddress),
    certificateNoRecords: boolToInt(data.certificateNoRecords),
    cnrReason: trimOrNull(data.cnrReason),
    cnrDelivery: enumOrNull(data.cnrDelivery, ALLOWED_CNR_DELIVERY),
    cnrDateSent: dateOrNull(data.cnrDateSent),
    cnrMemo: boolToInt(data.cnrMemo),
    subpoenaStoragePath: null,
    hasSubpoena: data.subpoenaDate ? 1 : 0,
  };
}

function getUploadedFile(files, field) {
  if (!files) return null;
  const entry = files[field];
  if (Array.isArray(entry)) return entry[0] || null;
  return entry || null;
}

function collectPayments(data) {
  return PAYMENT_PREFIXES.map((prefix) => {
    const checkNumber = trimOrNull(data[`${prefix}Check`]);
    const paymentDate = dateOrNull(data[`${prefix}Date`]);
    const rawAmount = trimOrNull(data[`${prefix}Paid`]);
    const memo = trimOrNull(data[`${prefix}Memo`]);

    if (!checkNumber && !paymentDate && !rawAmount && !memo) {
      return null;
    }

    const amount = rawAmount !== null ? Number(rawAmount) : null;

    return {
      paymentType: prefix,
      checkNumber,
      paymentDate,
      amount: Number.isNaN(amount) ? null : amount,
      isPaid: amount && amount > 0 ? 1 : 0,
      memo,
    };
  }).filter(Boolean);
}

function mapPaymentsToForm(payments = []) {
  const formFields = {
    prepaymentCheck: "",
    prepaymentDate: "",
    prepaymentPaid: "",
    prepaymentMemo: "",
    custodianCheck: "",
    custodianDate: "",
    custodianPaid: "",
    custodianMemo: "",
    xrayCheck: "",
    xrayDate: "",
    xrayPaid: "",
    xrayMemo: "",
  };

  payments.forEach((payment) => {
    const prefix = payment.payment_type;
    if (!PAYMENT_PREFIXES.includes(prefix)) return;

    formFields[`${prefix}Check`] = payment.check_number || "";
    formFields[`${prefix}Date`] = toInputDate(payment.payment_date);
    formFields[`${prefix}Paid`] =
      payment.amount !== null && payment.amount !== undefined
        ? String(payment.amount)
        : "";
    formFields[`${prefix}Memo`] = payment.memo || "";
  });

  return formFields;
}

function deriveFilterStatus(status) {
  if (status === "Completed") return "completed";
  if (["Cancelled", "No Records", "No Subpoena", "Write Offs"].includes(status)) {
    return "cancelled";
  }
  if (status === "Ready" || status === "Ready to Pickup") return "ready";
  return "active";
}

function buildCompanyBlock(row) {
  const name = row.serve_company_name || row.provider_name || "—";

  const address = [
    row.serve_address,
    [row.serve_city, row.serve_state].filter(Boolean).join(", "),
    row.serve_zip,
  ]
    .filter(Boolean)
    .join(", ");

  const phoneParts = [];
  if (row.serve_phone) phoneParts.push(`Phone ${row.serve_phone}`);
  if (row.serve_fax) phoneParts.push(`Fax ${row.serve_fax}`);

  return {
    name,
    address,
    phone: phoneParts.join(" | "),
    email: row.serve_email ? `Email: ${row.serve_email}` : "",
  };
}

function buildRecordsBlock(row) {
  const title = RECORD_TITLES[row.order_type] || "Records";

  const lines = [];
  if (row.specific_record) lines.push(row.specific_record);
  if (row.specific_doctor) lines.push(row.specific_doctor);

  return { title, lines, links: [] };
}

function mapOrderListRow(row, workflowStages = []) {
  const subpoenaYear = row.subpoena_date
    ? String(new Date(row.subpoena_date).getFullYear())
    : "";

  const dobSsn = [];
  if (row.dob) dobSsn.push(toShortDate(row.dob));
  if (row.ssn_last_four) dobSsn.push(`XXX-XX-${row.ssn_last_four}`);

  return {
    id: row.order_number,
    dbId: row.id,
    facility: row.facility_id ? String(row.facility_id) : "",
    facilityName: row.facility_name || "",
    year: subpoenaYear,
    status: row.status,
    filterStatus: deriveFilterStatus(row.status),
    workflowStages: workflowStages.map(mapWorkflowStage),
    note: Boolean(row.has_note),
    subpoena: Boolean(row.has_subpoena),
    court: row.court || "",
    applicant: buildFullName(
      row.applicant_first_name,
      row.applicant_middle_name,
      row.applicant_last_name
    ),
    orderRef: row.order_ref || "",
    records: buildRecordsBlock(row),
    company: buildCompanyBlock(row),
    dobSsn,
    forms: DEFAULT_ORDER_FORMS,
  };
}

function mapDocument(doc) {
  return {
    id: doc.id,
    documentName: doc.document_name || "",
    originalFileName: doc.original_file_name || "",
    mimeType: doc.mime_type || "",
    storagePath: doc.storage_path || "",
    url: doc.storage_path ? `/uploads/${doc.storage_path}` : "",
    fileSizeBytes: doc.file_size_bytes ?? null,
    uploadedAt: doc.uploaded_at || null,
  };
}

function mapWorkflowStage(stage) {
  return {
    id: stage.id,
    stageName: stage.stage_name,
    stageStatus: stage.stage_status,
    completedAt: stage.completed_at || null,
  };
}

function normalizeNoteText(text) {
  return `${text || ""}`.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function mapActivityLog(log) {
  return {
    id: log.id,
    date: toShortDate(log.activity_date),
    by: log.author_name || "—",
    callback: toShortDate(log.callback_date),
    note: log.note || "",
    attachmentUrl: log.attachment_path
      ? `/uploads/${log.attachment_path}`
      : "",
  };
}

function mapNote(note) {
  return {
    id: note.id,
    note: note.note || "",
    authorName: note.author_name || "",
    noteDate: note.note_date || null,
    callbackDate: toInputDate(note.callback_date),
    isCalled: Boolean(note.is_called),
    attachmentPath: note.attachment_path || "",
    attachmentUrl: note.attachment_path
      ? `/uploads/${note.attachment_path}`
      : "",
  };
}

function mapOrderDetail(
  row,
  payments = [],
  documents = [],
  workflowStages = [],
  notes = []
) {
  return {
    id: row.id,
    orderNumber: row.order_number || "",
    workflowStages: workflowStages.map(mapWorkflowStage),
    notes: notes.map(mapNote),
    facility: row.facility_id ? String(row.facility_id) : "",
    facilityName: row.facility_name || "",
    providerId: row.provider_id ? String(row.provider_id) : "",
    providerName: row.provider_name || "",
    type: row.order_type || "",
    status: row.status || "",
    court: row.court || "",
    caseNumber: row.case_number || "",
    orderRef: row.order_ref || "",
    ssn: "",
    dob: toInputDate(row.dob),

    firstName: row.applicant_first_name || "",
    middleName: row.applicant_middle_name || "",
    lastName: row.applicant_last_name || "",
    aka: row.applicant_aka || "",
    defendant: row.defendant || "",
    injuryType: row.injury_type || "",

    documentName: "",
    subpoenaFile: null,
    additionalDocumentFile: null,
    subpoenaStoragePath: row.subpoena_storage_path || null,
    subpoenaUrl: row.subpoena_storage_path
      ? `/uploads/${row.subpoena_storage_path}`
      : "",
    documents: documents.map(mapDocument),

    serveCompanyName: row.serve_company_name || "",
    address: row.serve_address || "",
    zip: row.serve_zip || "",
    city: row.serve_city || "",
    state: row.serve_state || "",
    phone: row.serve_phone || "",
    fax: row.serve_fax || "",
    email: row.serve_email || "",

    contact1Name: row.contact1_name || "",
    contact1Title: row.contact1_title || "",
    contact1Phone: row.contact1_phone || "",
    contact1Fax: row.contact1_fax || "",
    contact1Email: row.contact1_email || "",

    contact2Name: row.contact2_name || "",
    contact2Title: row.contact2_title || "",
    contact2Phone: row.contact2_phone || "",
    contact2Fax: row.contact2_fax || "",
    contact2Email: row.contact2_email || "",

    dateServed: toInputDate(row.date_served),
    depoDueDate: toInputDate(row.depo_due_date),
    deliveryDate: toInputDate(row.delivery_date),
    subpoenaDate: toInputDate(row.subpoena_date),
    readyDate: toInputDate(row.ready_date),
    invoiceDate: toInputDate(row.invoice_date),
    xrayInvoiceDate: toInputDate(row.xray_invoice_date),

    medicalRecords: Boolean(row.flag_medical_records),
    billingRecords: Boolean(row.flag_billing_records),
    employmentRecords: Boolean(row.flag_employment_records),
    xrays: Boolean(row.flag_xrays),
    otherRecord: Boolean(row.flag_other_record),

    specificRecord: row.specific_record || "",
    specificDoctor: row.specific_doctor || "",
    fullAddress: row.full_address || "",

    certificateNoRecords: Boolean(row.certificate_no_records),
    cnrReason: row.cnr_reason || "",
    cnrDelivery: row.cnr_delivery || "",
    cnrDateSent: toInputDate(row.cnr_date_sent),
    cnrMemo: Boolean(row.cnr_memo),

    ...mapPaymentsToForm(payments),
  };
}

async function getAllOrders(query = {}) {
  const filters = {};

  if (query.facility) {
    filters.facilityId = Number(query.facility);
  }

  if (query.status && STATUS_FILTER_MAP[query.status]) {
    filters.status = STATUS_FILTER_MAP[query.status];
  }

  if (query.year) {
    filters.year = query.year;
  }

  if (query.search && `${query.search}`.trim()) {
    filters.search = `${query.search}`.trim();
  }

  const rows = await Order.findAll(filters);

  const orderIds = rows.map((row) => row.id);
  const stages = await Order.findWorkflowStagesByOrderIds(orderIds);

  const stagesByOrderId = stages.reduce((acc, stage) => {
    if (!acc[stage.order_id]) acc[stage.order_id] = [];
    acc[stage.order_id].push(stage);
    return acc;
  }, {});

  return rows.map((row) => mapOrderListRow(row, stagesByOrderId[row.id] || []));
}

async function getOrderById(id) {
  const order = await Order.findById(id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const payments = await Order.findPaymentsByOrderId(order.id);
  const documents = await Order.findDocumentsByOrderId(order.id);
  const workflowStages = await Order.findWorkflowStagesByOrderId(order.id);
  const notes = await Order.findNotesByOrderId(order.id);
  return mapOrderDetail(order, payments, documents, workflowStages, notes);
}

async function resolveAuthorName(actorId) {
  if (!actorId) return "System";

  try {
    const employee = await Employee.findById(actorId);
    return employee?.name || "System";
  } catch {
    return "System";
  }
}

async function getOrderNotes(orderId) {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const notes = await Order.findNotesByOrderId(order.id, true);
  return notes.map(mapNote);
}

async function addOrderNote(orderId, data, actorId, file) {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const noteText = trimOrNull(data.note);

  if (!noteText) {
    throw new ApiError(400, "Note text is required");
  }

  const authorName = await resolveAuthorName(actorId);

  await Order.createNote({
    orderId: order.id,
    createdBy: actorId || null,
    authorName,
    note: noteText,
    callbackDate: dateOrNull(data.callbackDate),
    attachmentPath: toRelativeStoragePath(file),
    isCalled: 0,
  });

  const notes = await Order.findNotesByOrderId(order.id, true);
  return notes.map(mapNote);
}

async function updateOrderNote(orderId, noteId, data, actorId, file) {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const note = await Order.findNoteById(noteId);

  if (!note || String(note.order_id) !== String(order.id)) {
    throw new ApiError(404, "Note not found");
  }

  const noteText = trimOrNull(data.note);

  if (!noteText) {
    throw new ApiError(400, "Note text is required");
  }

  const authorName = await resolveAuthorName(actorId);
  const attachmentPath = toRelativeStoragePath(file);

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await Order.updateNote(connection, note.id, {
      note: noteText,
      callbackDate: dateOrNull(data.callbackDate),
      attachmentPath,
      isCalled: 1,
    });

    const updatedNote = await Order.findNoteById(note.id, connection);

    await Order.createActivityLog(connection, {
      orderId: order.id,
      activityDate: new Date(),
      performedBy: actorId || null,
      authorName,
      callbackDate: dateOrNull(data.callbackDate) || updatedNote?.callback_date || null,
      note: noteText,
      attachmentPath: updatedNote?.attachment_path || null,
    });

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  const notes = await Order.findNotesByOrderId(order.id, true);
  const activityLogs = await Order.findActivityLogsByOrderId(order.id);

  return {
    notes: notes.map(mapNote),
    activityLogs: activityLogs.map(mapActivityLog),
  };
}

async function getOrderActivityLogs(orderId) {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const logs = await Order.findActivityLogsByOrderId(order.id);
  const notes = await Order.findNotesByOrderId(order.id, false);

  return logs.map((log) => {
    let attachmentPath = log.attachment_path;

    if (!attachmentPath) {
      const match = notes.find(
        (note) =>
          note.is_called &&
          note.attachment_path &&
          normalizeNoteText(note.note) === normalizeNoteText(log.note)
      );

      if (match) {
        attachmentPath = match.attachment_path;
      }
    }

    return mapActivityLog({ ...log, attachment_path: attachmentPath });
  });
}

async function getWorkflowStages(orderId) {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  let stages = await Order.findWorkflowStagesByOrderId(order.id);

  // Backfill stages for orders created before this feature existed.
  if (stages.length === 0) {
    const pool = getPool();
    const connection = await pool.getConnection();
    try {
      await Order.seedWorkflowStages(connection, order.id);
    } finally {
      connection.release();
    }
    stages = await Order.findWorkflowStagesByOrderId(order.id);
  }

  return stages.map(mapWorkflowStage);
}

async function updateOrderWorkflowStage(orderId, stageName, stageStatus) {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (!WORKFLOW_STAGE_NAMES.includes(stageName)) {
    throw new ApiError(400, "Invalid workflow stage");
  }

  if (!WORKFLOW_STAGE_STATUSES.includes(stageStatus)) {
    throw new ApiError(400, "Invalid workflow stage status");
  }

  const completedAt =
    stageStatus === "complete" || stageStatus === "sent"
      ? new Date()
      : null;

  await Order.upsertWorkflowStage(order.id, stageName, stageStatus, completedAt);

  const stages = await Order.findWorkflowStagesByOrderId(order.id);
  return stages.map(mapWorkflowStage);
}

async function saveOrderDocuments(
  connection,
  { orderId, additionalDocFile, documentName, actorId }
) {
  // A subpoena uploaded with an order is stored directly on the order
  // (orders.subpoena_storage_path). The unprocessed_subpoenas table is
  // reserved for batch-scan parents (order_id NULL, children linked via
  // batch_scan_extracts), so no row is created here.
  if (additionalDocFile) {
    await Order.createAdditionalDocument(connection, {
      orderId,
      documentName: trimOrNull(documentName) || additionalDocFile.originalname,
      originalFileName: additionalDocFile.originalname,
      mimeType: additionalDocFile.mimetype || null,
      storagePath: toRelativeStoragePath(additionalDocFile),
      fileSizeBytes: additionalDocFile.size || null,
      uploadedBy: actorId || null,
    });
  }
}

async function resolveOrderNumber(rawOrderNumber, excludeId = null) {
  let orderNumber = trimOrNull(rawOrderNumber) || generateOrderNumber();

  const existing = await Order.findByOrderNumber(orderNumber, excludeId);

  if (existing) {
    throw new ApiError(409, "An order with this order number already exists");
  }

  return orderNumber;
}

async function resolveProviderId(connection, data) {
  const companyName = trimOrNull(data.serveCompanyName);

  if (!companyName) {
    return data.providerId ? Number(data.providerId) : null;
  }

  if (data.providerId) {
    const selected = await Provider.findById(Number(data.providerId), connection);
    if (
      selected &&
      selected.company_name.toLowerCase().trim() === companyName.toLowerCase()
    ) {
      return selected.id;
    }
  }

  const existing = await Provider.findByCompanyName(companyName, connection);
  if (existing) {
    return existing.id;
  }

  return Provider.create(connection, {
    companyName,
    address: trimOrNull(data.address),
    zipCode: trimOrNull(data.zip),
    city: trimOrNull(data.city),
    state: trimOrNull(data.state),
    phone: trimOrNull(data.phone),
    fax: trimOrNull(data.fax),
    email: trimOrNull(data.email),
  });
}

async function createOrder(data, actorId, files) {
  const facility = await Facility.findById(Number(data.facility));

  if (!facility) {
    throw new ApiError(400, "Selected facility does not exist");
  }

  const orderNumber = await resolveOrderNumber(data.orderNumber);
  const payments = collectPayments(data);

  const subpoenaFile = getUploadedFile(files, "subpoenaFile");
  const additionalDocFile = getUploadedFile(files, "additionalDocumentFile");
  const subpoenaStoragePath = toRelativeStoragePath(subpoenaFile);

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const providerId = await resolveProviderId(connection, data);
    const payload = buildOrderDbPayload({ ...data, providerId });

    const orderId = await Order.create(connection, {
      ...payload,
      subpoenaStoragePath,
      orderNumber,
      status: "Active",
      hasNote: 0,
      hasSubpoena: subpoenaStoragePath ? 1 : payload.hasSubpoena,
      createdBy: actorId || null,
    });

    for (const payment of payments) {
      await Order.upsertPayment(connection, { ...payment, orderId });
    }

    await saveOrderDocuments(connection, {
      orderId,
      additionalDocFile,
      documentName: data.documentName,
      actorId,
    });

    await Order.seedWorkflowStages(connection, orderId);

    await connection.commit();

    return getOrderById(orderId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateOrder(id, data, actorId, files) {
  const existing = await Order.findById(id);

  if (!existing) {
    throw new ApiError(404, "Order not found");
  }

  const facility = await Facility.findById(Number(data.facility));

  if (!facility) {
    throw new ApiError(400, "Selected facility does not exist");
  }

  const orderNumber = await resolveOrderNumber(
    data.orderNumber || existing.order_number,
    existing.id
  );
  const payments = collectPayments(data);

  const subpoenaFile = getUploadedFile(files, "subpoenaFile");
  const additionalDocFile = getUploadedFile(files, "additionalDocumentFile");
  const newSubpoenaPath = toRelativeStoragePath(subpoenaFile);
  const subpoenaStoragePath =
    newSubpoenaPath || existing.subpoena_storage_path || null;

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const providerId = await resolveProviderId(connection, data);
    const payload = buildOrderDbPayload({ ...data, providerId });

    await Order.update(connection, existing.id, {
      ...payload,
      subpoenaStoragePath,
      hasSubpoena: subpoenaStoragePath ? 1 : payload.hasSubpoena,
      orderNumber,
    });

    for (const payment of payments) {
      await Order.upsertPayment(connection, {
        ...payment,
        orderId: existing.id,
      });
    }

    await saveOrderDocuments(connection, {
      orderId: existing.id,
      additionalDocFile,
      documentName: data.documentName,
      actorId,
    });

    await connection.commit();

    return getOrderById(existing.id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteOrder(id) {
  const existing = await Order.findById(id);

  if (!existing) {
    throw new ApiError(404, "Order not found");
  }

  await Order.deleteById(existing.id);

  return { message: "Order deleted successfully" };
}

module.exports = {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  getOrderNotes,
  addOrderNote,
  updateOrderNote,
  getOrderActivityLogs,
  getWorkflowStages,
  updateOrderWorkflowStage,
};
