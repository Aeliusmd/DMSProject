/**
 * Order business logic — called by orderController.
 */

const ApiError = require("../utils/ApiError");
const fs = require("fs");
const path = require("path");
const Order = require("../models/Order");
const Facility = require("../models/Facility");
const Provider = require("../models/Provider");
const { buildProviderPayload, findOrCreateProvider } = require("./providerService");
const Employee = require("../models/Employee");
const ActivityLog = require("../models/ActivityLog");
const { stripOrderIdTag, mapLogRow } = require("./activityLogService");
const invoiceService = require("./invoiceService");
const Invoice = require("../models/Invoice");
const InvoiceXray = require("../models/InvoiceXray");
const { getPool } = require("../config/database");
const { toRelativeStoragePath, ORDER_UPLOADS_ROOT } = require("../middleware/uploadMiddleware");
const { calculateOrderRushLevel } = require("../utils/rushUtils");
const batchScanRepository = require("../repositories/batchScanRepository");
const fileStorage = require("../utils/fileStorage");
const {
  toInputDate,
  toSqlDateOnly,
  toShortDate,
  formatDobDisplay,
  extractYear,
  formatSsnLastFourDisplay,
} = require("../utils/dateUtils");
const { resolveOrderPeriodStartDate } = require("../utils/orderPeriodFilter");

const WORKFLOW_STAGE_NAMES = [
  "Upload Records",
  "Review Records",
  "Serve",
  "Custodian",
  "SENT",
];
const WORKFLOW_STAGE_STATUSES = ["pending", "complete", "failed", "sent"];
const DEFAULT_PREPAYMENT_CHARGE = 15;
const DEFAULT_CUSTODIAN_CHARGE = 15;

/** Rush 2+ begins at 14 days since created_at (matches rushUtils). */
const RUSH_READY_MIN_DAYS = 14;

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

function isOtherOnlyOrderType(row) {
  return (
    Boolean(row.flag_other_record) &&
    !row.flag_medical_records &&
    !row.flag_billing_records &&
    !row.flag_employment_records &&
    !row.flag_xrays
  );
}

function resolveOrderTypeForForm(row) {
  if (isOtherOnlyOrderType(row)) {
    return "other";
  }

  return row.order_type || "";
}

function resolveOrderTypeForDb(data) {
  const type = trimOrNull(data.type);

  if (type === "other") {
    return {
      orderType: "medical",
      flagOtherRecord: 1,
    };
  }

  return {
    orderType: type,
    flagOtherRecord: boolToInt(data.otherRecord),
  };
}

const DEFAULT_ORDER_FORMS = [
  "Send Copy/Letter",
  "Copy Center",
  "Certification of Records",
  "CNR",
];

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = `${value}`.trim();
  return trimmed === "" ? null : trimmed;
}

function dateOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  return toSqlDateOnly(value);
}

function boolToInt(value) {
  return parseBoolean(value) ? 1 : 0;
}

function hasAnyRecordsRequested(row) {
  return Boolean(
    Number(row?.flag_medical_records) ||
      Number(row?.flag_billing_records) ||
      Number(row?.flag_employment_records) ||
      Number(row?.flag_xrays) ||
      Number(row?.flag_other_record)
  );
}

function resolveOrderFlags(data, hasSubpoenaFile) {
  return {
    isSubpoena: hasSubpoenaFile ? 1 : 0,
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

function generateOrderNumber() {
  const stamp = Date.now().toString().slice(-7);
  return `${stamp}-1`;
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
  const { orderType, flagOtherRecord } = resolveOrderTypeForDb(data);

  return {
    facilityId: Number(data.facility),
    providerId: data.providerId ? Number(data.providerId) : null,
    orderType,
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
    flagOtherRecord: flagOtherRecord,
    specificRecord: trimOrNull(data.specificRecord),
    specificDoctor: trimOrNull(data.specificDoctor),
    fullAddress: trimOrNull(data.fullAddress),
    certificateNoRecords: boolToInt(data.certificateNoRecords),
    cnrReason: trimOrNull(data.cnrReason),
    cnrDelivery: enumOrNull(data.cnrDelivery, ALLOWED_CNR_DELIVERY),
    cnrDateSent: dateOrNull(data.cnrDateSent),
    cnrMemo: boolToInt(data.cnrMemo),
    subpoenaStoragePath: null,
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

function buildRecordsBlock(row) {
  const title = RECORD_TITLES[row.order_type] || "Records";

  const lines = [];
  if (row.specific_record) lines.push(row.specific_record);
  if (row.specific_doctor) lines.push(row.specific_doctor);

  const medicalRecordsUrl = buildSubpoenaUrl(row.medical_records_storage_path);
  const hasCnr = Boolean(Number(row.certificate_no_records));
  const cnrReason = trimOrNull(row.cnr_reason) || "";

  return {
    title,
    lines,
    links: medicalRecordsUrl ? ["View Medical Records"] : [],
    hasMedicalRecords: Boolean(row.medical_records_storage_path),
    medicalRecordsUrl,
    cnrNote: hasCnr
      ? {
          label: Boolean(Number(row.cnr_memo)) ? "Memo" : "CNR Note",
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
  orderPayments = []
) {
  const orderYear = extractYear(row.subpoena_date) || extractYear(row.created_at) || "";
  const dob = formatDobDisplay(row.dob);
  const ssn = formatSsnLastFourDisplay(row.ssn_last_four);
  const doiDisplay = formatDoiDisplay(row);
  const dobSsn = [dob, ssn, doiDisplay].filter(Boolean);

  const rush = calculateOrderRushLevel(row.created_at);

  return {
    id: row.order_number,
    dbId: row.id,
    facility: row.facility_id ? String(row.facility_id) : "",
    facilityName: row.facility_name || "",
    facilityInfo: buildFacilityBlock(row),
    year: orderYear,
    status: row.status,
    displayStatus: deriveDisplayOrderStatus(row.status, row.created_at),
    filterStatus: deriveFilterStatus(row.status),
    workflowStages: workflowStages.map(mapWorkflowStage),
    note: Boolean(row.has_note),
    subpoena: Boolean(Number(row.is_subpoena)),
    isSubpoena: Boolean(Number(row.is_subpoena)),
    hasSubpoenaFile: Boolean(row.subpoena_storage_path),
    subpoenaUrl: buildSubpoenaUrl(row.subpoena_storage_path),
    isRecords: hasAnyRecordsRequested(row),
    isWriteOffs: Boolean(Number(row.is_write_offs)),
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
    createdAt: row.created_at || null,
    rushLevel: rush.level,
    rushLabel: rush.label,
    invoiceStatus: deriveInvoiceDisplayStatus(invoiceRow),
    records: buildRecordsBlock(row),
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
  xrayRow = null
) {
  const paymentSummary = invoiceService.mapOrderPaymentsSummary(payments);
  const paymentForm = enrichPaymentDueFields(
    mapPaymentsToForm(payments),
    invoiceRow,
    xrayRow,
    payments
  );

  return {
    id: row.id,
    orderNumber: row.order_number || "",
    status: row.status || "",
    isSubpoena: Boolean(Number(row.is_subpoena)),
    isRecords: hasAnyRecordsRequested(row),
    isWriteOffs: Boolean(Number(row.is_write_offs)),
    workflowStages: workflowStages.map(mapWorkflowStage),
    notes: notes.map(mapNote),
    facility: row.facility_id ? String(row.facility_id) : "",
    facilityName: row.facility_name || "",
    providerId: row.provider_id ? String(row.provider_id) : "",
    providerName: row.provider_name || "",
    type: resolveOrderTypeForForm(row),
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
    medicalRecordsStoragePath: row.medical_records_storage_path || null,
    medicalRecordsUrl: buildSubpoenaUrl(row.medical_records_storage_path),
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
    createdAt: row.created_at || null,
    readyDate: toInputDate(row.ready_date),
    invoiceDate: toInputDate(row.invoice_date || invoiceRow?.invoice_date),
    xrayInvoiceDate: toInputDate(
      row.xray_invoice_date || xrayRow?.xray_invoice_date
    ),

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

    ...paymentForm,
    paymentLines: paymentSummary.paymentLines,
    orderAmountPaid: paymentSummary.orderAmountPaid,
    invoiceFees: invoiceService.mapOrderInvoiceFees(invoiceRow, xrayRow, payments),
  };
}

async function getAllOrders(query = {}) {
  const filters = {};

  if (query.facility) {
    filters.facilityId = Number(query.facility);
  }

  if (query.status === "ready") {
    filters.readyFilter = true;
  } else if (query.status && STATUS_FILTER_MAP[query.status]) {
    filters.status = STATUS_FILTER_MAP[query.status];
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

  if (query.search && `${query.search}`.trim()) {
    filters.search = `${query.search}`.trim();
  }

  if (query.limit) {
    const limit = Number(query.limit);
    if (Number.isFinite(limit) && limit > 0) {
      filters.limit = limit;
    }
  }

  const rows = await Order.findAll(filters);

  const orderIds = rows.map((row) => row.id);
  const stages = await Order.findWorkflowStagesByOrderIds(orderIds);
  const invoicesByOrderId = await invoiceService.getStandardInvoicesByOrderIds(orderIds);
  const xrayByOrderId = await invoiceService.getXrayDetailsByOrderIds(orderIds);
  const paymentRows = await Order.findPaymentsByOrderIds(orderIds);

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

  return rows.map((row) => {
    const invoiceRow = invoicesByOrderId[row.id] || null;
    const xrayRow = xrayByOrderId[row.id] || null;

    return mapOrderListRow(
      row,
      stagesByOrderId[row.id] || [],
      invoiceRow,
      xrayRow,
      paymentsByOrderId[row.id] || []
    );
  });
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

  return mapOrderDetail(
    order,
    payments,
    documents,
    workflowStages,
    notes,
    invoiceRow,
    xrayRow
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
  { includeCalled = false, noteId = null, actorId = null, actorRole = null } = {}
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

  const notes = await Order.findNotesByOrderId(order.id, includeCalled ? false : true);
  return notes.map(mapNote);
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

  await addOrderActivityLog({
    orderId: order.id,
    actorId,
    authorName,
    note: noteText,
    callbackDate: dateOrNull(data.callbackDate),
    attachmentPath: toRelativeStoragePath(file),
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

  const employee = await Employee.findById(actorId);
  const isAdmin = String(employee?.role || "").toLowerCase() === "admin";

  if (!isAdmin && Number(note.created_by) !== Number(actorId)) {
    throw new ApiError(403, "You can only update your own notes");
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
  const globalLogs = await ActivityLog.findByOrderId(order.id, {
    orderNumber: order.order_number || null,
  });
  const notes = await Order.findNotesByOrderId(order.id, false);

  const mappedOrderLogs = logs.map((log) => {
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

  const mappedGlobalLogs = globalLogs.map(mapGlobalOrderActivityLog);

  return mergeOrderActivityLogs(mappedOrderLogs, mappedGlobalLogs);
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

async function createOrder(data, actorId, files) {
  assertValidCnrDeliveryDate(data);

  const facility = await Facility.findById(Number(data.facility));

  if (!facility) {
    throw new ApiError(400, "Selected facility does not exist");
  }

  const orderNumber = await resolveOrderNumber(data.orderNumber);
  const payments = collectPayments(data);

  const subpoenaFile = getUploadedFile(files, "subpoenaFile");
  const additionalDocFile = getUploadedFile(files, "additionalDocumentFile");
  const subpoenaExtractId = Number(data.subpoenaExtractId) || null;

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
      throw new ApiError(404, error.message || "Subpoena PDF not found on disk");
    }
  } else {
    subpoenaStoragePath = toRelativeStoragePath(subpoenaFile);
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const providerId = await resolveProviderId(connection, data);
    const payload = buildOrderDbPayload(
      applyInjuryFromExtract({ ...data, providerId }, linkedExtract)
    );
    const hasSubpoenaFile = Boolean(subpoenaStoragePath);
    const orderFlags = resolveOrderFlags(data, hasSubpoenaFile);

    const orderId = await Order.create(connection, {
      ...payload,
      subpoenaStoragePath,
      orderNumber,
      status: "Active",
      hasNote: 0,
      isSubpoena: orderFlags.isSubpoena,
      createdBy: actorId || null,
    });

    await syncOrderPayments(connection, orderId, data);

    await saveOrderDocuments(connection, {
      orderId,
      additionalDocFile,
      documentName: data.documentName,
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
      skipCustodian: isCnrOrder(data),
    });

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
  assertValidCnrDeliveryDate(data);

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
    const hasSubpoenaFile = Boolean(subpoenaStoragePath);
    const orderFlags = resolveOrderFlags(data, hasSubpoenaFile);

    await Order.update(connection, existing.id, {
      ...payload,
      subpoenaStoragePath,
      isSubpoena: orderFlags.isSubpoena,
      orderNumber,
    });

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

    return getOrderById(existing.id);
  } catch (error) {
    await connection.rollback();
    throw error;
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

  const trimmedReason = trimOrNull(reason);
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
    throw new ApiError(404, "Subpoena PDF file not found on disk");
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

async function scanMedicalRecords(orderId, file, _actorId, { replace = false } = {}) {
  if (!file) {
    throw new ApiError(400, "Medical records PDF is required");
  }

  const existing = await Order.findById(orderId);
  if (!existing) {
    throw new ApiError(404, "Order not found");
  }

  const hasExistingRecords = Boolean(existing.medical_records_storage_path);

  if (hasExistingRecords && !replace) {
    throw new ApiError(
      409,
      "Medical records were already uploaded for this order"
    );
  }

  const storagePath = toRelativeStoragePath(file);
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (hasExistingRecords) {
      deleteStoredMedicalRecordsFile(existing.medical_records_storage_path);
    }

    await connection.execute(
      `UPDATE orders
       SET medical_records_storage_path = :storagePath, updated_at = NOW()
       WHERE id = :orderId`,
      { storagePath, orderId }
    );

    await Order.upsertWorkflowStage(
      orderId,
      "Upload Records",
      "complete",
      new Date(),
      connection
    );

    await Order.upsertWorkflowStage(
      orderId,
      "Review Records",
      "complete",
      new Date(),
      connection
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getOrderById(orderId);
}

async function removeMedicalRecords(orderId, _actorId) {
  const existing = await Order.findById(orderId);
  if (!existing) {
    throw new ApiError(404, "Order not found");
  }

  if (!existing.medical_records_storage_path) {
    throw new ApiError(404, "Medical records file not found for this order");
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    deleteStoredMedicalRecordsFile(existing.medical_records_storage_path);

    await connection.execute(
      `UPDATE orders
       SET medical_records_storage_path = NULL, updated_at = NOW()
       WHERE id = :orderId`,
      { orderId }
    );

    await Order.upsertWorkflowStage(
      orderId,
      "Upload Records",
      "pending",
      null,
      connection
    );
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
    throw error;
  } finally {
    connection.release();
  }

  return getOrderById(orderId);
}

async function getOrderMedicalRecordsFile(orderId) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (!order.medical_records_storage_path) {
    throw new ApiError(404, "Medical records file not found for this order");
  }

  const absolutePath = resolveOrderSubpoenaAbsolutePath(
    order.medical_records_storage_path
  );

  if (!absolutePath || !fs.existsSync(absolutePath)) {
    throw new ApiError(404, "Medical records PDF file not found on disk");
  }

  await Order.upsertWorkflowStage(
    orderId,
    "Review Records",
    "complete",
    new Date()
  );

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

function resolveMedicalRecordsAttachment(order) {
  if (!order?.medical_records_storage_path) {
    return null;
  }

  const absolutePath = resolveOrderSubpoenaAbsolutePath(
    order.medical_records_storage_path
  );

  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return null;
  }

  const safeOrderNumber = `${order.order_number || order.id}`.replace(
    /[^\w.-]+/g,
    "_"
  );

  return {
    filename: `${safeOrderNumber}-medical-records.pdf`,
    path: absolutePath,
  };
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

async function mailCompletedOrder(orderId, { email, deliveryDate } = {}) {
  const normalizedId = Number(orderId);
  const recipient = trimOrNull(email);

  if (!Number.isFinite(normalizedId)) {
    throw new ApiError(400, "Invalid order id");
  }

  if (!recipient) {
    throw new ApiError(400, "Email is required");
  }

  if (!EMAIL_PATTERN.test(recipient)) {
    throw new ApiError(400, "Enter a valid email address");
  }

  const order = await Order.findById(normalizedId);
  assertReadyForDelivery(order);

  const medicalRecordsAttachment = resolveMedicalRecordsAttachment(order);
  if (!medicalRecordsAttachment) {
    throw new ApiError(
      400,
      "Medical records file not found. Scan medical records before sending mail."
    );
  }

  const mailSentDate = dateOrNull(deliveryDate);
  if (!mailSentDate) {
    throw new ApiError(400, "Mail sent date is required");
  }

  const pool = getPool();

  const setCnrDate =
    Number(order.certificate_no_records) && order.cnr_delivery === "email";

  const { sendOrderCompletedMail } = require("./emailService");
  const result = await sendOrderCompletedMail({
    to: recipient,
    orderNumber: order.order_number,
    applicant: buildApplicantName(order),
    providerName: order.serve_company_name || order.provider_name || "",
    attachments: [medicalRecordsAttachment],
  });

  if (!result.delivered && !result.devLogged) {
    throw new ApiError(500, "Failed to send email");
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
    recipient,
    delivered: result.delivered,
    devLogged: Boolean(result.devLogged),
    sentDate: mailSentDate,
    readyDate: mailSentDate,
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

async function searchOrderDoctors(query) {
  return Order.searchDoctors(query);
}

async function searchOrderDoctorAddresses(query) {
  return Order.searchDoctorAddresses(query);
}

module.exports = {
  getAllOrders,
  getOrderStats,
  getOrderById,
  getOrderReminders,
  createOrder,
  updateOrder,
  deleteOrder,
  cancelOrder,
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
  sendCopyServiceLetter,
  getPrintInvoicePdf,
  getPrintXrayInvoicePdf,
  recordOrderFax,
  recordOrderPickup,
  searchOrderDoctors,
  searchOrderDoctorAddresses,
};
