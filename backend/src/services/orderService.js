/**
 * Order business logic — called by orderController.
 */

const ApiError = require("../utils/ApiError");
const { rethrowServiceError } = require("../utils/serviceErrorUtils");
const fs = require("fs");
const path = require("path");
const Order = require("../models/Order");
const FacilityDoctor = require("../models/FacilityDoctor");
const OrderRecord = require("../models/OrderRecord");
const Facility = require("../models/Facility");
const Provider = require("../models/Provider");
const { buildProviderPayload, findOrCreateProvider, resolveProviderFromHints } = require("./providerService");
const {
  findOrCreateFacility,
  isFacilityProfileIncomplete,
} = require("./facilityService");
const { normalizeFacilityName } = require("../utils/facilityNameUtils");
const Employee = require("../models/Employee");
const ActivityLog = require("../models/ActivityLog");
const { stripOrderIdTag, mapLogRow } = require("./activityLogService");
const invoiceService = require("./invoiceService");
const Invoice = require("../models/Invoice");
const InvoiceXray = require("../models/InvoiceXray");
const PersonalRequestOrder = require("../models/PersonalRequestOrder");
const {
  areAllOrderInvoicesWrittenOffFromRows,
} = require("../utils/orderInvoicePayment");
const { getPool } = require("../config/database");
const { sanitizeText, sanitizeSearchText } = require("../utils/sanitize");
const {
  assertPositiveInt,
  parseOptionalIsoDate,
} = require("../utils/sqlSafety");
const {
  assertReportDateRange,
  RUSH_LEVEL_VALUES,
  parseReportPageSize,
  parseOptionalCursor,
} = require("../lib/reportQueryParser");
const { FIELD_LIMITS } = require("../utils/fieldLimits");
const { toRelativeStoragePath, ORDER_UPLOADS_ROOT } = require("../middleware/uploadMiddleware");
const { calculateOrderRushLevel, RUSH_READY_MIN_DAYS } = require("../utils/rushUtils");
const batchScanRepository = require("../repositories/batchScanRepository");
const {
  buildOrderPayloadFromExtractRow,
} = require("../utils/extractToOrderPayload");
const {
  computeMissingRequiredFields,
  mapOrderRowToRequiredFieldData,
} = require("../utils/orderRequiredFields");
const logger = require("../utils/logger");
const fileStorage = require("../utils/fileStorage");
const {
  toInputDate,
  toSqlDateOnly,
  toShortDate,
  toSlashDateLong,
  formatDobDisplay,
  extractYear,
  formatSsnLastFourDisplay,
} = require("../utils/dateUtils");
const { resolveOrderPeriodStartDate } = require("../utils/orderPeriodFilter");

const WORKFLOW_STAGE_NAMES = [
  "Review Records",
  "Serve",
  "Custodian",
  "SENT",
];
const WORKFLOW_STAGE_STATUSES = ["pending", "complete", "failed", "sent"];
const DEFAULT_PREPAYMENT_CHARGE = 15;
const DEFAULT_CUSTODIAN_CHARGE = 15;
const STATUS_FILTER_MAP = {
  active: "Active",
  ready_pickup: "Ready to Pickup",
  completed: "Completed",
  cancelled: "Cancelled",
  deleted: "Deleted",
  writeoffs: "Write Offs",
};

const ALLOWED_INJURY_TYPES = ["specific", "cumulative"];
const ALLOWED_CNR_DELIVERY = ["email", "fax", "pickup"];

function parseBoolean(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "yes" ||
      normalized === "on"
    );
  }
  return Boolean(value);
}

function isCnrOrder(data = {}) {
  return (
    parseBoolean(data.certificateNoRecords) ||
    parseBoolean(data.certificate_no_records)
  );
}

function assertValidCnrDeliveryDate(data = {}) {
  if (!isCnrOrder(data)) {
    return;
  }

  if (
    ALLOWED_CNR_DELIVERY.includes(data.cnrDelivery) &&
    !dateOrNull(data.cnrDateSent)
  ) {
    throw new ApiError(400, "CNR date is required for the selected delivery method");
  }
}

const PAYMENT_PREFIXES = ["prepayment", "custodian", "xray"];

const RECORD_TITLES = {
  medical: "Medical Records",
  billing: "Billing Records",
  employment: "Employment Records",
  xrays: "X-Ray Films",
  other: "Other",
};

const VALID_RECORD_TYPES = ["medical", "billing", "employment", "xrays", "other"];

const RECORD_TYPE_FLAG_MAP = {
  medical: "medicalRecords",
  billing: "billingRecords",
  employment: "employmentRecords",
  xrays: "xrays",
  other: "otherRecord",
};

function resolveRecordTypesFromForm(data = {}) {
  const types = [];

  for (const recordType of VALID_RECORD_TYPES) {
    const flagKey = RECORD_TYPE_FLAG_MAP[recordType];
    if (parseBoolean(data[flagKey])) {
      types.push(recordType);
    }
  }

  if (!types.length && data.type) {
    types.push(data.type === "other" ? "other" : data.type);
  }

  return [...new Set(types.filter((type) => VALID_RECORD_TYPES.includes(type)))];
}

function mapOrderRecordRow(row = {}) {
  return {
    id: row.id,
    recordType: row.record_type,
    storagePath: row.storage_path || null,
    storageUrl: buildSubpoenaUrl(row.storage_path),
    uploadedAt: row.uploaded_at || null,
    hasFile: Boolean(row.storage_path),
  };
}

function mapOrderRecords(rows = []) {
  return rows.map(mapOrderRecordRow);
}

function getPrimaryRecordType(orderRecords = []) {
  return orderRecords[0]?.record_type || "";
}

function resolveOrderTypeForForm(_row, orderRecords = []) {
  const types = orderRecords.map((row) => row.record_type);
  if (types.length === 1) {
    return types[0];
  }
  return getPrimaryRecordType(orderRecords);
}

function hasAnyRecordsRequested(orderRecords = []) {
  return orderRecords.length > 0;
}

function allOrderRecordsUploaded(orderRecords = []) {
  if (!orderRecords.length) return false;
  return orderRecords.every((row) => Boolean(row.storage_path));
}

function anyOrderRecordUploaded(orderRecords = []) {
  return orderRecords.some((row) => Boolean(row.storage_path));
}

const DEFAULT_ORDER_FORMS = [
  "Send Copy/Letter",
  "Certification of Records",
  "CNR",
];

function trimOrNull(value, options = {}) {
  if (value === undefined || value === null) return null;
  const sanitized = sanitizeText(value, {
    maxLength: options.maxLength || 4000,
    allowEmpty: true,
  });
  return sanitized === "" ? null : sanitized;
}

function dateOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  return toSqlDateOnly(value);
}

function boolToInt(value) {
  return parseBoolean(value) ? 1 : 0;
}

function readHasSubpoena(row = {}) {
  return Boolean(Number(row.has_subpoena ?? row.is_subpoena));
}

function readIsWriteOffs(row = {}) {
  return row.status === "Write Offs";
}

function resolveOrderWriteOffState(row, invoiceRow, xrayRow) {
  const isWriteOffs = areAllOrderInvoicesWrittenOffFromRows(invoiceRow, xrayRow);
  let status = row.status || "Active";

  if (isWriteOffs && status !== "Completed") {
    status = "Write Offs";
  } else if (!isWriteOffs && status === "Write Offs") {
    status = "Active";
  }

  return {
    isWriteOffs,
    status,
    displayStatus: deriveDisplayOrderStatus(status, row.created_at),
    filterStatus:
      isWriteOffs && status !== "Completed"
        ? "writeoffs"
        : deriveFilterStatus(status),
  };
}

function resolveOrderFlags(data, hasSubpoenaFile) {
  return {
    hasSubpoena: hasSubpoenaFile ? 1 : 0,
  };
}

function enumOrNull(value, allowed) {
  const trimmed = trimOrNull(value);
  if (!trimmed) return null;
  return allowed.includes(trimmed) ? trimmed : null;
}

function ssnLastFour(ssn) {
  const trimmed = `${ssn || ""}`.trim();
  const masked = trimmed.match(/^XXX-XX-(\d{4})$/i);

  if (masked) {
    return masked[1];
  }

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 4) return null;

  return digits.slice(-4).padStart(4, "0");
}

function buildFullName(first, middle, last) {
  return [first, middle, last].filter(Boolean).join(" ").trim();
}

function formatDoiDisplay(row) {
  if (!row) return "";

  if (row.injury_type === "specific" && row.injury_date) {
    return toShortDate(row.injury_date);
  }

  if (row.injury_type === "cumulative" && row.injury_date_begin) {
    const start = toShortDate(row.injury_date_begin);
    const end = row.injury_date_end ? toShortDate(row.injury_date_end) : "";
    return end ? `${start} - ${end}` : start;
  }

  return "";
}

function hasDoi(row) {
  return Boolean(formatDoiDisplay(row));
}

function hasInjuryPayload(data = {}) {
  const injuryType = trimOrNull(data.injuryType);
  if (!injuryType) return false;

  if (injuryType === "specific") {
    return Boolean(trimOrNull(data.injuryDate));
  }

  return Boolean(trimOrNull(data.injuryDateBegin) || trimOrNull(data.injuryDateEnd));
}

function applyInjuryFromExtract(data = {}, extract = null) {
  if (!extract || hasInjuryPayload(data)) {
    return data;
  }

  const {
    resolveExtractionSchema,
    mapSchemaToExtractRow,
  } = require("../utils/extractionMapper");

  let injuryDate = extract.date_of_injury ? toInputDate(extract.date_of_injury) : "";

  if (!injuryDate && extract.raw_extraction) {
    const raw =
      typeof extract.raw_extraction === "string"
        ? JSON.parse(extract.raw_extraction || "{}")
        : extract.raw_extraction;
    const mapped = mapSchemaToExtractRow(resolveExtractionSchema(raw));
    injuryDate = mapped.date_of_injury ? toInputDate(mapped.date_of_injury) : "";
  }

  if (!injuryDate) {
    return data;
  }

  return {
    ...data,
    injuryType: "specific",
    injuryDate,
    injuryDateBegin: "",
    injuryDateEnd: "",
  };
}

function buildInjuryDatePayload(data) {
  const injuryType = enumOrNull(data.injuryType, ALLOWED_INJURY_TYPES);

  if (injuryType === "specific") {
    return {
      injuryDate: dateOrNull(data.injuryDate),
      injuryDateBegin: null,
      injuryDateEnd: null,
    };
  }

  if (injuryType === "cumulative") {
    return {
      injuryDate: null,
      injuryDateBegin: dateOrNull(data.injuryDateBegin),
      injuryDateEnd: dateOrNull(data.injuryDateEnd),
    };
  }

  return {
    injuryDate: null,
    injuryDateBegin: null,
    injuryDateEnd: null,
  };
}

function buildSubpoenaUrl(storagePath) {
  const normalized = String(storagePath || "").replace(/\\/g, "/");
  if (!normalized) return "";

  if (fileStorage.isUploadsRelativePath(normalized)) {
    return `/uploads/${normalized}`;
  }

  return "";
}

function resolveOrderSubpoenaAbsolutePath(storagePath) {
  const normalized = String(storagePath || "").replace(/\\/g, "/");
  if (!normalized) return null;

  if (fileStorage.isUploadsRelativePath(normalized)) {
    return path.join(ORDER_UPLOADS_ROOT, normalized);
  }

  return fileStorage.resolveAbsolutePath(normalized);
}

function buildOrderDbPayload(data) {
  return {
    facilityId: Number(data.facility),
    providerId: data.providerId ? Number(data.providerId) : null,
    court: trimOrNull(data.court) || "WCAB",
    caseNumber: trimOrNull(data.caseNumber),
    recNumber: trimOrNull(data.recNumber),
    orderRef: trimOrNull(data.orderRef),
    ssnLastFour: ssnLastFour(data.ssn),
    dob: dateOrNull(data.dob),
    applicantFirstName: trimOrNull(data.firstName),
    applicantMiddleName: trimOrNull(data.middleName),
    applicantLastName: trimOrNull(data.lastName),
    applicantAka: trimOrNull(data.aka),
    defendant: trimOrNull(data.defendant),
    injuryType: enumOrNull(data.injuryType, ALLOWED_INJURY_TYPES),
    ...buildInjuryDatePayload(data),
    serveCompanyName: trimOrNull(data.serveCompanyName, { maxLength: FIELD_LIMITS.VARCHAR_255 }),
    serveAddress: trimOrNull(data.address, { maxLength: FIELD_LIMITS.VARCHAR_255 }),
    serveZip: trimOrNull(data.zip, { maxLength: 20 }),
    serveCity: trimOrNull(data.city, { maxLength: FIELD_LIMITS.VARCHAR_100 }),
    serveState: trimOrNull(data.state, { maxLength: 2 }),
    servePhone: trimOrNull(data.phone, { maxLength: 20 }),
    serveFax: trimOrNull(data.fax, { maxLength: 20 }),
    serveEmail: trimOrNull(data.email, { maxLength: FIELD_LIMITS.VARCHAR_255 }),
    contact1Name: trimOrNull(data.contact1Name, { maxLength: FIELD_LIMITS.VARCHAR_150 }),
    contact1Title: trimOrNull(data.contact1Title, { maxLength: FIELD_LIMITS.VARCHAR_100 }),
    contact1Phone: trimOrNull(data.contact1Phone, { maxLength: 20 }),
    contact1Fax: trimOrNull(data.contact1Fax, { maxLength: 20 }),
    contact1Email: trimOrNull(data.contact1Email, { maxLength: FIELD_LIMITS.VARCHAR_255 }),
    contact2Name: trimOrNull(data.contact2Name, { maxLength: FIELD_LIMITS.VARCHAR_150 }),
    contact2Title: trimOrNull(data.contact2Title, { maxLength: FIELD_LIMITS.VARCHAR_100 }),
    contact2Phone: trimOrNull(data.contact2Phone, { maxLength: 20 }),
    contact2Fax: trimOrNull(data.contact2Fax, { maxLength: 20 }),
    contact2Email: trimOrNull(data.contact2Email, { maxLength: FIELD_LIMITS.VARCHAR_255 }),
    dateServed: dateOrNull(data.dateServed),
    depoDueDate: dateOrNull(data.depoDueDate),
    deliveryDate: dateOrNull(data.deliveryDate),
    subpoenaDate: dateOrNull(data.subpoenaDate),
    dateRequested: dateOrNull(data.dateRequested),
    readyDate: dateOrNull(data.readyDate),
    invoiceDate: dateOrNull(data.invoiceDate),
    xrayInvoiceDate: dateOrNull(data.xrayInvoiceDate),
    specificRecord: trimOrNull(data.specificRecord, { maxLength: FIELD_LIMITS.VARCHAR_255 }),
    specificDoctor: trimOrNull(data.specificDoctor, { maxLength: FIELD_LIMITS.VARCHAR_200 }),
    specificDoctorIsDefault: boolToInt(data.specificDoctorIsDefault),
    fullAddress: trimOrNull(data.fullAddress, { maxLength: FIELD_LIMITS.TEXT }),
    certificateNoRecords: boolToInt(data.certificateNoRecords),
    cnrReason: trimOrNull(data.cnrReason, { maxLength: FIELD_LIMITS.TEXT }),
    cnrDelivery: enumOrNull(data.cnrDelivery, ALLOWED_CNR_DELIVERY),
    cnrDateSent: dateOrNull(data.cnrDateSent),
    cnrMemo: boolToInt(data.cnrMemo),
    subpoenaStoragePath: null,
    creationSource:
      data.creationSource === "auto"
        ? "auto"
        : data.creationSource === "personal_portal"
          ? "personal_portal"
          : "manual",
  };
}

function getUploadedFile(files, field) {
  if (!files) return null;
  const entry = files[field];
  if (Array.isArray(entry)) return entry[0] || null;
  return entry || null;
}

function parsePaymentAmount(value) {
  const amount = Number(`${value ?? ""}`.replace(/[^\d.]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

function getPrepaymentPayment(payments = []) {
  return getPaymentByType(payments, "prepayment");
}

function getPaymentByType(payments = [], paymentType) {
  return payments.find((payment) => payment.paymentType === paymentType) || null;
}

async function syncOrderWorkflowFromState(
  connection,
  orderId,
  {
    payments = [],
    invoiceServiceFee = 0,
    invoiceCustodianFee = 0,
    skipCustodian = false,
    resolvedCustodianDue = null,
    invoiceRow = null,
  } = {}
) {
  const prepayment = getPrepaymentPayment(payments);
  const paidAmount = parsePaymentAmount(prepayment?.amount);

  let chargeAmount = parsePaymentAmount(invoiceServiceFee);
  if (chargeAmount <= 0) {
    chargeAmount = DEFAULT_PREPAYMENT_CHARGE;
  }

  if (chargeAmount > 0 && paidAmount >= chargeAmount) {
    await Order.upsertWorkflowStage(
      orderId,
      "Serve",
      "complete",
      new Date(),
      connection
    );
  } else {
    await Order.upsertWorkflowStage(
      orderId,
      "Serve",
      "pending",
      null,
      connection
    );
  }

  const custodian = getPaymentByType(payments, "custodian");
  const custodianPaid = parsePaymentAmount(custodian?.amount);
  const custodianDue = parsePaymentAmount(custodian?.dueAmount);
  const custodianDueAmount =
    resolvedCustodianDue !== null && resolvedCustodianDue !== undefined
      ? parsePaymentAmount(resolvedCustodianDue)
      : custodianDue;
  const custodianCharge = DEFAULT_CUSTODIAN_CHARGE;

  if (!skipCustodian) {
    const custodianIsComplete =
      custodianCharge > 0 &&
      (custodianPaid >= custodianCharge ||
        (custodianDueAmount <= 0 && custodianPaid > 0));

    if (custodianIsComplete) {
      await Order.upsertWorkflowStage(
        orderId,
        "Custodian",
        "complete",
        new Date(),
        connection
      );
    } else {
      await Order.upsertWorkflowStage(
        orderId,
        "Custodian",
        "pending",
        null,
        connection
      );
    }
  }
}

async function markOrderWorkflowSent(orderId, connection = null) {
  await Order.upsertWorkflowStage(
    orderId,
    "SENT",
    "sent",
    new Date(),
    connection
  );
}

function buildPaymentPayload(data, prefix) {
  const checkNumber = trimOrNull(data[`${prefix}Check`]);
  const paymentDate = dateOrNull(data[`${prefix}Date`]);
  const rawAmount = trimOrNull(data[`${prefix}Paid`]);
  const rawDue = trimOrNull(data[`${prefix}Due`]);
  const memo = trimOrNull(data[`${prefix}Memo`]);

  if (!checkNumber && !paymentDate && !rawAmount && !rawDue && !memo) {
    return null;
  }

  const amount = rawAmount !== null ? Number(rawAmount) : null;
  const dueAmount = rawDue !== null ? Number(rawDue) : null;

  return {
    paymentType: prefix,
    checkNumber,
    paymentDate,
    amount: Number.isNaN(amount) ? null : amount,
    dueAmount: Number.isNaN(dueAmount) ? null : dueAmount,
    isPaid: amount && amount > 0 ? 1 : 0,
    memo,
  };
}

function collectPayments(data) {
  const prefixes = isCnrOrder(data)
    ? PAYMENT_PREFIXES.filter((prefix) => prefix !== "custodian")
    : PAYMENT_PREFIXES;

  return prefixes
    .map((prefix) => buildPaymentPayload(data, prefix))
    .filter(Boolean);
}

function resolvePrepaymentDueAmount(data) {
  const paid = parsePaymentAmount(trimOrNull(data.prepaymentPaid));
  const rawDue = trimOrNull(data.prepaymentDue);

  if (rawDue !== null) {
    const due = Number(rawDue);
    if (!Number.isNaN(due)) {
      return Math.max(0, due);
    }
  }

  return Math.max(0, DEFAULT_PREPAYMENT_CHARGE - paid);
}

async function ensurePrepaymentPayment(connection, orderId, data) {
  const payment = buildPaymentPayload(data, "prepayment");
  const dueAmount = resolvePrepaymentDueAmount(data);
  const paid = parsePaymentAmount(trimOrNull(data.prepaymentPaid));

  if (payment) {
    await Order.upsertPayment(connection, {
      ...payment,
      orderId,
      dueAmount: payment.dueAmount ?? dueAmount,
    });
    return;
  }

  await Order.upsertPayment(connection, {
    orderId,
    paymentType: "prepayment",
    checkNumber: null,
    paymentDate: null,
    amount: paid > 0 ? paid : null,
    dueAmount,
    isPaid: paid > 0 ? 1 : 0,
    memo: null,
  });
}

async function ensureCustodianPayment(connection, orderId, data) {
  if (isCnrOrder(data)) {
    return;
  }

  const payment = buildPaymentPayload(data, "custodian");
  const dueAmount = resolveCustodianDueAmount(data);
  const paid = parsePaymentAmount(trimOrNull(data.custodianPaid));

  if (payment) {
    await Order.upsertPayment(connection, {
      ...payment,
      orderId,
      dueAmount: payment.dueAmount ?? dueAmount,
    });
    return;
  }

  await Order.upsertPayment(connection, {
    orderId,
    paymentType: "custodian",
    checkNumber: null,
    paymentDate: null,
    amount: paid > 0 ? paid : null,
    dueAmount,
    isPaid: paid > 0 ? 1 : 0,
    memo: null,
  });
}

function resolveCustodianDueAmount(data) {
  const paid = parsePaymentAmount(trimOrNull(data.custodianPaid));
  const rawDue = trimOrNull(data.custodianDue);

  if (rawDue !== null) {
    const due = Number(rawDue);
    if (!Number.isNaN(due)) {
      return Math.max(0, due);
    }
  }

  return Math.max(0, DEFAULT_CUSTODIAN_CHARGE - paid);
}

async function syncOrderPayments(connection, orderId, data) {
  const prefixes = isCnrOrder(data)
    ? PAYMENT_PREFIXES.filter((prefix) => prefix !== "custodian")
    : PAYMENT_PREFIXES;

  for (const prefix of prefixes) {
    const payment = buildPaymentPayload(data, prefix);

    if (payment) {
      await Order.upsertPayment(connection, { ...payment, orderId });
    } else {
      await Order.deletePaymentByType(connection, orderId, prefix);
    }
  }

  if (isCnrOrder(data)) {
    await Order.deletePaymentByType(connection, orderId, "custodian");
  }

  await ensurePrepaymentPayment(connection, orderId, data);

  if (!isCnrOrder(data)) {
    await ensureCustodianPayment(connection, orderId, data);
  }

  await invoiceService.syncOrderPaymentDuesFromInvoice(connection, orderId, {
    skipCustodian: isCnrOrder(data),
  });
}

function mapPaymentsToForm(payments = []) {
  const formFields = {
    prepaymentCheck: "",
    prepaymentDate: "",
    prepaymentPaid: "",
    prepaymentDue: "",
    prepaymentMemo: "",
    custodianCheck: "",
    custodianDate: "",
    custodianPaid: "",
    custodianDue: "",
    custodianMemo: "",
    xrayCheck: "",
    xrayDate: "",
    xrayPaid: "",
    xrayDue: "",
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
    formFields[`${prefix}Due`] =
      payment.due_amount !== null && payment.due_amount !== undefined
        ? String(payment.due_amount)
        : "";
    formFields[`${prefix}Memo`] = payment.memo || "";
  });

  return formFields;
}

function enrichPaymentDueFields(paymentForm, invoiceRow, xrayRow, payments = []) {
  const invoiceFees = invoiceService.mapOrderInvoiceFees(
    invoiceRow,
    xrayRow,
    payments
  );
  const prepaymentPaid = parsePaymentAmount(paymentForm.prepaymentPaid);
  paymentForm.prepaymentDue = Math.max(
    0,
    DEFAULT_PREPAYMENT_CHARGE - prepaymentPaid
  ).toFixed(2);

  const custodianPaid = parsePaymentAmount(paymentForm.custodianPaid);
  paymentForm.custodianDue = Math.max(
    0,
    DEFAULT_CUSTODIAN_CHARGE - custodianPaid
  ).toFixed(2);

  const targets = [
    ["xray", invoiceFees.hasXrayInvoice, Number(invoiceFees.xrayFee) || 0],
  ];

  targets.forEach(([prefix, hasFee, fee]) => {
    const paid = parsePaymentAmount(paymentForm[`${prefix}Paid`]);

    if (hasFee && fee > 0) {
      paymentForm[`${prefix}Due`] = Math.max(0, fee - paid).toFixed(2);
      return;
    }

    if (paymentForm[`${prefix}Due`] === "") {
      paymentForm[`${prefix}Due`] = "0";
    }
  });

  return paymentForm;
}

function deriveDisplayOrderStatus(status, createdAt) {
  if (status === "Ready" || status === "Ready to Pickup") {
    return status;
  }

  const rush = calculateOrderRushLevel(createdAt);
  if (status === "Active" && rush.level >= 2) {
    return "Ready";
  }

  return status || "Active";
}

function deriveFilterStatus(status) {
  if (status === "Completed") return "completed";
  if (status === "Cancelled") return "cancelled";
  if (status === "Deleted") return "deleted";
  if (status === "Write Offs") return "writeoffs";
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
    emailAddress:
      trimOrNull(row.serve_email) ||
      trimOrNull(row.provider_email) ||
      trimOrNull(row.contact1_email) ||
      trimOrNull(row.contact2_email) ||
      "",
    faxNumber:
      trimOrNull(row.serve_fax) ||
      trimOrNull(row.contact1_fax) ||
      trimOrNull(row.contact2_fax) ||
      "",
  };
}

function buildFacilityBlock(row) {
  const addressLines = [];

  if (row.facility_address) {
    addressLines.push(row.facility_address);
  }

  const cityStateZip = [
    row.facility_city,
    [row.facility_state, row.facility_zip].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");

  if (cityStateZip) {
    addressLines.push(cityStateZip);
  }

  return {
    name: row.facility_name || "",
    address: addressLines.join(", "),
    addressLines,
  };
}

function normalizeCaptionText(value) {
  const text = trimOrNull(value);
  if (!text) return "";

  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function buildRecordsBlock(row, orderRecords = []) {
  const mappedRecords = mapOrderRecords(orderRecords);
  const primaryType = getPrimaryRecordType(orderRecords);
  const title = RECORD_TITLES[primaryType] || "Records";

  const requestedTypes = [
    ...new Map(
      orderRecords.map((record) => [
        record.record_type,
        RECORD_TITLES[record.record_type] || record.record_type,
      ])
    ),
  ].map(([type, label]) => ({ type, label }));

  const caption = normalizeCaptionText(row.specific_record);
  const dateRangeStart = toSlashDateLong(row.date_requested);
  const dateRange = dateRangeStart ? `${dateRangeStart} - Present` : "";

  const lines = [];

  const uploadedRecords = mappedRecords.filter((record) => record.hasFile);
  const hasMedicalRecords = allOrderRecordsUploaded(orderRecords);

  const hasCnr = Boolean(Number(row.certificate_no_records));
  const cnrReason = trimOrNull(row.cnr_reason) || "";

  return {
    title,
    lines,
    requestedTypes,
    caption,
    dateRange,
    specificDoctor: row.specific_doctor || "",
    links: [],
    hasMedicalRecords,
    allRecordsUploaded: hasMedicalRecords,
    anyRecordsUploaded: anyOrderRecordUploaded(orderRecords),
    orderRecords: mappedRecords,
    medicalRecordsUrl: uploadedRecords[0]?.storageUrl || null,
    cnrNote:
      hasCnr && !Number(row.cnr_memo)
        ? {
            label: "CNR Note",
            text: cnrReason,
            hasNote: true,
          }
        : null,
  };
}

function deriveInvoiceDisplayStatus(invoiceRow) {
  if (!invoiceRow) {
    return "Pending";
  }

  return invoiceRow.status || "Unpaid";
}

function mapOrderListRow(
  row,
  workflowStages = [],
  invoiceRow = null,
  xrayRow = null,
  orderPayments = [],
  orderRecords = [],
  extras = {}
) {
  const orderYear = extractYear(row.subpoena_date) || extractYear(row.created_at) || "";
  const dob = formatDobDisplay(row.dob);
  const ssn = formatSsnLastFourDisplay(row.ssn_last_four);
  const doiDisplay = formatDoiDisplay(row);
  const dobSsn = [dob, ssn, doiDisplay].filter(Boolean);

  const rush = calculateOrderRushLevel(row.created_at);
  const writeOffState = resolveOrderWriteOffState(row, invoiceRow, xrayRow);

  const mapped = {
    id: row.order_number,
    dbId: row.id,
    facility: row.facility_id ? String(row.facility_id) : "",
    facilityName: row.facility_name || "",
    doctor: row.specific_doctor || "",
    facilityInfo: buildFacilityBlock(row),
    year: orderYear,
    status: writeOffState.status,
    statusBeforeInactive: row.status_before_inactive || "",
    cancelReason: row.cancel_reason || "",
    cancelledAt: row.cancelled_at || null,
    deletedAt: row.deleted_at || null,
    displayStatus: writeOffState.displayStatus,
    filterStatus: writeOffState.filterStatus,
    workflowStages: workflowStages.map(mapWorkflowStage),
    note: Boolean(row.has_note),
    subpoena: readHasSubpoena(row),
    isSubpoena: readHasSubpoena(row),
    hasSubpoenaFile: Boolean(row.subpoena_storage_path),
    subpoenaUrl: buildSubpoenaUrl(row.subpoena_storage_path),
    isRecords: hasAnyRecordsRequested(orderRecords),
    isWriteOffs: writeOffState.isWriteOffs,
    court: row.court || "",
    applicant: buildFullName(
      row.applicant_first_name,
      row.applicant_middle_name,
      row.applicant_last_name
    ),
    caseNumber: row.case_number || "",
    recNumber: row.rec_number || "",
    orderRef: row.order_ref || "",
    providerName: row.serve_company_name || row.provider_name || "",
    providerEmail: trimOrNull(row.provider_email) || "",
    subpoenaDate: toInputDate(row.subpoena_date),
    subpoenaDateDisplay: toShortDate(row.subpoena_date),
    dateServed: toInputDate(row.date_served),
    dateServedDisplay: toShortDate(row.date_served),
    dateRequested: toInputDate(row.date_requested),
    dateRequestedDisplay: toShortDate(row.date_requested),
    createdAt: row.created_at || null,
    rushLevel: rush.level,
    rushLabel: rush.label,
    invoiceStatus: deriveInvoiceDisplayStatus(invoiceRow),
    records: buildRecordsBlock(row, orderRecords),
    company: buildCompanyBlock(row),
    dob,
    ssn,
    dobSsn,
    doiDisplay,
    hasDoi: hasDoi(row),
    forms: DEFAULT_ORDER_FORMS,
    invoice: invoiceService.mapOrderInvoiceSummary(
      invoiceRow,
      xrayRow,
      orderPayments
    ),
    certificateNoRecords: Boolean(Number(row.certificate_no_records)),
    cnrReason: row.cnr_reason || "",
    cnrMemo: Boolean(Number(row.cnr_memo)),
    cnrDelivery: row.cnr_delivery || "",
    mailSentDate: toInputDate(row.ready_date),
    readyDate: toInputDate(row.ready_date),
    deliveryDate: toInputDate(row.delivery_date),
    pickupPersonName: row.pickup_person_name || "",
    cnrDateSent: toInputDate(row.cnr_date_sent),
    recentNotes: extras.recentNotes || [],
    hasActiveReminder: Boolean(extras.hasActiveReminder),
    creationSource: row.creation_source || "manual",
    portalStatus: extras.portalStatus || null,
    portalStatusLabel: extras.portalStatusLabel || null,
  };

  return appendOrderCompletenessFields(mapped, row, orderRecords);
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
  const callbackDate = log.callback_date ? toShortDate(log.callback_date) : "";

  return {
    id: `order-${log.id}`,
    source: "order",
    date: toShortDate(log.activity_date),
    displayDate: toShortDate(log.activity_date),
    by: log.author_name || "—",
    action: callbackDate ? "Reminder" : "Note",
    callback: callbackDate || "",
    note: log.note || "",
    module: "Orders",
    attachmentUrl: log.attachment_path
      ? `/uploads/${log.attachment_path}`
      : "",
    activityDate: log.activity_date,
  };
}

function mapGlobalOrderActivityLog(row) {
  const mapped = mapLogRow(row);
  const details = stripOrderIdTag(mapped.details);

  return {
    id: `global-${mapped.id}`,
    source: "global",
    date: mapped.date,
    displayDate: mapped.displayDate || mapped.date,
    by: mapped.performedBy || "—",
    action: mapped.action || "",
    callback: "",
    note: details,
    module: mapped.module || "Orders",
    attachmentUrl: "",
    activityDate: mapped.createdAt,
  };
}

function getActivityTimestamp(log) {
  const value = log.activityDate || log.activity_date || log.created_at;

  if (!value) return 0;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function mergeOrderActivityLogs(orderLogs = [], globalLogs = []) {
  const seen = new Set();

  orderLogs.forEach((log) => {
    seen.add(String(log.id));
    const key = `${normalizeNoteText(log.note)}|${log.date}|${log.by}|${log.action}`;
    seen.add(key);
  });

  const supplemental = globalLogs.filter((log) => {
    if (seen.has(String(log.id))) {
      return false;
    }

    const key = `${normalizeNoteText(log.note)}|${log.date}|${log.by}|${log.action}`;
    return !seen.has(key);
  });

  return [...orderLogs, ...supplemental].sort(
    (a, b) => getActivityTimestamp(b) - getActivityTimestamp(a)
  );
}

function mapNote(note) {
  return {
    id: note.id,
    note: note.note || "",
    authorName: note.author_name || "",
    createdBy: note.created_by || null,
    noteDate: note.note_date || null,
    callbackDate: toInputDate(note.callback_date),
    isCalled: Boolean(note.is_called),
    attachmentPath: note.attachment_path || "",
    attachmentUrl: note.attachment_path
      ? `/uploads/${note.attachment_path}`
      : "",
  };
}

function mapReminderRow(row) {
  const applicant = buildFullName(
    row.applicant_first_name,
    row.applicant_middle_name,
    row.applicant_last_name
  );

  return {
    noteId: row.note_id,
    orderId: row.order_id,
    orderNumber: row.order_number || "",
    caseNumber: row.case_number || row.order_number || "",
    date: toShortDate(row.note_date),
    by: row.author_name || "—",
    createdBy: row.created_by || null,
    note: row.note || "",
    applicant: applicant || "—",
    callbackDate: toInputDate(row.callback_date),
    callbackDateDisplay: toShortDate(row.callback_date),
    isCalled: Boolean(row.is_called),
    status: Boolean(row.is_called) ? "callbacked" : "not_callbacked",
    attachmentPath: row.attachment_path || "",
    attachmentUrl: row.attachment_path ? `/uploads/${row.attachment_path}` : "",
  };
}

function mapOrderDetail(
  row,
  payments = [],
  documents = [],
  workflowStages = [],
  notes = [],
  invoiceRow = null,
  xrayRow = null,
  orderRecords = []
) {
  const paymentSummary = invoiceService.mapOrderPaymentsSummary(payments);
  const paymentForm = enrichPaymentDueFields(
    mapPaymentsToForm(payments),
    invoiceRow,
    xrayRow,
    payments
  );
  const mappedRecords = mapOrderRecords(orderRecords);
  const primaryUploaded = mappedRecords.find((record) => record.hasFile);
  const rush = calculateOrderRushLevel(row.created_at);
  const writeOffState = resolveOrderWriteOffState(row, invoiceRow, xrayRow);

  const mapped = {
    id: row.id,
    orderNumber: row.order_number || "",
    status: writeOffState.status,
    isSubpoena: readHasSubpoena(row),
    isRecords: hasAnyRecordsRequested(orderRecords),
    isWriteOffs: writeOffState.isWriteOffs,
    workflowStages: workflowStages.map(mapWorkflowStage),
    notes: notes.map(mapNote),
    facility: row.facility_id ? String(row.facility_id) : "",
    facilityName: row.facility_name || "",
    facilityIsAutoCreated: Boolean(Number(row.facility_is_auto_created)),
    facilityProfileIncomplete: isFacilityProfileIncomplete({
      is_auto_created: row.facility_is_auto_created,
      email: row.facility_email,
    }),
    providerId: row.provider_id ? String(row.provider_id) : "",
    providerName: row.provider_name || "",
    type: resolveOrderTypeForForm(row, orderRecords),
    recordTypes: orderRecords.map((record) => record.record_type),
    orderRecords: mappedRecords,
    allRecordsUploaded: allOrderRecordsUploaded(orderRecords),
    court: row.court || "",
    caseNumber: row.case_number || "",
    recNumber: row.rec_number || "",
    orderRef: row.order_ref || "",
    ssn: "",
    dob: toInputDate(row.dob),

    firstName: row.applicant_first_name || "",
    middleName: row.applicant_middle_name || "",
    lastName: row.applicant_last_name || "",
    aka: row.applicant_aka || "",
    defendant: row.defendant || "",
    injuryType: row.injury_type || "",
    injuryDate: toInputDate(row.injury_date),
    injuryDateBegin: toInputDate(row.injury_date_begin),
    injuryDateEnd: toInputDate(row.injury_date_end),
    doiDisplay: formatDoiDisplay(row),
    hasDoi: hasDoi(row),

    documentName: "",
    subpoenaFile: null,
    additionalDocumentFile: null,
    subpoenaStoragePath: row.subpoena_storage_path || null,
    subpoenaUrl: buildSubpoenaUrl(row.subpoena_storage_path),
    medicalRecordsStoragePath: primaryUploaded?.storagePath || null,
    medicalRecordsUrl: primaryUploaded?.storageUrl || null,
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
    dateRequested: toInputDate(row.date_requested),
    createdAt: row.created_at || null,
    rushLevel: rush.level,
    rushLabel: rush.label,
    readyDate: toInputDate(row.ready_date),
    invoiceDate: toInputDate(row.invoice_date || invoiceRow?.invoice_date),
    xrayInvoiceDate: toInputDate(
      row.xray_invoice_date || xrayRow?.xray_invoice_date
    ),

    medicalRecords: orderRecords.some((record) => record.record_type === "medical"),
    billingRecords: orderRecords.some((record) => record.record_type === "billing"),
    employmentRecords: orderRecords.some(
      (record) => record.record_type === "employment"
    ),
    xrays: orderRecords.some((record) => record.record_type === "xrays"),
    otherRecord: orderRecords.some((record) => record.record_type === "other"),

    specificRecord: row.specific_record || "",
    specificDoctor: row.specific_doctor || "",
    specificDoctorIsDefault: Boolean(Number(row.specific_doctor_is_default)),
    fullAddress: row.full_address || "",

    certificateNoRecords: Boolean(row.certificate_no_records),
    cnrReason: row.cnr_reason || "",
    cnrDelivery: row.cnr_delivery || "",
    cnrDateSent: toInputDate(row.cnr_date_sent),
    cnrMemo: Boolean(row.cnr_memo),

    ...paymentForm,
    paymentLines: paymentSummary.paymentLines,
    orderAmountPaid: paymentSummary.orderAmountPaid,
    invoiceFees: invoiceService.mapOrderInvoiceFees(invoiceRow, xrayRow, payments),
  };

  return appendOrderCompletenessFields(mapped, row, orderRecords);
}

function parseExcludeCompleted(value) {
  if (value === true || value === 1) return true;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

async function getAllOrders(query = {}) {
  const filters = {};

  if (`${query.creationSource || ""}`.trim() === "personal_portal") {
    filters.creationSource = "personal_portal";
  }

  if (query.facility) {
    filters.facilityId = assertPositiveInt(query.facility, "facility");
  }

  if (query.company && `${query.company}`.trim()) {
    filters.company = sanitizeSearchText(query.company, { maxLength: 255 });
  }

  const PERSONAL_PORTAL_STATUSES = new Set([
    "in_process",
    "invoice",
    "paid",
    "released",
    "pending_payment",
  ]);
  const statusRaw = `${query.portalStatus || query.status || ""}`.trim();

  if (filters.creationSource === "personal_portal") {
    if (PERSONAL_PORTAL_STATUSES.has(statusRaw)) {
      filters.portalStatus = statusRaw;
    }
  } else if (query.status === "ready") {
    filters.readyFilter = true;
  } else if (query.status && STATUS_FILTER_MAP[query.status]) {
    filters.status = STATUS_FILTER_MAP[query.status];
  }

  if (parseExcludeCompleted(query.excludeCompleted)) {
    filters.excludeCompleted = true;
  }

  const rushRaw = `${query.rushLevel || ""}`.trim();
  if (rushRaw && RUSH_LEVEL_VALUES.has(rushRaw)) {
    filters.rushLevel = rushRaw;
  }

  const sortDir = `${query.sortDir || query.createdSortDir || ""}`
    .trim()
    .toLowerCase();
  if (sortDir === "asc" || sortDir === "desc") {
    filters.sortDir = sortDir;
  }

  if (query.year) {
    const year = Number(query.year);

    if (Number.isFinite(year)) {
      filters.year = year;
    }
  }

  if (query.period) {
    const periodFrom = resolveOrderPeriodStartDate(`${query.period}`.trim());

    if (periodFrom) {
      filters.periodFrom = periodFrom;
    }
  }

  const createdFrom = parseOptionalIsoDate(query.createdFrom, "createdFrom");
  const createdTo = parseOptionalIsoDate(query.createdTo, "createdTo");
  assertReportDateRange(createdFrom, createdTo);

  if (createdFrom) {
    filters.createdFrom = createdFrom;
  }

  if (createdTo) {
    filters.createdTo = createdTo;
  }

  if (query.search && `${query.search}`.trim()) {
    filters.search = sanitizeSearchText(query.search);
  }

  if (query.limit) {
    const limit = Number(query.limit);
    if (Number.isFinite(limit) && limit > 0) {
      filters.limit = limit;
    }
  }

  const useKeysetPagination =
    String(query.pagination || "").toLowerCase() === "keyset";
  const pageSize = parseReportPageSize(query.pageSize || filters.limit);
  const cursorValue = parseOptionalCursor(query.cursor);
  const cursorRaw = Number(cursorValue);
  const cursorId = Number.isFinite(cursorRaw) && cursorRaw > 0 ? cursorRaw : null;

  let rows = [];
  let pagination = null;
  if (useKeysetPagination) {
    const keysetResult = await Order.findAllKeyset({
      ...filters,
      pageSize,
      cursor: cursorValue,
      cursorId,
    });
    rows = keysetResult.rows;
    pagination = {
      type: "keyset",
      pageSize: keysetResult.pageSize,
      hasMore: keysetResult.hasMore,
      nextCursor: keysetResult.nextCursor,
    };
  } else {
    rows = await Order.findAll(filters);
  }

  const orderIds = rows.map((row) => row.id);
  const [
    stages,
    invoicesByOrderId,
    xrayByOrderId,
    paymentRows,
    orderRecordRows,
    recentNotesByOrderId,
    activeReminderByOrderId,
    portalByOrderId,
  ] = await Promise.all([
    Order.findWorkflowStagesByOrderIds(orderIds),
    invoiceService.getStandardInvoicesByOrderIds(orderIds),
    invoiceService.getXrayDetailsByOrderIds(orderIds),
    Order.findPaymentsByOrderIds(orderIds),
    OrderRecord.findByOrderIds(orderIds),
    Order.findRecentNotesByOrderIds(orderIds, 2),
    Order.findActiveReminderFlagsByOrderIds(orderIds),
    PersonalRequestOrder.findPortalStatusesByOrderIds(orderIds),
  ]);

  const PORTAL_STATUS_LABELS = {
    pending_payment: "Pending Payment",
    in_process: "In Process",
    invoice: "Invoice",
    paid: "Paid",
    released: "Released",
  };

  const stagesByOrderId = stages.reduce((acc, stage) => {
    if (!acc[stage.order_id]) acc[stage.order_id] = [];
    acc[stage.order_id].push(stage);
    return acc;
  }, {});

  const paymentsByOrderId = paymentRows.reduce((acc, payment) => {
    if (!acc[payment.order_id]) acc[payment.order_id] = [];
    acc[payment.order_id].push(payment);
    return acc;
  }, {});

  const recordsByOrderId = orderRecordRows.reduce((acc, record) => {
    if (!acc[record.order_id]) acc[record.order_id] = [];
    acc[record.order_id].push(record);
    return acc;
  }, {});

  const mappedOrders = rows.map((row) => {
    const invoiceRow = invoicesByOrderId[row.id] || null;
    const xrayRow = xrayByOrderId[row.id] || null;
    const portal = portalByOrderId[row.id] || null;
    const portalStatus =
      portal?.portal_status ||
      (row.creation_source === "personal_portal" ? "in_process" : null);
    const portalStatusLabel = portalStatus
      ? PORTAL_STATUS_LABELS[portalStatus] || portalStatus
      : null;

    return mapOrderListRow(
      row,
      stagesByOrderId[row.id] || [],
      invoiceRow,
      xrayRow,
      paymentsByOrderId[row.id] || [],
      recordsByOrderId[row.id] || [],
      {
        recentNotes: (recentNotesByOrderId[row.id] || []).map(mapNote),
        hasActiveReminder: Boolean(activeReminderByOrderId[row.id]),
        portalStatus,
        portalStatusLabel,
      }
    );
  });

  if (!useKeysetPagination) {
    return mappedOrders;
  }

  return {
    orders: mappedOrders,
    pagination,
  };
}

async function getOrderStats() {
  const row = await Order.countStats();

  return {
    totalOrders: Number(row.total_orders) || 0,
    activeCases: Number(row.active_cases) || 0,
    readyToPickup: Number(row.ready_to_pickup) || 0,
    completed: Number(row.completed) || 0,
  };
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
  const invoiceRow = await Invoice.findByOrderId(order.id);
  const xrayRow = await InvoiceXray.findByOrderId(order.id);
  const orderRecords = await OrderRecord.findByOrderId(order.id);

  return mapOrderDetail(
    order,
    payments,
    documents,
    workflowStages,
    notes,
    invoiceRow,
    xrayRow,
    orderRecords
  );
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

async function getOrderNotes(
  orderId,
  {
    includeCalled = false,
    noteId = null,
    actorId = null,
    actorRole = null,
    pagination = null,
    cursor = null,
    pageSize = 10,
    fromDate = null,
    toDate = null,
  } = {}
) {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (noteId) {
    const note = await Order.findNoteById(noteId);

    if (!note || String(note.order_id) !== String(order.id)) {
      throw new ApiError(404, "Note not found");
    }

    const isAdmin = String(actorRole || "").toLowerCase() === "admin";
    if (
      !isAdmin &&
      actorId &&
      Number(note.created_by) !== Number(actorId)
    ) {
      throw new ApiError(403, "You can only access your own notes");
    }

    return [mapNote(note)];
  }

  const useKeysetPagination = String(pagination || "").toLowerCase() === "keyset";
  const pendingOnly = includeCalled ? false : true;

  if (!useKeysetPagination) {
    const notes = await Order.findNotesByOrderId(order.id, pendingOnly);
    return notes.map(mapNote);
  }

  const keyset = await Order.findNotesByOrderIdKeyset(order.id, {
    pendingOnly,
    cursorId: cursor,
    limit: pageSize,
    fromDate,
    toDate,
  });

  return {
    notes: keyset.rows.map(mapNote),
    pagination: {
      type: "keyset",
      pageSize: keyset.pageSize,
      hasMore: keyset.hasMore,
      nextCursor: keyset.nextCursor,
    },
  };
}

async function getOrderReminders(user, { scope = "my", limit = 500 } = {}) {
  const isAdmin = String(user?.role || "").toLowerCase() === "admin";
  const normalizedScope = String(scope || "my").toLowerCase();
  const includeAll = isAdmin && normalizedScope === "all";

  const rows = await Order.findReminders({
    createdBy: includeAll ? null : user?.id || null,
    limit,
  });

  return rows.map(mapReminderRow);
}

async function addOrderNote(orderId, data, actorId, file) {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const noteText = trimOrNull(data.note, { maxLength: FIELD_LIMITS.ORDER_NOTE });

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

  await addOrderActivityLog({
    orderId: order.id,
    actorId,
    authorName,
    note: noteText,
    callbackDate: dateOrNull(data.callbackDate),
    attachmentPath: toRelativeStoragePath(file),
  });

  const notes = await Order.findNotesByOrderId(order.id, false);
  return notes.map(mapNote);
}

function parseBooleanFlag(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function buildCallbackLine(date = new Date()) {
  return `Calledback - ${date.toLocaleString("en-US")}`;
}

function hasCalledbackLine(text) {
  return /\bCalledback\b/i.test(text) || /\bCallback\s*-/i.test(text);
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

  if (Number(note.is_called)) {
    throw new ApiError(400, "This note has been called back and cannot be edited");
  }

  const employee = await Employee.findById(actorId);
  const isAdmin = String(employee?.role || "").toLowerCase() === "admin";

  if (!isAdmin && Number(note.created_by) !== Number(actorId)) {
    throw new ApiError(403, "You can only update your own notes");
  }

  const markCalled = parseBooleanFlag(data.markCalled);
  let noteText = trimOrNull(data.note, { maxLength: FIELD_LIMITS.ORDER_NOTE });

  if (!noteText) {
    throw new ApiError(400, "Note text is required");
  }

  if (markCalled) {
    if (!hasCalledbackLine(noteText)) {
      const callLine = buildCallbackLine();
      noteText = noteText ? `${noteText}\n${callLine}` : callLine;
    }
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
      isCalled: markCalled ? 1 : Number(note.is_called) || 0,
    });

    const updatedNote = await Order.findNoteById(note.id, connection);

    if (markCalled) {
      await Order.createActivityLog(
        {
          orderId: order.id,
          activityDate: new Date(),
          performedBy: actorId || null,
          authorName,
          callbackDate:
            dateOrNull(data.callbackDate) || updatedNote?.callback_date || null,
          note: noteText,
          attachmentPath: updatedNote?.attachment_path || null,
        },
        connection
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    rethrowServiceError(error);
  } finally {
    connection.release();
  }

  const notes = await Order.findNotesByOrderId(order.id, false);
  const activityLogs = await Order.findActivityLogsByOrderId(order.id);

  return {
    notes: notes.map(mapNote),
    activityLogs: activityLogs.map(mapActivityLog),
  };
}

function mapMergedActivityLogRow(row, notes = []) {
  if (row.log_source === "global") {
    return mapGlobalOrderActivityLog(row);
  }

  let attachmentPath = row.attachment_path;

  if (!attachmentPath) {
    const match = notes.find(
      (note) =>
        note.is_called &&
        note.attachment_path &&
        normalizeNoteText(note.note) === normalizeNoteText(row.note)
    );

    if (match) {
      attachmentPath = match.attachment_path;
    }
  }

  return mapActivityLog({ ...row, attachment_path: attachmentPath });
}

async function getOrderActivityLogs(orderId, query = {}) {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const useKeysetPagination =
    String(query.pagination || "").toLowerCase() === "keyset";
  const pageSizeRaw = Number(query.pageSize || query.limit || 10);
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(Math.max(pageSizeRaw, 1), 100)
    : 10;
  const cursorRaw = Number(query.cursor);
  const cursorSortKey =
    Number.isFinite(cursorRaw) && cursorRaw > 0 ? cursorRaw : null;
  const search = query.search
    ? sanitizeSearchText(query.search) || null
    : null;

  if (!useKeysetPagination) {
    const logs = await Order.findActivityLogsByOrderId(order.id);
    const globalLogs = await ActivityLog.findByOrderId(order.id, {
      orderNumber: order.order_number || null,
    });
    const notes = await Order.findNotesByOrderId(order.id, false);

    const mappedOrderLogs = logs.map((log) =>
      mapMergedActivityLogRow({ ...log, log_source: "order" }, notes)
    );
    const mappedGlobalLogs = globalLogs.map(mapGlobalOrderActivityLog);

    return mergeOrderActivityLogs(mappedOrderLogs, mappedGlobalLogs);
  }

  const keyset = await Order.findMergedActivityLogsKeyset(order.id, {
    orderNumber: order.order_number || null,
    cursorSortKey,
    pageSize,
    search,
  });

  const needsNoteLookup = keyset.rows.some(
    (row) => row.log_source === "order" && !row.attachment_path
  );
  const notes = needsNoteLookup
    ? await Order.findNotesByOrderId(order.id, false)
    : [];

  const mappedOrderLogs = keyset.rows
    .filter((row) => row.log_source === "order")
    .map((row) => mapMergedActivityLogRow(row, notes));
  const mappedGlobalLogs = keyset.rows
    .filter((row) => row.log_source === "global")
    .map((row) => mapMergedActivityLogRow(row, notes));
  const mergedLogs = mergeOrderActivityLogs(mappedOrderLogs, mappedGlobalLogs);

  return {
    logs: mergedLogs,
    pagination: {
      type: "keyset",
      pageSize: keyset.pageSize,
      hasMore: keyset.hasMore,
      nextCursor: keyset.nextCursor,
    },
  };
}

async function addOrderActivityLog({
  orderId,
  actorId,
  authorName = null,
  note,
  callbackDate = null,
  attachmentPath = null,
}) {
  if (!orderId || !note) {
    return null;
  }

  const resolvedAuthorName =
    authorName || (await resolveAuthorName(actorId));

  return Order.createActivityLog({
    orderId,
    activityDate: new Date(),
    performedBy: actorId || null,
    authorName: resolvedAuthorName,
    callbackDate,
    note,
    attachmentPath,
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

    return true;
  }

  return false;
}

async function resolveOrderNumber(rawOrderNumber, excludeId = null) {
  const orderNumber = trimOrNull(rawOrderNumber);

  if (!orderNumber) {
    throw new ApiError(400, "Order number is required");
  }

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

  let providerPayload;
  try {
    providerPayload = buildProviderPayload(data);
  } catch {
    return data.providerId ? Number(data.providerId) : null;
  }

  if (data.providerId) {
    const selected = await Provider.findById(Number(data.providerId), connection);
    if (selected) {
      await Provider.update(connection, selected.id, providerPayload);
      return selected.id;
    }
  }

  const { provider } = await findOrCreateProvider(
    { ...data, ...providerPayload },
    connection
  );
  return provider.id;
}

async function resolveFacilityId(connection, data) {
  const facilityId = Number(data.facility);
  const facilityName = trimOrNull(data.facilityName);

  if (Number.isFinite(facilityId) && facilityId > 0) {
    const selected = await Facility.findById(facilityId, connection);
    if (selected) {
      const selectedName = selected.facility_name || "";
      if (
        !facilityName ||
        normalizeFacilityName(facilityName) ===
          normalizeFacilityName(selectedName)
      ) {
        return selected.id;
      }
    }
  }

  if (!facilityName) {
    return Number.isFinite(facilityId) && facilityId > 0 ? facilityId : null;
  }

  const { facility } = await findOrCreateFacility(
    {
      facilityName,
      address: data.facilityAddress || "",
      city: data.facilityCity || "",
      state: data.facilityState || "",
      zipCode: data.facilityZip || "",
    },
    connection
  );

  return facility.id;
}

function assertFacilityProfileComplete(facility) {
  if (isFacilityProfileIncomplete(facility)) {
    throw new ApiError(
      400,
      "Complete the facility profile before saving this order"
    );
  }
}

function appendOrderCompletenessFields(mappedOrder, row, orderRecords = []) {
  const requiredFieldData = mapOrderRowToRequiredFieldData(row, orderRecords);
  const missingRequiredFields = computeMissingRequiredFields(
    requiredFieldData,
    orderRecords
  );

  return {
    ...mappedOrder,
    creationSource: row.creation_source || "manual",
    missingRequiredFields,
    hasIncompleteRequiredFields: missingRequiredFields.length > 0,
  };
}

async function createOrder(data, actorId, files, options = {}) {
  const { allowIncomplete = false, creationSource = "manual" } = options;
  const orderInput = {
    ...data,
    creationSource,
  };

  if (!allowIncomplete) {
    assertValidCnrDeliveryDate(orderInput);
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const resolvedFacilityId = await resolveFacilityId(connection, orderInput);

    if (!resolvedFacilityId) {
      throw new ApiError(400, "Selected facility does not exist");
    }

    orderInput.facility = String(resolvedFacilityId);

    const facility = await Facility.findById(resolvedFacilityId, connection);

    if (!facility) {
      throw new ApiError(400, "Selected facility does not exist");
    }

    if (!allowIncomplete) {
      assertFacilityProfileComplete(facility);
    }

    const orderNumber = await resolveOrderNumber(orderInput.orderNumber);
    const payments = collectPayments(orderInput);

    const subpoenaFile = getUploadedFile(files, "subpoenaFile");
    const additionalDocFile = getUploadedFile(files, "additionalDocumentFile");
    const subpoenaExtractId = Number(orderInput.subpoenaExtractId) || null;

    let linkedExtract = null;
    let subpoenaStoragePath = null;
    if (subpoenaExtractId) {
      linkedExtract = await batchScanRepository.getExtractById(subpoenaExtractId);
      if (!linkedExtract) {
        throw new ApiError(400, "Subpoena extract not found");
      }
      if (linkedExtract.is_processed) {
        throw new ApiError(409, "This subpoena extract was already processed into an order");
      }
      try {
        subpoenaStoragePath = fileStorage.archiveBatchScanSubpoenaToProcessed(
          linkedExtract.storage_path,
          orderNumber
        );
      } catch (error) {
        throw new ApiError(404, error.message || "Subpoena PDF not found");
      }
    } else {
      subpoenaStoragePath = toRelativeStoragePath(subpoenaFile);
    }

    const providerId = await resolveProviderId(connection, orderInput);
    const payload = buildOrderDbPayload(
      applyInjuryFromExtract({ ...orderInput, providerId }, linkedExtract)
    );
    let recordTypes = resolveRecordTypesFromForm(orderInput);
    if (!recordTypes.length && allowIncomplete) {
      recordTypes = ["other"];
      orderInput.otherRecord = true;
      orderInput.type = "other";
    }
    if (!recordTypes.length) {
      throw new ApiError(400, "At least one record type is required");
    }
    const hasSubpoenaFile = Boolean(subpoenaStoragePath);
    const orderFlags = resolveOrderFlags(orderInput, hasSubpoenaFile);

    const orderId = await Order.create(connection, {
      ...payload,
      subpoenaStoragePath,
      orderNumber,
      status: "Active",
      hasNote: 0,
      hasSubpoena: orderFlags.hasSubpoena,
      createdBy: actorId || null,
    });

    await OrderRecord.syncForOrder(
      connection,
      orderId,
      recordTypes
    );

    await syncOrderPayments(connection, orderId, orderInput);

    await saveOrderDocuments(connection, {
      orderId,
      additionalDocFile,
      documentName: orderInput.documentName,
      actorId,
    });

    if (subpoenaExtractId) {
      await batchScanRepository.linkExtractToOrder(connection, {
        extractId: subpoenaExtractId,
        orderId,
      });
    }

    await Order.seedWorkflowStages(connection, orderId);

    await syncOrderWorkflowFromState(connection, orderId, {
      payments,
      invoiceServiceFee: 0,
      invoiceCustodianFee: 0,
      skipCustodian: isCnrOrder(orderInput),
    });

    await connection.commit();

    await maybeSendCnrMemoEmail(orderId, orderInput, null, actorId);

    return getOrderById(orderId);
  } catch (error) {
    await connection.rollback();
    rethrowServiceError(error);
  } finally {
    connection.release();
  }
}

async function applyDefaultFacilityDoctorIfMissing(payload) {
  const facilityId = Number(payload.facility);
  if (!Number.isFinite(facilityId)) {
    return false;
  }

  const facilityService = require("./facilityService");
  const result = await facilityService.resolveDoctorFromExtractHints(facilityId, {
    specificDoctor: payload.specificDoctor,
  });

  if (result.missingDefault || !result.doctorName) {
    return false;
  }

  payload.specificDoctor = result.doctorName;
  payload.specificDoctorIsDefault = Boolean(result.usedDefault);
  return true;
}

async function createOrderFromExtract(extractId, actorId) {
  const extract = await batchScanRepository.getExtractById(extractId);

  if (!extract) {
    throw new ApiError(404, "Subpoena extract not found");
  }

  if (extract.is_processed) {
    throw new ApiError(409, "This subpoena extract was already processed into an order");
  }

  const facilities = await Facility.findAll();
  const payload = buildOrderPayloadFromExtractRow(extract, facilities);

  const rawExtraction =
    typeof extract.raw_extraction === "string"
      ? JSON.parse(extract.raw_extraction || "{}")
      : extract.raw_extraction || {};
  const {
    mapSchemaToOrderHints,
    enrichOrderHintsFromRow,
    resolveExtractionSchema,
  } = require("../utils/extractionMapper");

  let orderHints = enrichOrderHintsFromRow(
    mapSchemaToOrderHints(resolveExtractionSchema(rawExtraction)),
    extract
  );
  const providerResolution = await resolveProviderFromHints(orderHints);
  orderHints = providerResolution.orderHints;

  if (providerResolution.provider?.id) {
    payload.providerId = String(providerResolution.provider.id);
  }

  if (orderHints.companyName) {
    payload.serveCompanyName = orderHints.companyName;
  }

  if (orderHints.customer) {
    const facilityService = require("./facilityService");
    const { facility } = await facilityService.resolveFacilityFromHints(orderHints);
    if (facility) {
      payload.facility = String(facility.id);
      payload.facilityName = facility.facilityName || orderHints.customer;
    }
  }

  payload.subpoenaExtractId = String(extractId);

  if (payload.facility) {
    const facilityService = require("./facilityService");
    const doctorResolution = await facilityService.resolveDoctorFromExtractHints(
      payload.facility,
      orderHints
    );
    if (doctorResolution.doctorName) {
      payload.specificDoctor = doctorResolution.doctorName;
      payload.specificDoctorIsDefault = Boolean(doctorResolution.usedDefault);
    }
  }

  return createOrder(payload, actorId, {}, {
    allowIncomplete: true,
    creationSource: "auto",
  });
}

async function autoCreateOrdersFromBatch({ childIds = [], actorId }) {
  const created = [];
  const failed = [];

  for (const extractId of childIds) {
    try {
      const order = await createOrderFromExtract(extractId, actorId);
      created.push({
        extractId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        hasIncompleteRequiredFields: order.hasIncompleteRequiredFields,
      });
    } catch (error) {
      failed.push({
        extractId,
        message: error.message || "Failed to auto-create order",
      });
      logger.error("Auto order creation failed", {
        extractId,
        error: error.message,
      });
    }
  }

  return { created, failed };
}

async function updateOrderFacility(id, data, actorId) {
  const existing = await Order.findById(id);

  if (!existing) {
    throw new ApiError(404, "Order not found");
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const resolvedFacilityId = await resolveFacilityId(connection, data);

    if (!resolvedFacilityId) {
      throw new ApiError(400, "Selected facility does not exist");
    }

    const facility = await Facility.findById(resolvedFacilityId, connection);

    if (!facility) {
      throw new ApiError(400, "Selected facility does not exist");
    }

    assertFacilityProfileComplete(facility);

    await connection.execute(
      `UPDATE orders
       SET facility_id = :facilityId, updated_at = NOW()
       WHERE id = :orderId`,
      { facilityId: resolvedFacilityId, orderId: existing.id }
    );

    await connection.commit();

    return getOrderById(existing.id);
  } catch (error) {
    await connection.rollback();
    rethrowServiceError(error);
  } finally {
    connection.release();
  }
}

async function updateOrder(id, data, actorId, files) {
  assertValidCnrDeliveryDate(data);

  const existing = await Order.findById(id);

  if (!existing) {
    throw new ApiError(404, "Order not found");
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const resolvedFacilityId = await resolveFacilityId(connection, data);

    if (!resolvedFacilityId) {
      throw new ApiError(400, "Selected facility does not exist");
    }

    data.facility = String(resolvedFacilityId);

    const facility = await Facility.findById(resolvedFacilityId, connection);

    if (!facility) {
      throw new ApiError(400, "Selected facility does not exist");
    }

    assertFacilityProfileComplete(facility);

    const rawOrderNumber = trimOrNull(data.orderNumber);
    if (!rawOrderNumber) {
      throw new ApiError(400, "Order number is required");
    }

    const orderNumber = await resolveOrderNumber(rawOrderNumber, existing.id);
    const payments = collectPayments(data);

    const subpoenaFile = getUploadedFile(files, "subpoenaFile");
    const additionalDocFile = getUploadedFile(files, "additionalDocumentFile");
    const newSubpoenaPath = toRelativeStoragePath(subpoenaFile);
    const subpoenaStoragePath =
      newSubpoenaPath || existing.subpoena_storage_path || null;

    const providerId = await resolveProviderId(connection, data);
    const payload = buildOrderDbPayload({ ...data, providerId });
    const doctorChanged =
      trimOrNull(data.specificDoctor) !== trimOrNull(existing.specific_doctor);
    payload.specificDoctorIsDefault = doctorChanged
      ? 0
      : boolToInt(existing.specific_doctor_is_default);
    const recordTypes = resolveRecordTypesFromForm(data);
    if (!recordTypes.length) {
      throw new ApiError(400, "At least one record type is required");
    }
    const hasSubpoenaFile = Boolean(subpoenaStoragePath);
    const orderFlags = resolveOrderFlags(data, hasSubpoenaFile);

    await Order.update(connection, existing.id, {
      ...payload,
      subpoenaStoragePath,
      hasSubpoena: orderFlags.hasSubpoena,
      orderNumber,
    });

    await OrderRecord.syncForOrder(
      connection,
      existing.id,
      recordTypes
    );

    const refreshedRecords = await OrderRecord.findByOrderId(existing.id, connection);
    const reviewStatus = allOrderRecordsUploaded(refreshedRecords)
      ? "complete"
      : "pending";

    await Order.upsertWorkflowStage(
      existing.id,
      "Review Records",
      reviewStatus,
      reviewStatus === "complete" ? new Date() : null,
      connection
    );

    await syncOrderPayments(connection, existing.id, data);

    await saveOrderDocuments(connection, {
      orderId: existing.id,
      additionalDocFile,
      documentName: data.documentName,
      actorId,
    });

    const savedPayments = await Order.findPaymentsByOrderId(existing.id, connection);
    const resolvedCustodianDue = invoiceService.resolveCustodianPaymentDue(
      null,
      savedPayments
    );

    await syncOrderWorkflowFromState(connection, existing.id, {
      payments: isCnrOrder(data)
        ? payments.filter((payment) => payment.paymentType !== "custodian")
        : payments,
      invoiceServiceFee: 0,
      skipCustodian: isCnrOrder(data),
      resolvedCustodianDue,
    });

    await connection.commit();

    await maybeSendCnrMemoEmail(existing.id, data, existing, actorId);

    return getOrderById(existing.id);
  } catch (error) {
    await connection.rollback();
    rethrowServiceError(error);
  } finally {
    connection.release();
  }
}

async function deleteOrder(id, { actorId, actorName } = {}) {
  const existing = await Order.findByIdRaw(id);

  if (!existing) {
    throw new ApiError(404, "Order not found");
  }

  if (existing.status === "Deleted") {
    throw new ApiError(400, "Order is already deleted");
  }

  if (existing.status === "Cancelled") {
    throw new ApiError(400, "Cannot delete a cancelled order");
  }

  const deleted = await Order.deleteById(existing.id, {
    deletedBy: actorId || null,
  });

  if (!deleted) {
    throw new ApiError(404, "Order not found");
  }

  await Order.createActivityLog({
    orderId: existing.id,
    activityDate: new Date(),
    performedBy: actorId || null,
    authorName: actorName || "System",
    callbackDate: null,
    note: "Order deleted",
    attachmentPath: null,
  });

  return { message: "Order deleted successfully" };
}

async function cancelOrder(id, { reason, actorId, actorName }) {
  const existing = await Order.findByIdRaw(id);

  if (!existing) {
    throw new ApiError(404, "Order not found");
  }

  if (existing.status === "Deleted") {
    throw new ApiError(400, "Cannot cancel a deleted order");
  }

  if (existing.status === "Cancelled") {
    throw new ApiError(400, "Order is already cancelled");
  }

  const trimmedReason = trimOrNull(reason, { maxLength: FIELD_LIMITS.TEXT });
  if (!trimmedReason) {
    throw new ApiError(400, "Cancellation reason is required");
  }

  const cancelled = await Order.cancelById(existing.id, {
    reason: trimmedReason,
    actorId: actorId || null,
  });

  if (!cancelled) {
    throw new ApiError(400, "Order is already cancelled");
  }

  await Order.createActivityLog({
    orderId: existing.id,
    activityDate: new Date(),
    performedBy: actorId || null,
    authorName: actorName || "System",
    callbackDate: null,
    note: `Order cancelled: ${trimmedReason}`,
    attachmentPath: null,
  });

  return {
    id: existing.id,
    orderNumber: existing.order_number,
    facility: existing.facility_id ? String(existing.facility_id) : "",
    facilityName: existing.facility_name || "",
    serveCompanyName: existing.serve_company_name || "",
    status: "Cancelled",
    cancelReason: trimmedReason,
  };
}

const RESTORABLE_STATUSES = new Set(["Cancelled", "Deleted"]);
const ALLOWED_RESTORE_TARGET_STATUSES = new Set([
  "Active",
  "Ready",
  "Ready to Pickup",
  "Completed",
  "Write Offs",
]);

function resolveRestoreTargetStatus(order = {}) {
  const previous = trimOrNull(order.status_before_inactive);
  if (previous && ALLOWED_RESTORE_TARGET_STATUSES.has(previous)) {
    return previous;
  }
  return "Active";
}

async function restoreOrder(id, { actorId, actorName } = {}) {
  const existing = await Order.findByIdRaw(id);

  if (!existing) {
    throw new ApiError(404, "Order not found");
  }

  if (!RESTORABLE_STATUSES.has(existing.status)) {
    throw new ApiError(400, "Only cancelled or deleted orders can be restored");
  }

  const restoreStatus = resolveRestoreTargetStatus(existing);
  const restored = await Order.restoreById(existing.id);

  if (!restored) {
    throw new ApiError(400, "Order could not be restored");
  }

  await Order.createActivityLog({
    orderId: existing.id,
    activityDate: new Date(),
    performedBy: actorId || null,
    authorName: actorName || "System",
    callbackDate: null,
    note: `Order restored to ${restoreStatus}`,
    attachmentPath: null,
  });

  return getOrderById(existing.id);
}

async function getOrderSubpoenaFile(orderId) {
  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (!order.subpoena_storage_path) {
    throw new ApiError(404, "Order subpoena not found");
  }

  const absolutePath = resolveOrderSubpoenaAbsolutePath(order.subpoena_storage_path);

  if (!absolutePath || !fs.existsSync(absolutePath)) {
    throw new ApiError(404, "Subpoena PDF file not found ");
  }

  return {
    absolutePath,
    fileName: path.basename(absolutePath),
  };
}

function deleteStoredMedicalRecordsFile(storagePath) {
  const absolutePath = resolveOrderSubpoenaAbsolutePath(storagePath);

  if (absolutePath && fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

async function scanMedicalRecords(
  orderId,
  file,
  actorId,
  { replace = false, recordType = "medical" } = {}
) {
  if (!file) {
    throw new ApiError(400, "Records PDF is required");
  }

  const normalizedType = `${recordType || ""}`.trim().toLowerCase();
  if (!VALID_RECORD_TYPES.includes(normalizedType)) {
    throw new ApiError(400, "Invalid record type");
  }

  const existing = await Order.findById(orderId);
  if (!existing) {
    throw new ApiError(404, "Order not found");
  }

  if (Number(existing.certificate_no_records)) {
    throw new ApiError(
      400,
      "Medical records cannot be uploaded for Certificate of No Records orders"
    );
  }

  const orderRecords = await OrderRecord.findByOrderId(orderId);
  const targetRecord = orderRecords.find(
    (record) => record.record_type === normalizedType
  );

  if (!targetRecord) {
    throw new ApiError(
      400,
      "This record type is not on the order. Update the order record types first."
    );
  }

  const hasExistingFile = Boolean(targetRecord.storage_path);

  if (hasExistingFile && !replace) {
    throw new ApiError(409, "Records were already uploaded for this record type");
  }

  const storagePath = toRelativeStoragePath(file);
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (hasExistingFile) {
      deleteStoredMedicalRecordsFile(targetRecord.storage_path);
    }

    await OrderRecord.upsertScan(connection, {
      orderId,
      recordType: normalizedType,
      storagePath,
      uploadedBy: actorId || null,
    });

    const refreshedRecords = await OrderRecord.findByOrderId(orderId, connection);
    const reviewStatus = allOrderRecordsUploaded(refreshedRecords)
      ? "complete"
      : "pending";

    await Order.upsertWorkflowStage(
      orderId,
      "Review Records",
      reviewStatus,
      reviewStatus === "complete" ? new Date() : null,
      connection
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    rethrowServiceError(error);
  } finally {
    connection.release();
  }

  try {
    const personalPortalService = require("./personalPortalService");
    await personalPortalService.syncPortalStatusForDmsOrder(orderId);
  } catch (_syncError) {
    // Non-blocking for personal portal status
  }

  return getOrderById(orderId);
}

async function removeMedicalRecords(orderId, _actorId, { recordType = null } = {}) {
  const existing = await Order.findById(orderId);
  if (!existing) {
    throw new ApiError(404, "Order not found");
  }

  if (Number(existing.certificate_no_records)) {
    throw new ApiError(
      400,
      "Medical records cannot be modified for Certificate of No Records orders"
    );
  }

  const orderRecords = await OrderRecord.findByOrderId(orderId);
  const normalizedType = recordType
    ? `${recordType}`.trim().toLowerCase()
    : null;

  const targets = normalizedType
    ? orderRecords.filter(
        (record) => record.record_type === normalizedType && record.storage_path
      )
    : orderRecords.filter((record) => record.storage_path);

  if (!targets.length) {
    throw new ApiError(404, "Records file not found for this order");
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const target of targets) {
      deleteStoredMedicalRecordsFile(target.storage_path);
      await OrderRecord.clearScan(connection, orderId, target.record_type);
    }

    await Order.upsertWorkflowStage(
      orderId,
      "Review Records",
      "pending",
      null,
      connection
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    rethrowServiceError(error);
  } finally {
    connection.release();
  }

  try {
    const personalPortalService = require("./personalPortalService");
    await personalPortalService.syncPortalStatusForDmsOrder(orderId);
  } catch (_syncError) {
    // Non-blocking
  }

  return getOrderById(orderId);
}

async function getOrderMedicalRecordsFile(orderId, { recordType = "medical" } = {}) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const normalizedType = `${recordType || ""}`.trim().toLowerCase();
  if (!VALID_RECORD_TYPES.includes(normalizedType)) {
    throw new ApiError(400, "Invalid record type");
  }

  const targetRecord = await OrderRecord.findByOrderAndType(orderId, normalizedType);
  if (!targetRecord?.storage_path) {
    throw new ApiError(404, "Records file not found for this order");
  }

  const absolutePath = resolveOrderSubpoenaAbsolutePath(targetRecord.storage_path);

  if (!absolutePath || !fs.existsSync(absolutePath)) {
    throw new ApiError(404, "Records PDF file not found");
  }

  const orderRecords = await OrderRecord.findByOrderId(orderId);
  if (allOrderRecordsUploaded(orderRecords)) {
    await Order.upsertWorkflowStage(
      orderId,
      "Review Records",
      "complete",
      new Date()
    );
  }

  return {
    absolutePath,
    fileName: path.basename(absolutePath),
  };
}

function buildApplicantName(row) {
  return buildFullName(
    row.applicant_first_name,
    row.applicant_middle_name,
    row.applicant_last_name
  );
}

function assertReadyForDelivery(order) {
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (order.status !== "Ready to Pickup") {
    throw new ApiError(
      400,
      "Mail, fax, and pickup actions are only available for orders ready to pickup"
    );
  }
}

async function resolveOrderRecordsAttachments(order) {
  const records = await OrderRecord.findByOrderId(order.id);
  const withFiles = records.filter((record) => record.storage_path);
  const safeOrderNumber = `${order.order_number || order.id}`.replace(
    /[^\w.-]+/g,
    "_"
  );

  const attachments = [];
  const recordLabels = [];

  for (const record of withFiles) {
    const absolutePath = resolveOrderSubpoenaAbsolutePath(record.storage_path);

    if (!absolutePath || !fs.existsSync(absolutePath)) {
      continue;
    }

    const typeSuffix = record.record_type || "records";
    recordLabels.push(RECORD_TITLES[record.record_type] || "Records");
    attachments.push({
      filename: `${safeOrderNumber}-${typeSuffix}.pdf`,
      path: absolutePath,
    });
  }

  return { attachments, recordLabels };
}

async function resolveMedicalRecordsAttachment(order) {
  const { attachments } = await resolveOrderRecordsAttachments(order);
  return attachments[0] || null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function normalizeRecipientEmails(primaryEmail, additionalEmails = []) {
  const primary = trimOrNull(primaryEmail);

  if (!primary || !EMAIL_PATTERN.test(primary)) {
    throw new ApiError(400, "A valid company email is required");
  }

  const recipients = [primary.toLowerCase()];

  for (const rawEmail of additionalEmails) {
    const email = trimOrNull(rawEmail);
    if (!email) continue;

    if (!EMAIL_PATTERN.test(email)) {
      throw new ApiError(400, `Invalid email address: ${email}`);
    }

    const normalized = email.toLowerCase();
    if (!recipients.includes(normalized)) {
      recipients.push(normalized);
    }
  }

  return recipients;
}

function resolveCnrRecipientEmail(row = {}, data = {}) {
  return (
    trimOrNull(data.email || data.serveEmail) ||
    trimOrNull(row.serve_email) ||
    trimOrNull(row.contact1_email) ||
    trimOrNull(row.contact2_email) ||
    trimOrNull(row.provider_email) ||
    null
  );
}

function buildCnrDocumentPdfData(order) {
  const isMemo = Boolean(Number(order.cnr_memo));

  return {
    isMemo,
    documentTitle: isMemo ? "Memo" : "Certificate of No Records",
    memoDate: order.cnr_date_sent || new Date(),
    recipientCompany: order.serve_company_name || order.provider_name || "",
    applicant: buildApplicantName(order),
    reference: order.order_number || "",
    facilityName: order.facility_name || "",
    cnrReason: trimOrNull(order.cnr_reason) || "",
  };
}

function buildCnrMemoPdfData(order) {
  return buildCnrDocumentPdfData(order);
}

function shouldSendCnrMemoEmail(existingOrder, data) {
  if (!isCnrOrder(data) || !parseBoolean(data.cnrMemo)) {
    return false;
  }

  if (data.cnrDelivery !== "email") {
    return false;
  }

  if (!dateOrNull(data.cnrDateSent)) {
    return false;
  }

  const recipient = resolveCnrRecipientEmail(existingOrder || {}, data);
  if (!recipient || !EMAIL_PATTERN.test(recipient)) {
    return false;
  }

  if (!existingOrder) {
    return true;
  }

  if (!Number(existingOrder.certificate_no_records)) {
    return true;
  }

  return (
    existingOrder.cnr_delivery !== "email" ||
    Boolean(Number(existingOrder.cnr_memo)) !== parseBoolean(data.cnrMemo) ||
    toInputDate(existingOrder.cnr_date_sent) !==
      toInputDate(dateOrNull(data.cnrDateSent)) ||
    trimOrNull(existingOrder.cnr_reason) !== trimOrNull(data.cnrReason) ||
    resolveCnrRecipientEmail(existingOrder) !==
      resolveCnrRecipientEmail(existingOrder, data)
  );
}

async function maybeSendCnrMemoEmail(orderId, data, existingOrder = null, actorId = null) {
  if (!shouldSendCnrMemoEmail(existingOrder, data)) {
    return null;
  }

  const order = await Order.findById(orderId);
  if (!order) {
    return null;
  }

  const recipient = resolveCnrRecipientEmail(order, data);
  const { generateCnrMemoPdf } = require("../utils/cnrMemoPdf");
  const { sendCnrMemoEmail } = require("./emailService");
  const pdfBuffer = await generateCnrMemoPdf(buildCnrMemoPdfData(order));
  const result = await sendCnrMemoEmail({
    to: recipient,
    orderNumber: order.order_number,
    applicantName: buildApplicantName(order),
    memoDate: order.cnr_date_sent,
    pdfBuffer,
  });

  await Order.createActivityLog({
    orderId,
    activityDate: new Date(),
    performedBy: actorId || null,
    authorName: "System",
    callbackDate: null,
    note: `CNR Memo emailed to ${recipient}`,
    attachmentPath: null,
  });

  return {
    recipient,
    sentDate: toInputDate(order.cnr_date_sent),
    delivered: Boolean(result.delivered),
    devLogged: Boolean(result.devLogged),
  };
}

async function sendCnrRecord(
  orderId,
  { emails, email, additionalEmails, sentDate } = {}
) {
  const normalizedId = Number(orderId);
  const recipients = resolveMailRecipients({ emails, email, additionalEmails });

  if (!Number.isFinite(normalizedId)) {
    throw new ApiError(400, "Invalid order id");
  }

  const order = await Order.findById(normalizedId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (!Number(order.certificate_no_records)) {
    throw new ApiError(400, "This order is not marked as Certificate of No Records");
  }

  const pdfData = buildCnrDocumentPdfData(order);
  const { generateCnrDocumentPdf } = require("../utils/cnrMemoPdf");
  const { sendCnrRecordEmail } = require("./emailService");
  const pdfBuffer = await generateCnrDocumentPdf(pdfData);
  const documentDate = dateOrNull(sentDate) || order.cnr_date_sent || new Date();
  const deliveredTo = [];

  for (const recipient of recipients) {
    const result = await sendCnrRecordEmail({
      to: recipient,
      orderNumber: order.order_number,
      applicantName: buildApplicantName(order),
      documentDate,
      cnrReason: pdfData.cnrReason,
      documentTitle: pdfData.documentTitle,
      pdfBuffer,
    });

    if (!result.delivered && !result.devLogged) {
      throw new ApiError(500, "Failed to send CNR record email");
    }

    deliveredTo.push(recipient);
  }

  const mailSentDate =
    dateOrNull(sentDate) || new Date().toISOString().slice(0, 10);
  const pool = getPool();

  await pool.execute(
    `UPDATE orders
     SET cnr_date_sent = :mailSentDate,
         cnr_delivery = 'email',
         updated_at = NOW()
     WHERE id = :orderId`,
    { mailSentDate, orderId: normalizedId }
  );

  return {
    recipients: deliveredTo,
    recipient: deliveredTo.join(", "),
    delivered: deliveredTo.length > 0,
    devLogged: false,
    sentDate: mailSentDate,
    documentTitle: pdfData.documentTitle,
    cnrReason: pdfData.cnrReason,
  };
}

function resolveMailRecipients({ emails, email, additionalEmails = [] } = {}) {
  if (Array.isArray(emails) && emails.length) {
    const seen = new Set();
    const recipients = [];

    emails.forEach((value) => {
      const trimmed = trimOrNull(value);
      if (!trimmed) return;

      if (!EMAIL_PATTERN.test(trimmed)) {
        throw new ApiError(400, `Invalid email address: ${trimmed}`);
      }

      const key = trimmed.toLowerCase();
      if (seen.has(key)) return;

      seen.add(key);
      recipients.push(trimmed);
    });

    if (!recipients.length) {
      throw new ApiError(400, "At least one recipient email is required");
    }

    return recipients;
  }

  return normalizeRecipientEmails(email, additionalEmails);
}

function buildRecordsDownloadUrl(token) {
  const config = require("../config");
  const baseUrl = `${config.clientUrl || "http://localhost:3000"}`.replace(
    /\/$/,
    ""
  );
  return `${baseUrl}/download/records/${token}`;
}

async function mailCompletedOrder(
  orderId,
  { emails, email, additionalEmails, deliveryDate } = {}
) {
  const normalizedId = Number(orderId);
  const recipients = resolveMailRecipients({ emails, email, additionalEmails });

  if (!Number.isFinite(normalizedId)) {
    throw new ApiError(400, "Invalid order id");
  }

  const order = await Order.findById(normalizedId);
  assertReadyForDelivery(order);

  const {
    createDownloadLinkForOrder,
    resolveOrderRecordFiles,
  } = require("./recordDownloadService");

  const { token, expiresAt, files } = await createDownloadLinkForOrder(
    normalizedId
  );
  const { recordLabels } = await resolveOrderRecordFiles(order);

  if (!files.length) {
    throw new ApiError(
      400,
      "Records files not found. Scan records before sending email."
    );
  }

  const mailSentDate = dateOrNull(deliveryDate) || new Date().toISOString().slice(0, 10);

  const pool = getPool();

  const setCnrDate =
    Number(order.certificate_no_records) && order.cnr_delivery === "email";

  const downloadUrl = buildRecordsDownloadUrl(token);
  const { sendOrderCompletedMail } = require("./emailService");
  const deliveredTo = [];

  for (const recipient of recipients) {
    const result = await sendOrderCompletedMail({
      to: recipient,
      orderNumber: order.order_number,
      applicant: buildApplicantName(order),
      providerName: order.serve_company_name || order.provider_name || "",
      recordLabels,
      downloadUrl,
      expiresAt,
    });

    if (!result.delivered && !result.devLogged) {
      throw new ApiError(500, "Failed to send email");
    }

    deliveredTo.push(recipient);
  }

  await pool.execute(
    `UPDATE orders
     SET delivery_date = :mailSentDate,
         ready_date = :mailSentDate,
         status = 'Completed',
         ${setCnrDate ? "cnr_date_sent = :mailSentDate," : ""}
         updated_at = NOW()
     WHERE id = :orderId`,
    { mailSentDate, orderId: normalizedId }
  );

  return {
    recipients: deliveredTo,
    recipient: deliveredTo.join(", "),
    delivered: deliveredTo.length > 0,
    devLogged: false,
    sentDate: mailSentDate,
    readyDate: mailSentDate,
    downloadUrl,
    expiresAt,
  };
}

function splitAddressIntoLines(address = "") {
  const trimmed = String(address).trim();
  if (!trimmed) return [];

  const parts = trimmed.split(", ").filter(Boolean);
  if (parts.length <= 2) return parts;

  return [parts.slice(0, -2).join(", "), parts.slice(-2).join(", ")];
}

function buildCertificateOfRecordsPdfData(order) {
  const facilityInfo = buildFacilityBlock(order);
  const company = buildCompanyBlock(order);
  const reference = trimOrNull(order.order_ref) || order.order_number || "";

  return {
    documentDate: new Date(),
    applicant: buildApplicantName(order),
    reference,
    facilityName: facilityInfo.name || order.facility_name || "N/A",
    facilityAddressLines: facilityInfo.addressLines,
    companyName: company.name,
    companyAddressLines: splitAddressIntoLines(company.address),
  };
}

async function sendCertificateOfRecords(
  orderId,
  { emails, email, additionalEmails, sentDate } = {}
) {
  const normalizedId = Number(orderId);
  const recipients = resolveMailRecipients({ emails, email, additionalEmails });

  if (!Number.isFinite(normalizedId)) {
    throw new ApiError(400, "Invalid order id");
  }

  const order = await Order.findById(normalizedId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (Number(order.certificate_no_records)) {
    throw new ApiError(
      400,
      "Certificate of Records is not available for Certificate of No Records orders"
    );
  }

  const pdfData = buildCertificateOfRecordsPdfData(order);
  const { generateCertificateOfRecordsPdf } = require("../utils/certificateOfRecordsPdf");
  const { sendCertificateOfRecordsEmail } = require("./emailService");
  const pdfBuffer = await generateCertificateOfRecordsPdf(pdfData);
  const documentDate = dateOrNull(sentDate) || new Date();
  const deliveredTo = [];

  for (const recipient of recipients) {
    const result = await sendCertificateOfRecordsEmail({
      to: recipient,
      orderNumber: order.order_number,
      applicantName: buildApplicantName(order),
      documentDate,
      pdfBuffer,
    });

    if (!result.delivered && !result.devLogged) {
      throw new ApiError(500, "Failed to send certificate of records email");
    }

    deliveredTo.push(recipient);
  }

  return {
    recipients: deliveredTo,
    recipient: deliveredTo.join(", "),
    delivered: deliveredTo.length > 0,
    devLogged: false,
    sentDate: toInputDate(documentDate),
  };
}

async function sendCopyServiceLetter(
  orderId,
  { email, additionalEmails = [] } = {}
) {
  const normalizedId = Number(orderId);

  if (!Number.isFinite(normalizedId)) {
    throw new ApiError(400, "Invalid order id");
  }

  const recipients = normalizeRecipientEmails(email, additionalEmails);
  const order = await Order.findById(normalizedId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const facilityInfo = buildFacilityBlock(order);
  const sendDate = new Date();
  const {
    generateCopyServiceLetterPdf,
    addExpiryDate,
  } = require("../utils/copyServiceLetterPdf");
  const { sendCopyServiceLetterEmail } = require("./emailService");

  const pdfBuffer = await generateCopyServiceLetterPdf({
    facilityName: facilityInfo.name || order.facility_name || "N/A",
    facilityAddressLines: facilityInfo.addressLines,
    applicantName: buildApplicantName(order) || "N/A",
    orderNumber: order.order_number,
    sendDate,
  });

  const expiresDate = addExpiryDate(sendDate);
  const result = await sendCopyServiceLetterEmail({
    to: recipients.join(", "),
    orderNumber: order.order_number,
    applicantName: buildApplicantName(order),
    facilityName: facilityInfo.name || order.facility_name || "",
    sendDate,
    expiresDate,
    pdfBuffer,
  });

  if (!result.delivered && !result.devLogged) {
    throw new ApiError(500, "Failed to send copy service letter email");
  }

  return {
    recipients,
    delivered: result.delivered,
    devLogged: Boolean(result.devLogged),
    sentDate: sendDate.toISOString(),
    expiresDate: expiresDate.toISOString(),
  };
}

async function getPrintInvoicePdf(orderId) {
  const normalizedId = Number(orderId);

  if (!Number.isFinite(normalizedId)) {
    throw new ApiError(400, "Invalid order id");
  }

  const order = await Order.findById(normalizedId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const invoice = await Invoice.findByOrderId(normalizedId);

  if (!invoice) {
    throw new ApiError(404, "Invoice not found for this order");
  }

  const payments = await Order.findPaymentsByOrderId(normalizedId);
  const payload = invoiceService.buildPrintInvoicePdfData(
    invoice,
    order,
    payments
  );

  if (!payload) {
    throw new ApiError(404, "Invoice data not available for this order");
  }

  const { generatePrintInvoicePdf } = require("../utils/printInvoicePdf");
  const pdfBuffer = await generatePrintInvoicePdf(payload);
  const safeOrderNumber = `${order.order_number || order.id}`.replace(
    /[^\w.-]+/g,
    "_"
  );

  return {
    pdfBuffer,
    fileName: `invoice-${safeOrderNumber}.pdf`,
    orderNumber: order.order_number,
    totalDue: payload.totalDue,
  };
}

async function getPrintXrayInvoicePdf(orderId) {
  const normalizedId = Number(orderId);

  if (!Number.isFinite(normalizedId)) {
    throw new ApiError(400, "Invalid order id");
  }

  const order = await Order.findById(normalizedId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const xrayRow = await InvoiceXray.findByOrderId(normalizedId);

  if (!xrayRow) {
    throw new ApiError(404, "X-Ray invoice not found for this order");
  }

  const payments = await Order.findPaymentsByOrderId(normalizedId);
  const payload = invoiceService.buildPrintXrayInvoicePdfData(
    xrayRow,
    order,
    payments
  );

  if (!payload) {
    throw new ApiError(404, "X-Ray invoice data not available for this order");
  }

  const { generatePrintXrayInvoicePdf } = require("../utils/printXrayInvoicePdf");
  const pdfBuffer = await generatePrintXrayInvoicePdf(payload);
  const safeOrderNumber = `${order.order_number || order.id}`.replace(
    /[^\w.-]+/g,
    "_"
  );

  return {
    pdfBuffer,
    fileName: `xray-invoice-${safeOrderNumber}.pdf`,
    orderNumber: order.order_number,
    totalDue: payload.totalDue,
  };
}

async function recordOrderFax(orderId, { faxNumber, sentDate, notes } = {}) {
  const normalizedId = Number(orderId);

  if (!Number.isFinite(normalizedId)) {
    throw new ApiError(400, "Invalid order id");
  }

  const resolvedFax = trimOrNull(faxNumber);
  if (!resolvedFax) {
    throw new ApiError(400, "Fax number is required");
  }

  const order = await Order.findById(normalizedId);
  assertReadyForDelivery(order);

  const resolvedDate = dateOrNull(sentDate);
  if (!resolvedDate) {
    throw new ApiError(400, "Fax sent date is required");
  }

  const pool = getPool();

  await pool.execute(
    `UPDATE orders
     SET cnr_date_sent = :sentDate, updated_at = NOW()
     WHERE id = :orderId`,
    { sentDate: resolvedDate, orderId: normalizedId }
  );

  return {
    orderId: normalizedId,
    faxNumber: resolvedFax,
    sentDate: resolvedDate,
    notes: trimOrNull(notes) || "",
  };
}

async function recordOrderPickup(orderId, { pickupDate, pickupPersonName, notes } = {}) {
  const normalizedId = Number(orderId);

  if (!Number.isFinite(normalizedId)) {
    throw new ApiError(400, "Invalid order id");
  }

  const resolvedPerson = trimOrNull(pickupPersonName);
  if (!resolvedPerson) {
    throw new ApiError(400, "Pickup person name is required");
  }

  const order = await Order.findById(normalizedId);
  assertReadyForDelivery(order);

  const resolvedDate = dateOrNull(pickupDate);
  if (!resolvedDate) {
    throw new ApiError(400, "Pickup date is required");
  }

  const pool = getPool();

  await pool.execute(
    `UPDATE orders
     SET delivery_date = :pickupDate,
         ready_date = :pickupDate,
         pickup_person_name = :pickupPersonName,
         status = 'Completed',
         updated_at = NOW()
     WHERE id = :orderId`,
    {
      pickupDate: resolvedDate,
      pickupPersonName: resolvedPerson,
      orderId: normalizedId,
    }
  );

  return {
    orderId: normalizedId,
    pickupDate: resolvedDate,
    pickupPersonName: resolvedPerson,
    readyDate: resolvedDate,
    notes: trimOrNull(notes) || "",
  };
}

async function getOrderFilterCompanies() {
  return Order.findDistinctCompanyNames();
}

async function searchOrderDoctors(query, facilityId = null) {
  const trimmed = `${query || ""}`.trim();

  if (!trimmed) return [];

  const limit = 25;
  const normalizedFacilityId = Number(facilityId);

  const [orderDoctors, facilityDoctors] = await Promise.all([
    Order.searchDoctors(trimmed, limit),
    Number.isFinite(normalizedFacilityId) && normalizedFacilityId > 0
      ? FacilityDoctor.searchByQuery(normalizedFacilityId, trimmed, limit)
      : Promise.resolve([]),
  ]);

  const merged = new Map();

  for (const name of facilityDoctors) {
    const key = name.toLowerCase();
    if (!merged.has(key)) merged.set(key, name);
  }

  for (const name of orderDoctors) {
    const key = name.toLowerCase();
    if (!merged.has(key)) merged.set(key, name);
  }

  return Array.from(merged.values()).slice(0, limit);
}

async function searchOrderDoctorAddresses(query) {
  return Order.searchDoctorAddresses(query);
}

module.exports = {
  getAllOrders,
  getOrderStats,
  getOrderFilterCompanies,
  getOrderById,
  getOrderReminders,
  createOrder,
  createOrderFromExtract,
  autoCreateOrdersFromBatch,
  updateOrder,
  updateOrderFacility,
  deleteOrder,
  cancelOrder,
  restoreOrder,
  getOrderNotes,
  addOrderNote,
  updateOrderNote,
  getOrderActivityLogs,
  addOrderActivityLog,
  getWorkflowStages,
  updateOrderWorkflowStage,
  markOrderWorkflowSent,
  getOrderSubpoenaFile,
  scanMedicalRecords,
  removeMedicalRecords,
  getOrderMedicalRecordsFile,
  mailCompletedOrder,
  sendCnrRecord,
  sendCertificateOfRecords,
  sendCopyServiceLetter,
  getPrintInvoicePdf,
  getPrintXrayInvoicePdf,
  recordOrderFax,
  recordOrderPickup,
  searchOrderDoctors,
  searchOrderDoctorAddresses,
};
