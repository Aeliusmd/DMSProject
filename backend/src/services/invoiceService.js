const ApiError = require("../utils/ApiError");
const Invoice = require("../models/Invoice");
const InvoiceXray = require("../models/InvoiceXray");
const Order = require("../models/Order");
const Provider = require("../models/Provider");
const config = require("../config");
const { getPool } = require("../config/database");
const { calculateOrderRushLevel } = require("../utils/rushUtils");
const { formatDobDisplay } = require("../utils/dateUtils");

const ORDER_TYPE_LABELS = {
  medical: "Medical Records",
  billing: "Billing Records",
  employment: "Employment Records",
  xrays: "X-Rays",
  other: "Other",
};

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = `${value}`.trim();
  return trimmed === "" ? null : trimmed;
}

function getInvoiceRecipientEmail(row) {
  return trimOrNull(row?.provider_email);
}

function getInvoiceDisplayEmail(row) {
  return (
    getInvoiceRecipientEmail(row) ||
    trimOrNull(row?.recipient_emails) ||
    trimOrNull(row?.serve_email) ||
    ""
  );
}

async function resolveInvoiceRecipientFromOrder(order, connection = null) {
  const providerId = order?.provider_id || null;

  if (providerId) {
    const provider = await Provider.findById(providerId, connection);
    const providerEmail = trimOrNull(provider?.email);
    if (providerEmail) {
      return providerEmail;
    }
  }

  return trimOrNull(order?.provider_email);
}

async function resolveInvoiceRecipientEmail(invoice, connection = null) {
  if (invoice?.order_id) {
    const order = await Order.findById(invoice.order_id, connection);
    const fromOrder = await resolveInvoiceRecipientFromOrder(order, connection);
    if (fromOrder) {
      return fromOrder;
    }
  }

  return getInvoiceRecipientEmail(invoice);
}

async function resolveAutomaticReminderRecipientEmails({
  invoice = null,
  order = null,
  xrayRow = null,
} = {}) {
  const stored =
    trimOrNull(invoice?.recipient_emails) || trimOrNull(xrayRow?.recipient_emails);

  if (stored) {
    return normalizeRecipientEmails(stored);
  }

  if (invoice) {
    const resolved = await resolveInvoiceRecipientEmail(invoice);
    if (resolved) {
      return normalizeRecipientEmails(resolved);
    }
  }

  if (order) {
    const fromOrder = await resolveInvoiceRecipientFromOrder(order);
    if (fromOrder) {
      return normalizeRecipientEmails(fromOrder);
    }

    const serveEmail = trimOrNull(order.serve_email);
    if (serveEmail) {
      return normalizeRecipientEmails(serveEmail);
    }
  }

  return [];
}

const NO_PROVIDER_EMAIL_MESSAGE =
  "No provider email on file. Edit the order to add the provider email.";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function normalizeRecipientEmails(value) {
  const raw = Array.isArray(value)
    ? value
    : `${value || ""}`.split(/[,;]+/);

  const seen = new Set();
  const emails = [];

  raw.forEach((item) => {
    const trimmed = `${item || ""}`.trim();
    if (!trimmed) return;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    emails.push(trimmed);
  });

  return emails;
}

function assertValidRecipientEmails(emails = []) {
  const normalized = normalizeRecipientEmails(emails);

  if (!normalized.length) {
    throw new ApiError(400, "At least one recipient email is required");
  }

  const invalidEmail = normalized.find((email) => !EMAIL_PATTERN.test(email));
  if (invalidEmail) {
    throw new ApiError(400, `Invalid email address: ${invalidEmail}`);
  }

  return normalized;
}

function getXrayPayment(xrayRow) {
  return xrayRow ? toNumber(xrayRow.payment) : 0;
}

const ORDER_PAYMENT_TYPES = ["prepayment", "custodian", "xray"];
const STANDARD_INVOICE_PAYMENT_TYPES = ["prepayment"];
const DEFAULT_CUSTODIAN_CHARGE = 15;
const DEFAULT_PREPAYMENT_CHARGE = 15;

const ORDER_PAYMENT_LABELS = {
  prepayment: "Prepayment",
  custodian: "Custodian",
  xray: "X-Ray Fee",
};

function getOrderPaymentAmount(payments = [], paymentType) {
  const payment = payments.find((row) => row.payment_type === paymentType);
  if (!payment) return 0;

  const amount = toNumber(payment.amount);
  return amount > 0 ? amount : 0;
}

function sumOrderPayments(payments = []) {
  return ORDER_PAYMENT_TYPES.reduce(
    (sum, paymentType) => sum + getOrderPaymentAmount(payments, paymentType),
    0
  );
}

function sumStandardInvoicePayments(payments = []) {
  return STANDARD_INVOICE_PAYMENT_TYPES.reduce(
    (sum, paymentType) => sum + getOrderPaymentAmount(payments, paymentType),
    0
  );
}

function resolveAmountPaid(orderPayments, existing = null) {
  if (orderPayments !== undefined) {
    return sumStandardInvoicePayments(orderPayments);
  }

  if (existing) {
    return toNumber(existing.amount_paid);
  }

  return 0;
}

function resolveInvoiceStatusForSave(existing, totalAmount, amountPaid, derivedStatus) {
  if (!existing) {
    return derivedStatus ?? deriveInvoiceStatus(totalAmount, amountPaid);
  }

  if (existing.status === "Written Off") {
    return "Written Off";
  }

  if (existing.status === "Needs Resend") {
    return "Needs Resend";
  }

  return derivedStatus ?? deriveInvoiceStatus(totalAmount, amountPaid);
}

async function syncInvoiceAmountPaidFromOrder(connection, orderId) {
  const db = connection || getPool();

  const [invoiceRows] = await db.execute(
    `SELECT id, page_count, per_page_amount,
            clerical_time_hours, clerical_hourly_rate, shipping_handling, storage_fee,
            total_amount, status, writeoff_amount, amount_paid
     FROM invoices
     WHERE order_id = :orderId
     LIMIT 1`,
    { orderId }
  );
  const invoice = invoiceRows[0];

  if (!invoice) {
    return null;
  }

  const orderPayments = await Order.findPaymentsByOrderId(orderId, connection);
  const financials = resolveRowFinancials(invoice, orderPayments);
  const status = resolveInvoiceStatusForSave(
    invoice,
    financials.totalAmount,
    financials.amountPaid,
    deriveInvoiceStatus(
      financials.totalAmount,
      financials.amountPaid,
      financials.writeoffAmount
    )
  );

  await db.execute(
    `UPDATE invoices
     SET total_amount = :totalAmount,
         amount_paid = :amountPaid,
         amount_due = :amountDue,
         status = :status,
         updated_at = NOW()
     WHERE id = :id`,
    {
      totalAmount: financials.totalAmount,
      amountPaid: financials.amountPaid,
      amountDue: financials.amountDue,
      status,
      id: invoice.id,
    }
  );

  return {
    amountPaid: financials.amountPaid,
    amountDue: financials.amountDue,
    status,
  };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
}

function getStorageFee(rowOrPayload = {}) {
  const storageFee = toNumber(rowOrPayload.storage_fee ?? rowOrPayload.storageFee);
  if (storageFee > 0) {
    return storageFee;
  }

  return toNumber(rowOrPayload.other_fee ?? rowOrPayload.other);
}


function boolToInt(value) {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" ? 1 : 0;
  }
  return value ? 1 : 0;
}

function toShortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
}

function toCompactDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);

  return `${month}/${day}/${year}`;
}

function formatDateTimeDisplay(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function mapInvoiceReminderField(sentAt, level) {
  const sent = Boolean(sentAt);

  return {
    level,
    sent,
    sentAt: sentAt || null,
    sentAtDisplay: sent ? formatDateTimeDisplay(sentAt) : null,
    label: sent ? `Sent Reminder ${level}` : "Didn't send",
  };
}

function mapInvoiceReminderFields(row = {}) {
  return {
    reminder1: mapInvoiceReminderField(row.reminder_1_sent_at, 1),
    reminder2: mapInvoiceReminderField(row.reminder_2_sent_at, 2),
    reminder3: mapInvoiceReminderField(row.reminder_3_sent_at, 3),
  };
}

function toInputDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();

  return `${year}-${month}-${day}`;
}

function formatMoney(value) {
  const amount = toNumber(value);
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function buildApplicantName(row) {
  return [row.applicant_first_name, row.applicant_middle_name, row.applicant_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getInvoiceCompanyId(row) {
  const providerId = Number(row?.provider_id);
  return Number.isFinite(providerId) && providerId > 0 ? providerId : 0;
}

function getInvoiceCompanyName(row) {
  return (
    trimOrNull(row?.provider_name) ||
    trimOrNull(row?.serve_company_name) ||
    trimOrNull(row?.facility_name) ||
    "Unknown Company"
  );
}

function formatOrderRecordTypesLabel(orderRow) {
  const raw = orderRow?.order_record_types || orderRow?.order_type || "";
  const types = `${raw}`
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (!types.length) {
    return "";
  }

  return types
    .map((type) => ORDER_TYPE_LABELS[type] || type)
    .join(", ");
}

function withOrderRecordTypes(orderRow, sourceRow) {
  if (!orderRow) {
    return sourceRow || null;
  }

  const orderRecordTypes =
    sourceRow?.order_record_types || orderRow?.order_record_types || "";

  if (!orderRecordTypes) {
    return orderRow;
  }

  return {
    ...orderRow,
    order_record_types: orderRecordTypes,
  };
}

function resolveYourFileNumber(orderRow) {
  if (!orderRow) return "";

  const typeLabel = trimOrNull(formatOrderRecordTypesLabel(orderRow));
  if (typeLabel) return typeLabel;

  return trimOrNull(orderRow.specific_record) || "";
}

function buildOrderDetailsText(row, orderPayments = []) {
  if (!row) return "";

  const lines = [];
  const push = (label, value) => {
    const normalized = trimOrNull(value);
    if (normalized) {
      lines.push(`${label}: ${normalized}`);
    }
  };

  push("Order Number", row.order_number);
  push("Case Number", row.case_number);
  push("Applicant", buildApplicantName(row));
  push("Defendant", row.defendant);
  push(
    "Record Type",
    formatOrderRecordTypesLabel(row) || trimOrNull(row.specific_record)
  );
  push("Specific Record", row.specific_record);
  push("Doctor", row.specific_doctor);
  push("Serve Company", row.serve_company_name);

  const serveAddress = [
    trimOrNull(row.serve_address),
    [trimOrNull(row.serve_city), trimOrNull(row.serve_state)]
      .filter(Boolean)
      .join(", "),
    trimOrNull(row.serve_zip),
  ]
    .filter(Boolean)
    .join(" ");

  push("Serve Address", serveAddress);
  push(
    "Subpoena Date",
    row.subpoena_date ? toShortDate(row.subpoena_date) : null
  );
  push(
    "Depo Due Date",
    row.depo_due_date ? toShortDate(row.depo_due_date) : null
  );
  push(
    "Date Served",
    row.date_served ? toShortDate(row.date_served) : null
  );

  const feeLines = buildInvoiceFeeSummaryLines(row, orderPayments);
  if (feeLines.length) {
    lines.push("");
    lines.push("Invoice Fees:");
    lines.push(...feeLines);
  }

  return lines.join("\n");
}

function buildInvoiceFeeSummaryLines(row, orderPayments = []) {
  if (!row) return [];

  const totals = calculateTotalsWithPayments(
    {
      pages: row.page_count,
      perPageAmount: row.per_page_amount,
      clericalTimeHours: row.clerical_time_hours,
      clericalHourlyRate: row.clerical_hourly_rate,
      shippingHandling: row.shipping_handling,
      storageFee: getStorageFee(row),
    },
    orderPayments
  );
  const financials = resolveRowFinancials(row, orderPayments);
  const lines = [];
  const pushFee = (label, amount) => {
    if (toNumber(amount) > 0) {
      lines.push(`${label}: ${formatMoney(amount)}`);
    }
  };

  if (totals.pageCount > 0 && totals.perPageAmount > 0) {
    lines.push(
      `Per Page Charge (${totals.pageCount} x ${formatMoney(totals.perPageAmount)}): ${formatMoney(totals.pageCount * totals.perPageAmount)}`
    );
  }

  if (totals.clericalAmount > 0) {
    lines.push(`Clerical Time: ${formatMoney(totals.clericalAmount)}`);
  }

  pushFee("Shipping & Handling", totals.shippingHandling);
  pushFee("Storage Fee", totals.storageFee);
  lines.push(`Total Invoiced: ${formatMoney(financials.totalAmount)}`);
  lines.push(`Total Paid: ${formatMoney(financials.amountPaid)}`);
  lines.push(`Amount Due: ${formatMoney(financials.amountDue)}`);

  return lines;
}

function daysSince(dateValue) {
  if (!dateValue) return 0;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return Math.max(0, Math.floor((today - date) / (1000 * 60 * 60 * 24)));
}

function calculateTotals(payload = {}, { includeXrayFee = false } = {}) {
  const xrayFee = includeXrayFee ? toNumber(payload.xrayFee) : 0;
  const pageCount = Math.max(0, Math.floor(toNumber(payload.pages)));
  const perPageAmount = toNumber(payload.perPageAmount);
  const pagesAmount = pageCount * perPageAmount;
  const clericalTimeHours = Math.max(0, toNumber(payload.clericalTimeHours));
  const clericalHourlyRate = toNumber(payload.clericalHourlyRate);
  const clericalAmount = clericalTimeHours * clericalHourlyRate;
  const shippingHandling = toNumber(payload.shippingHandling);
  const storageFee = getStorageFee(payload);

  const totalAmount =
    xrayFee +
    pagesAmount +
    clericalAmount +
    shippingHandling +
    storageFee;

  return {
    custodianFee: 0,
    xrayFee,
    pageCount,
    perPageAmount,
    pagesAmount,
    clericalTimeHours,
    clericalHourlyRate,
    clericalAmount,
    shippingHandling,
    storageFee,
    totalAmount,
  };
}

function normalizeGrossFee(storedFee, paidAmount) {
  const stored = toNumber(storedFee);
  const paid = toNumber(paidAmount);
  const due = Math.max(0, stored - paid);

  return due + paid;
}

function groupPaymentsByOrderId(paymentRows = []) {
  return paymentRows.reduce((acc, payment) => {
    const orderId = payment.order_id;

    if (!acc[orderId]) {
      acc[orderId] = [];
    }

    acc[orderId].push(payment);
    return acc;
  }, {});
}

function calculateTotalsWithPayments(payload = {}, orderPayments = [], options = {}) {
  const includeXrayFee = options.includeXrayFee === true;
  const xrayPaid = getOrderPaymentAmount(orderPayments, "xray");

  return calculateTotals(
    {
      ...payload,
      xrayFee: includeXrayFee
        ? normalizeGrossFee(payload.xrayFee, xrayPaid)
        : 0,
    },
    { includeXrayFee }
  );
}

function resolveRowFinancials(row, orderPayments = []) {
  const totals = calculateTotalsWithPayments(
    {
      pages: row.page_count,
      perPageAmount: row.per_page_amount,
      clericalTimeHours: row.clerical_time_hours,
      clericalHourlyRate: row.clerical_hourly_rate,
      shippingHandling: row.shipping_handling,
      storageFee: getStorageFee(row),
    },
    orderPayments
  );
  const amountPaid = orderPayments.length
    ? sumStandardInvoicePayments(orderPayments)
    : toNumber(row.amount_paid);
  const writeoffAmount = toNumber(row.writeoff_amount);
  const { amountDue } = resolveInvoiceAmounts(
    totals.totalAmount,
    amountPaid,
    writeoffAmount
  );

  return {
    totalAmount: totals.totalAmount,
    amountPaid,
    amountDue,
    writeoffAmount,
  };
}

function mapInvoiceDetail(row) {
  if (!row) return null;

  return {
    id: row.id,
    invoiceNumber: row.invoice_number || "",
    orderId: row.order_id,
    orderNumber: row.order_number || "",
    facilityId: row.facility_id,
    facilityName: row.facility_name || "",
    status: row.status,
    invoiceDate: toInputDate(row.invoice_date),
    sentDate: toInputDate(row.sent_date),
    custodianFee: "0.00",
    xrayFee: "0.00",
    storageFee: getStorageFee(row).toFixed(2),
    pages: String(row.page_count ?? 0),
    perPageAmount: toNumber(row.per_page_amount).toFixed(2),
    clericalTimeHours: toNumber(row.clerical_time_hours).toFixed(2),
    clericalHourlyRate: toNumber(row.clerical_hourly_rate).toFixed(2),
    clericalAmount: (
      toNumber(row.clerical_time_hours) * toNumber(row.clerical_hourly_rate)
    ).toFixed(2),
    shippingHandling: toNumber(row.shipping_handling).toFixed(2),
    totalAmount: toNumber(row.total_amount),
    amountPaid: toNumber(row.amount_paid),
    amountDue: toNumber(row.amount_due),
    writeoffAmount: toNumber(row.writeoff_amount),
    notes: row.notes || "",
    sendOrderDetails: Boolean(row.send_order_details),
    rushOrder: Boolean(row.is_rush_order),
    rushLevel: calculateOrderRushLevel(row.order_created_at).label,
    subpoenaDate: toInputDate(row.subpoena_date),
    applicant: buildApplicantName(row),
  };
}

function deriveInvoiceStatus(totalAmount, amountPaid, writeoffAmount = 0) {
  const total = toNumber(totalAmount);
  const paid = toNumber(amountPaid);
  const writeoff = toNumber(writeoffAmount);
  const amountDue = Math.max(0, total - paid - writeoff);

  if (amountDue <= 0) {
    if (paid >= total) {
      return "Paid";
    }

    if (writeoff > 0 && paid < total) {
      return "Written Off";
    }

    return paid > 0 ? "Paid" : writeoff > 0 ? "Written Off" : "Unpaid";
  }

  if (paid <= 0) {
    return "Unpaid";
  }

  return "Partial";
}

function resolveInvoiceAmounts(totalAmount, amountPaid, writeoffAmount = 0) {
  const total = toNumber(totalAmount);
  const paid = toNumber(amountPaid);
  const writeoff = toNumber(writeoffAmount);
  const amountDue = Math.max(0, total - paid - writeoff);
  const overpayment = Math.max(0, paid - total);
  const status = deriveInvoiceStatus(total, paid, writeoff);

  return {
    amountDue,
    overpayment,
    status,
    isOverpaid: overpayment > 0,
  };
}

function mapXrayDetail(row, orderPayments = []) {
  const xrayPaidEarlier = getOrderPaymentAmount(orderPayments, "xray");

  if (!row) {
    return {
      xrayInvoiceDate: "",
      examDate: "",
      views: "0",
      perViewAmount: "0.00",
      payment: "0.00",
      xrayPaidEarlier: xrayPaidEarlier.toFixed(2),
      prepayment: xrayPaidEarlier.toFixed(2),
      checkNumber: "",
      description: "",
      recipientEmail: "",
    };
  }

  const payment = getXrayPayment(row);

  return {
    xrayInvoiceDate: toInputDate(row.xray_invoice_date),
    examDate: toInputDate(row.exam_date),
    views: String(row.view_count ?? 0),
    perViewAmount: toNumber(row.per_view_amount).toFixed(2),
    payment: payment.toFixed(2),
    xrayPaidEarlier: xrayPaidEarlier.toFixed(2),
    prepayment: xrayPaidEarlier.toFixed(2),
    checkNumber: row.check_number || "",
    description: row.description || "",
    recipientEmail: trimOrNull(row.recipient_emails) || "",
  };
}

function hasStandardInvoiceFields(row) {
  return (
    Boolean(row.invoice_date) ||
    toNumber(row.page_count) > 0 ||
    toNumber(row.clerical_time_hours) > 0 ||
    toNumber(row.clerical_hourly_rate) > 0 ||
    toNumber(row.shipping_handling) > 0 ||
    getStorageFee(row) > 0
  );
}

function mapXrayReviewAmount(xrayRow, orderPayments = []) {
  if (!xrayRow) return null;

  const payment = getXrayPayment(xrayRow);
  const xrayPaidEarlier = getOrderPaymentAmount(orderPayments, "xray");
  const balanceDue = Math.max(0, payment - xrayPaidEarlier);

  return formatMoney(balanceDue);
}

function mapOrderPaymentsSummary(payments = []) {
  const amounts = ORDER_PAYMENT_TYPES.reduce((acc, paymentType) => {
    acc[paymentType] = getOrderPaymentAmount(payments, paymentType);
    return acc;
  }, {});

  const paymentLines = ORDER_PAYMENT_TYPES.reduce((lines, paymentType) => {
    const amount = amounts[paymentType];
    if (amount <= 0) return lines;

    lines.push({
      type: paymentType,
      label: ORDER_PAYMENT_LABELS[paymentType],
      amount,
      bracketLabel: `${ORDER_PAYMENT_LABELS[paymentType]} (${formatMoney(amount)})`,
    });

    return lines;
  }, []);

  return {
    prepaymentPaid: amounts.prepayment,
    custodianPaid: amounts.custodian,
    xrayPaid: amounts.xray,
    orderAmountPaid: sumOrderPayments(payments),
    paymentLines,
  };
}

function pushPrintFeeLine(feeLines, line) {
  const total = toNumber(line.total);

  if (total > 0) {
    feeLines.push({ ...line, total });
  }
}

function appendPrintInvoiceDeductions(feeLines, invoiceRow, orderPayments = []) {
  const prepaymentPaid = getOrderPaymentAmount(orderPayments, "prepayment");

  if (prepaymentPaid > 0) {
    const prepayment = orderPayments.find((row) => row.payment_type === "prepayment");
    const checkLabel = trimOrNull(prepayment?.check_number)
      ? `CK# ${prepayment.check_number}`
      : "";

    feeLines.push({
      description: "Prepayment",
      quantity: checkLabel,
      total: -prepaymentPaid,
      italic: true,
    });
  }

  const writeoffAmount = toNumber(invoiceRow.writeoff_amount);

  if (writeoffAmount > 0) {
    feeLines.push({
      description: "Written Off",
      quantity: "",
      total: -writeoffAmount,
      italic: true,
    });
  }
}

function buildPrintInvoicePdfData(invoiceRow, orderRow, orderPayments = []) {
  if (!invoiceRow || !orderRow) {
    return null;
  }

  const pageCount = Math.max(0, Math.floor(toNumber(invoiceRow.page_count)));
  const perPageAmount = toNumber(invoiceRow.per_page_amount);
  const pagesTotal = pageCount * perPageAmount;
  const clericalTimeHours = Math.max(0, toNumber(invoiceRow.clerical_time_hours));
  const clericalHourlyRate = toNumber(invoiceRow.clerical_hourly_rate);
  const clericalAmount = clericalTimeHours * clericalHourlyRate;
  const shippingHandling = toNumber(invoiceRow.shipping_handling);
  const storageFee = getStorageFee(invoiceRow);

  const feeLines = [];

  if (clericalAmount > 0) {
    pushPrintFeeLine(feeLines, {
      description: `Clerical time $${formatPerViewRate(clericalHourlyRate)} per hour`,
      quantity: clericalTimeHours.toFixed(2),
      total: clericalAmount,
    });
  }

  if (pagesTotal > 0) {
    pushPrintFeeLine(feeLines, {
      description: "Per Page Charge",
      quantity: String(pageCount),
      total: pagesTotal,
    });
  }

  if (shippingHandling > 0) {
    pushPrintFeeLine(feeLines, {
      description: "Shipping & Handling",
      quantity: "1",
      total: shippingHandling,
    });
  }

  if (storageFee > 0) {
    pushPrintFeeLine(feeLines, {
      description: "Storage Fee",
      quantity: "1",
      total: storageFee,
    });
  }

  appendPrintInvoiceDeductions(feeLines, invoiceRow, orderPayments);

  const financials = resolveRowFinancials(invoiceRow, orderPayments);

  return {
    customer: orderRow.serve_company_name || orderRow.provider_name || "",
    requestedBy: orderRow.serve_company_name || orderRow.provider_name || "",
    yourFileNumber: resolveYourFileNumber(
      withOrderRecordTypes(orderRow, invoiceRow)
    ),
    ourCaseNumber: orderRow.order_number || "",
    applicant: buildApplicantName(orderRow),
    feeLines,
    totalInvoiced: financials.totalAmount,
    totalDue: financials.amountDue,
    amountPaid: financials.amountPaid,
  };
}

function formatPerViewRate(amount) {
  const value = toNumber(amount);

  if (Number.isInteger(value) || value === Math.trunc(value)) {
    return String(Math.trunc(value));
  }

  return value.toFixed(2);
}

function buildPrintXrayInvoicePdfData(xrayRow, orderRow, orderPayments = []) {
  if (!xrayRow || !orderRow) {
    return null;
  }

  const viewCount = Math.max(0, Math.floor(toNumber(xrayRow.view_count)));
  const perViewAmount = toNumber(xrayRow.per_view_amount);
  const viewsTotal = viewCount * perViewAmount;
  const xrayPaidEarlier = getOrderPaymentAmount(orderPayments, "xray");
  const totalInvoiced = viewsTotal - xrayPaidEarlier;
  const totalDue = Math.max(0, totalInvoiced);
  const description = trimOrNull(xrayRow.description) || "";
  const feeLines = [];

  if (viewsTotal > 0) {
    feeLines.push({
      description: `Views @ $${formatPerViewRate(perViewAmount)} per`,
      quantity: String(viewCount),
      total: viewsTotal,
      subDescription: description,
    });
  }

  if (xrayPaidEarlier > 0) {
    const checkLabel = trimOrNull(xrayRow.check_number)
      ? `CK# ${xrayRow.check_number}`
      : "CK#";

    feeLines.push({
      description: "Processing Fee",
      quantity: checkLabel,
      total: -xrayPaidEarlier,
    });
  }

  return {
    customer: orderRow.provider_name || orderRow.serve_company_name || "",
    requestedBy: orderRow.serve_company_name || orderRow.provider_name || "",
    specificDoctor: orderRow.specific_doctor || "",
    yourFileNumber: resolveYourFileNumber(
      withOrderRecordTypes(orderRow, xrayRow)
    ),
    ourCaseNumber: orderRow.order_number || "",
    applicant: buildApplicantName(orderRow),
    dob: formatDobDisplay(orderRow.dob) || "",
    examDate: toShortDate(xrayRow.exam_date) || "",
    feeLines,
    totalInvoiced,
    totalDue,
  };
}

function mapOrderInvoiceFees(invoiceRow, xrayRow = null, orderPayments = []) {
  const xrayPayment = xrayRow ? toNumber(xrayRow.payment) : 0;

  if (!invoiceRow) {
    return {
      hasInvoice: false,
      hasXrayInvoice: Boolean(xrayRow),
      invoiceTotal: 0,
      prepaymentPaid: 0,
      writeoffAmount: 0,
      xrayFee: xrayPayment,
    };
  }

  const totals = calculateTotalsWithPayments(
    {
      pages: invoiceRow.page_count,
      perPageAmount: invoiceRow.per_page_amount,
      clericalTimeHours: invoiceRow.clerical_time_hours,
      clericalHourlyRate: invoiceRow.clerical_hourly_rate,
      shippingHandling: invoiceRow.shipping_handling,
      storageFee: getStorageFee(invoiceRow),
    },
    orderPayments
  );
  const financials = resolveRowFinancials(invoiceRow, orderPayments);

  return {
    hasInvoice: true,
    hasXrayInvoice: Boolean(xrayRow),
    invoiceTotal: totals.totalAmount,
    invoiceAmountPaid: financials.amountPaid,
    invoiceAmountDue: financials.amountDue,
    prepaymentPaid: getOrderPaymentAmount(orderPayments, "prepayment"),
    writeoffAmount: toNumber(invoiceRow.writeoff_amount),
    xrayFee: xrayPayment,
    storageFee: getStorageFee(invoiceRow),
  };
}

function resolveCustodianDueAmount(_invoiceFees = {}, custodianPaid = 0) {
  const paid = toNumber(custodianPaid);
  return Math.max(0, DEFAULT_CUSTODIAN_CHARGE - paid);
}

function resolveCustodianPaymentDue(_invoiceRow, orderPayments = []) {
  const custodianPaid = getOrderPaymentAmount(orderPayments, "custodian");
  return resolveCustodianDueAmount({}, custodianPaid);
}

function shouldMarkCustodianStageComplete(dueAmount, custodianPaid) {
  if (toNumber(dueAmount) > 0) {
    return false;
  }

  return toNumber(custodianPaid) > 0;
}

function resolveXrayPaymentDue(xrayRow, orderPayments = []) {
  if (!xrayRow) {
    return 0;
  }

  const xrayFee = toNumber(xrayRow.payment);
  const xrayPaid = getOrderPaymentAmount(orderPayments, "xray");

  return Math.max(0, xrayFee - xrayPaid);
}

async function upsertOrderPaymentDue(
  connection,
  orderId,
  paymentType,
  dueAmount,
  payments
) {
  const payment = payments.find((row) => row.payment_type === paymentType);

  if (payment) {
    await connection.execute(
      `UPDATE order_payments
       SET due_amount = :dueAmount, updated_at = NOW()
       WHERE id = :id`,
      { dueAmount, id: payment.id }
    );
    return;
  }

  await Order.upsertPayment(connection, {
    orderId,
    paymentType,
    checkNumber: null,
    paymentDate: null,
    amount: null,
    dueAmount,
    isPaid: 0,
    memo: null,
  });
}

async function syncOrderCustodianDueFromInvoice(connection, orderId) {
  const order = await Order.findById(orderId, connection);

  if (!order || order.certificate_no_records) {
    return;
  }

  const payments = await Order.findPaymentsByOrderId(orderId, connection);
  const dueAmount = resolveCustodianPaymentDue(null, payments);

  await upsertOrderPaymentDue(connection, orderId, "custodian", dueAmount, payments);

  const custodianPaid = getOrderPaymentAmount(payments, "custodian");

  if (shouldMarkCustodianStageComplete(dueAmount, custodianPaid)) {
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

async function syncOrderPaymentDuesFromInvoice(connection, orderId, options = {}) {
  const skipCustodian = options.skipCustodian === true;
  const order = await Order.findById(orderId, connection);

  if (!order) {
    return null;
  }

  const invoice = await Invoice.findByOrderId(orderId, connection);
  const xrayRow = await InvoiceXray.findByOrderId(orderId, connection);
  const payments = await Order.findPaymentsByOrderId(orderId, connection);

  if (!skipCustodian && !order.certificate_no_records) {
    await syncOrderCustodianDueFromInvoice(connection, orderId);
  }

  if (xrayRow) {
    const xrayDue = resolveXrayPaymentDue(xrayRow, payments);
    await upsertOrderPaymentDue(connection, orderId, "xray", xrayDue, payments);
  }

  if (invoice) {
    return syncInvoiceAmountPaidFromOrder(connection, orderId);
  }

  return null;
}

function mapOrderInvoiceSummary(row, xrayRow = null, orderPayments = []) {
  const paymentsSummary = mapOrderPaymentsSummary(orderPayments);

  if (!row) {
    const hasXray = Boolean(xrayRow);

    return {
      createOnly: true,
      hasXray,
      hasStandardInvoice: false,
      ...(hasXray
        ? {
            xrayReviewDate: toShortDate(xrayRow.xray_invoice_date),
            xrayReviewDateCompact: toCompactDate(xrayRow.xray_invoice_date),
            xrayReviewAmount: mapXrayReviewAmount(xrayRow, orderPayments),
            xraySentDate: xrayRow.sent_date ? toShortDate(xrayRow.sent_date) : null,
            xraySentDateCompact: xrayRow.sent_date
              ? toCompactDate(xrayRow.sent_date)
              : null,
            xrayRecipientEmail: trimOrNull(xrayRow.recipient_emails) || "",
            xrayDueMeta: `${toCompactDate(xrayRow.xray_invoice_date)} - Due:${mapXrayReviewAmount(xrayRow, orderPayments)}`,
          }
        : {}),
      ...paymentsSummary,
      status: null,
      due: formatMoney(0),
      paidAmount:
        paymentsSummary.orderAmountPaid > 0
          ? formatMoney(paymentsSummary.orderAmountPaid)
          : null,
    };
  }

  const hasXray = Boolean(xrayRow);
  const hasStandardInvoice = hasStandardInvoiceFields(row);
  const financials = resolveRowFinancials(row, orderPayments);

  const invoiceDueMeta = `${toCompactDate(row.invoice_date)} - Due:${formatMoney(financials.amountDue)}`;

  return {
    createOnly: !hasStandardInvoice,
    hasXray,
    hasStandardInvoice,
    invoiceId: row.id,
    reviewDate: toShortDate(row.invoice_date),
    invoiceDateCompact: toCompactDate(row.invoice_date),
    reviewAmount: formatMoney(financials.totalAmount),
    printAmount: formatMoney(financials.totalAmount),
    invoiceDueMeta,
    custodianAmount:
      getOrderPaymentAmount(orderPayments, "custodian") > 0
        ? formatMoney(getOrderPaymentAmount(orderPayments, "custodian"))
        : null,
    sentDate: row.sent_date ? toShortDate(row.sent_date) : null,
    sentDateCompact: row.sent_date ? toCompactDate(row.sent_date) : null,
    xrayReviewDate: hasXray ? toShortDate(xrayRow.xray_invoice_date) : "",
    xrayReviewDateCompact: hasXray
      ? toCompactDate(xrayRow.xray_invoice_date)
      : "",
    xrayReviewAmount: mapXrayReviewAmount(xrayRow, orderPayments),
    xraySentDate:
      hasXray && xrayRow?.sent_date ? toShortDate(xrayRow.sent_date) : null,
    xraySentDateCompact:
      hasXray && xrayRow?.sent_date ? toCompactDate(xrayRow.sent_date) : null,
    xrayRecipientEmail:
      hasXray && xrayRow?.recipient_emails
        ? trimOrNull(xrayRow.recipient_emails) || ""
        : "",
    xrayDueMeta: hasXray
      ? `${toCompactDate(xrayRow.xray_invoice_date)} - Due:${mapXrayReviewAmount(xrayRow, orderPayments)}`
      : "",
    recipientEmail: trimOrNull(row.provider_email) || "",
    providerEmail: trimOrNull(row.provider_email) || "",
    showEmail: Boolean(trimOrNull(row.provider_email)),
    paid:
      financials.amountPaid > 0 ? formatMoney(financials.amountPaid) : null,
    status: row.status || "Unpaid",
    isWrittenOff: row.status === "Written Off",
    writeoffAmount:
      toNumber(row.writeoff_amount) > 0
        ? formatMoney(row.writeoff_amount)
        : null,
    date: toShortDate(row.invoice_date),
    sentDateRaw: toInputDate(row.sent_date),
    invoiced: formatMoney(financials.totalAmount),
    due: formatMoney(financials.amountDue),
    paidAmount: formatMoney(financials.amountPaid),
    ...paymentsSummary,
    custodianFee: "0.00",
    xrayFee: xrayRow ? toNumber(xrayRow.payment).toFixed(2) : "0.00",
    storageFee: getStorageFee(row).toFixed(2),
    pages: String(row.page_count ?? 0),
    perPageAmount: toNumber(row.per_page_amount).toFixed(2),
    clericalTimeHours: toNumber(row.clerical_time_hours).toFixed(2),
    clericalHourlyRate: toNumber(row.clerical_hourly_rate).toFixed(2),
    clericalAmount: (
      toNumber(row.clerical_time_hours) * toNumber(row.clerical_hourly_rate)
    ).toFixed(2),
    shippingHandling: toNumber(row.shipping_handling).toFixed(2),
    notes: row.notes || "",
    sendOrderDetails: Boolean(row.send_order_details),
    rushOrder: Boolean(row.is_rush_order),
    rushLevel: calculateOrderRushLevel(row.order_created_at).label,
    subpoenaDate: toInputDate(row.subpoena_date),
  };
}

function normalizeOrderId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeInvoiceId(value) {
  return normalizeOrderId(value);
}

function resolveXrayRowFinancials(xrayRow, orderPayments = []) {
  const totalAmount = getXrayPayment(xrayRow);
  const amountPaid = getOrderPaymentAmount(orderPayments, "xray");
  const amountDue = Math.max(0, totalAmount - amountPaid);

  return {
    totalAmount,
    amountPaid,
    amountDue,
  };
}

function getXrayRecipientEmail(row) {
  return (
    trimOrNull(row?.provider_email) ||
    trimOrNull(row?.recipient_emails) ||
    trimOrNull(row?.serve_email)
  );
}

function mapXrayOutstandingRow(row, orderPayments = []) {
  const isSent = Boolean(row.sent_date);
  const displayDate = isSent ? row.sent_date : row.xray_invoice_date;
  const orderId = normalizeOrderId(row.order_id);
  const financials = resolveXrayRowFinancials(row, orderPayments);

  return {
    id: `${row.facility_id}-${row.order_number}-xray-${orderId}`,
    invoiceId: orderId,
    orderId,
    caseNo: row.order_number,
    applicant: buildApplicantName(row),
    status: financials.amountDue <= 0 ? "Paid" : financials.amountPaid > 0 ? "Partial" : "Unpaid",
    isWrittenOff: false,
    isSent,
    sentDate: toShortDate(displayDate),
    days: daysSince(displayDate),
    invDate: toShortDate(row.xray_invoice_date),
    invoiced: formatMoney(financials.totalAmount),
    paid: formatMoney(financials.amountPaid),
    due: formatMoney(financials.amountDue),
  };
}

function mapXrayResendRow(row, orderPayments = []) {
  const isSent = Boolean(row.sent_date);
  const displayDate = isSent ? row.sent_date : row.xray_invoice_date;
  const orderId = normalizeOrderId(row.order_id);
  const financials = resolveXrayRowFinancials(row, orderPayments);

  return {
    id: orderId || row.order_id,
    invoiceId: orderId,
    orderId,
    company: getInvoiceCompanyName(row),
    email: getXrayRecipientEmail(row) || "",
    caseNo: row.order_number,
    applicant: buildApplicantName(row),
    isSent,
    sentDate: toShortDate(displayDate),
    days: daysSince(displayDate),
    invoiceDate: toShortDate(row.xray_invoice_date),
    invoiced: formatMoney(financials.totalAmount),
    paid: formatMoney(financials.amountPaid),
    due: formatMoney(financials.amountDue),
    ...mapInvoiceReminderFields(row),
  };
}

function buildXraySummary(rows = [], paymentsByOrderId = {}) {
  const companies = new Set();

  let invoiced = 0;
  let paid = 0;
  let due = 0;

  rows.forEach((row) => {
    const orderPayments = paymentsByOrderId[row.order_id] || [];
    const financials = resolveXrayRowFinancials(row, orderPayments);

    companies.add(getInvoiceCompanyId(row));
    invoiced += financials.totalAmount;
    paid += financials.amountPaid;
    due += financials.amountDue;
  });

  return {
    companies: companies.size,
    cases: rows.length,
    invoiced: formatMoney(invoiced),
    paid: formatMoney(paid),
    due: formatMoney(due),
  };
}

function groupXrayOutstandingRows(rows = [], paymentsByOrderId = {}) {
  const groups = new Map();

  rows.forEach((row) => {
    const company = getInvoiceCompanyName(row);
    const orderPayments = paymentsByOrderId[row.order_id] || [];
    const mappedRow = mapXrayOutstandingRow(row, orderPayments);
    const financials = resolveXrayRowFinancials(row, orderPayments);

    if (!groups.has(company)) {
      groups.set(company, {
        company,
        emails: getXrayRecipientEmail(row) || "",
        rows: [],
        total: { invoiced: 0, paid: 0, due: 0 },
      });
    }

    const group = groups.get(company);
    group.rows.push(mappedRow);
    group.total.invoiced += financials.totalAmount;
    group.total.paid += financials.amountPaid;
    group.total.due += financials.amountDue;
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    total: {
      invoiced: formatMoney(group.total.invoiced),
      paid: formatMoney(group.total.paid),
      due: formatMoney(group.total.due),
    },
  }));
}

function mapOutstandingRow(row, orderPayments = []) {
  const isSent = Boolean(row.sent_date);
  const displayDate = isSent ? row.sent_date : row.invoice_date;
  const invoiceDbId = normalizeInvoiceId(row.id);
  const isWrittenOff = row.status === "Written Off";
  const financials = resolveRowFinancials(row, orderPayments);

  return {
    id: `${row.facility_id}-${row.order_number}-${invoiceDbId || row.id}`,
    invoiceId: invoiceDbId,
    orderId: row.order_id,
    caseNo: row.order_number,
    applicant: buildApplicantName(row),
    status: row.status || "Unpaid",
    isWrittenOff,
    isSent,
    sentDate: toShortDate(displayDate),
    days: daysSince(displayDate),
    invDate: toShortDate(row.invoice_date),
    invoiced: formatMoney(financials.totalAmount),
    paid: formatMoney(financials.amountPaid),
    due: formatMoney(financials.amountDue),
  };
}

function mapResendRow(row, orderPayments = []) {
  const isSent = Boolean(row.sent_date);
  const displayDate = isSent ? row.sent_date : row.invoice_date;
  const invoiceDbId = normalizeInvoiceId(row.id);
  const financials = resolveRowFinancials(row, orderPayments);

  return {
    id: invoiceDbId || row.id,
    invoiceId: invoiceDbId,
    orderId: row.order_id,
    company: getInvoiceCompanyName(row),
    email: getInvoiceDisplayEmail(row),
    caseNo: row.order_number,
    applicant: buildApplicantName(row),
    isSent,
    sentDate: toShortDate(displayDate),
    days: daysSince(displayDate),
    invoiceDate: toShortDate(row.invoice_date),
    invoiced: formatMoney(financials.totalAmount),
    paid: formatMoney(financials.amountPaid),
    due: formatMoney(financials.amountDue),
    ...mapInvoiceReminderFields(row),
  };
}

function buildSummary(rows = [], paymentsByOrderId = {}) {
  const companies = new Set();

  let invoiced = 0;
  let paid = 0;
  let due = 0;

  rows.forEach((row) => {
    const orderPayments = paymentsByOrderId[row.order_id] || [];
    const financials = resolveRowFinancials(row, orderPayments);

    companies.add(getInvoiceCompanyId(row));
    invoiced += financials.totalAmount;
    paid += financials.amountPaid;
    due += financials.amountDue;
  });

  return {
    companies: companies.size,
    cases: rows.length,
    invoiced: formatMoney(invoiced),
    paid: formatMoney(paid),
    due: formatMoney(due),
  };
}

function groupOutstandingRows(rows = [], paymentsByOrderId = {}) {
  const groups = new Map();

  rows.forEach((row) => {
    const company = getInvoiceCompanyName(row);
    const orderPayments = paymentsByOrderId[row.order_id] || [];
    const mappedRow = mapOutstandingRow(row, orderPayments);
    const financials = resolveRowFinancials(row, orderPayments);

    if (!groups.has(company)) {
      groups.set(company, {
        company,
        emails: getInvoiceDisplayEmail(row),
        rows: [],
        total: { invoiced: 0, paid: 0, due: 0 },
      });
    }

    const group = groups.get(company);
    group.rows.push(mappedRow);
    group.total.invoiced += financials.totalAmount;
    group.total.paid += financials.amountPaid;
    group.total.due += financials.amountDue;
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    total: {
      invoiced: formatMoney(group.total.invoiced),
      paid: formatMoney(group.total.paid),
      due: formatMoney(group.total.due),
    },
  }));
}

function buildInvoicePayload(body = {}, existing = null, options = {}) {
  const totals = calculateTotalsWithPayments({ ...body }, options.orderPayments || []);
  const amountPaid = resolveAmountPaid(options.orderPayments, existing);
  const writeoffAmount = existing ? toNumber(existing.writeoff_amount) : 0;
  const { amountDue, status: derivedStatus } = resolveInvoiceAmounts(
    totals.totalAmount,
    amountPaid,
    writeoffAmount
  );
  const status = resolveInvoiceStatusForSave(existing, totals.totalAmount, amountPaid, derivedStatus);

  return {
    status,
    invoiceDate: trimOrNull(body.invoiceDate),
    sentDate: existing?.sent_date || null,
    pageCount: totals.pageCount,
    perPageAmount: totals.perPageAmount,
    clericalTimeHours: totals.clericalTimeHours,
    clericalHourlyRate: totals.clericalHourlyRate,
    shippingHandling: totals.shippingHandling,
    storageFee: totals.storageFee,
    totalAmount: totals.totalAmount,
    amountPaid,
    amountDue,
    notes: trimOrNull(body.notes),
    sendOrderDetails: boolToInt(body.sendOrderDetails),
    isRushOrder: boolToInt(body.rushOrder),
  };
}

async function getInvoiceById(id) {
  const invoice = await Invoice.findById(id);

  if (!invoice) {
    throw new ApiError(404, "Invoice not found");
  }

  return mapInvoiceDetail(invoice);
}

async function getOutstandingInvoices(query = {}) {
  const rows = await Invoice.findOutstanding({
    dateFrom: trimOrNull(query.dateFrom),
    dateTo: trimOrNull(query.dateTo),
  });
  const orderIds = [...new Set(rows.map((row) => row.order_id))];
  const paymentRows = await Order.findPaymentsByOrderIds(orderIds);
  const paymentsByOrderId = groupPaymentsByOrderId(paymentRows);

  return {
    groups: groupOutstandingRows(rows, paymentsByOrderId),
    summary: buildSummary(rows, paymentsByOrderId),
    count: rows.length,
  };
}

async function getResendInvoices(query = {}) {
  const rows = await Invoice.findResend({
    dateFrom: trimOrNull(query.dateFrom),
    dateTo: trimOrNull(query.dateTo),
  });
  const orderIds = [...new Set(rows.map((row) => row.order_id))];
  const paymentRows = await Order.findPaymentsByOrderIds(orderIds);
  const paymentsByOrderId = groupPaymentsByOrderId(paymentRows);

  return {
    invoices: rows.map((row) => mapResendRow(row, paymentsByOrderId[row.order_id] || [])),
    summary: buildSummary(rows, paymentsByOrderId),
    count: rows.length,
  };
}

async function getXrayOutstandingInvoices(query = {}) {
  const rows = await InvoiceXray.findOutstanding({
    dateFrom: trimOrNull(query.dateFrom),
    dateTo: trimOrNull(query.dateTo),
  });
  const orderIds = [...new Set(rows.map((row) => row.order_id))];
  const paymentRows = await Order.findPaymentsByOrderIds(orderIds);
  const paymentsByOrderId = groupPaymentsByOrderId(paymentRows);

  return {
    groups: groupXrayOutstandingRows(rows, paymentsByOrderId),
    summary: buildXraySummary(rows, paymentsByOrderId),
    count: rows.length,
  };
}

async function getXrayResendInvoices(query = {}) {
  const rows = await InvoiceXray.findResend({
    dateFrom: trimOrNull(query.dateFrom),
    dateTo: trimOrNull(query.dateTo),
  });
  const orderIds = [...new Set(rows.map((row) => row.order_id))];
  const paymentRows = await Order.findPaymentsByOrderIds(orderIds);
  const paymentsByOrderId = groupPaymentsByOrderId(paymentRows);

  return {
    invoices: rows.map((row) =>
      mapXrayResendRow(row, paymentsByOrderId[row.order_id] || [])
    ),
    summary: buildXraySummary(rows, paymentsByOrderId),
    count: rows.length,
  };
}

async function getInvoices(query = {}) {
  if (query.type === "xray") {
    if (query.tab === "resend") {
      return getXrayResendInvoices(query);
    }

    return getXrayOutstandingInvoices(query);
  }

  if (query.tab === "resend") {
    return getResendInvoices(query);
  }

  return getOutstandingInvoices(query);
}

async function getStandardInvoicesByOrderIds(orderIds = []) {
  return Invoice.findByOrderIds(orderIds);
}

async function getXrayDetailsByOrderIds(orderIds = []) {
  return InvoiceXray.findByOrderIds(orderIds);
}

async function getXrayInvoiceByOrderId(orderId) {
  const normalizedOrderId = Number(orderId);

  if (!Number.isFinite(normalizedOrderId)) {
    throw new ApiError(400, "Invalid order id");
  }

  const order = await Order.findById(normalizedOrderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const [invoice, xray, orderPayments] = await Promise.all([
    Invoice.findByOrderId(normalizedOrderId),
    InvoiceXray.findByOrderId(normalizedOrderId),
    Order.findPaymentsByOrderId(normalizedOrderId),
  ]);

  return {
    invoiceId: invoice?.id || null,
    xray: mapXrayDetail(xray, orderPayments),
  };
}

async function createOrUpdateXrayInvoice(body, userId) {
  const orderId = Number(body.orderId);
  const viewCount = Math.max(0, Math.floor(toNumber(body.views)));
  const perViewAmount = toNumber(body.perViewAmount);
  const viewsAmount = viewCount * perViewAmount;
  const xrayInvoiceDate = trimOrNull(body.xrayInvoiceDate);
  const examDate = trimOrNull(body.examDate);
  const checkNumber = trimOrNull(body.checkNumber);
  const description = trimOrNull(body.description);

  if (!Number.isFinite(orderId)) {
    throw new ApiError(400, "orderId is required");
  }

  if (!xrayInvoiceDate) {
    throw new ApiError(400, "X-Ray invoice date is required");
  }

  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const xrayFee = viewsAmount;
    const recipientEmails = await resolveInvoiceRecipientFromOrder(
      order,
      connection
    );

    await InvoiceXray.upsert(connection, orderId, {
      xrayInvoiceDate,
      examDate,
      viewCount,
      perViewAmount,
      payment: xrayFee,
      checkNumber,
      description,
      recipientEmails,
    });

    await connection.execute(
      `UPDATE orders
       SET xray_invoice_date = :xrayInvoiceDate, updated_at = NOW()
       WHERE id = :orderId`,
      { xrayInvoiceDate, orderId }
    );

    await connection.commit();

    return getXrayInvoiceByOrderId(orderId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function syncInvoicePrepayment(connection, orderId, prepaymentAmount) {
  if (prepaymentAmount === undefined || prepaymentAmount === null) {
    return;
  }

  const amount = toNumber(prepaymentAmount);
  const existingPayments = await Order.findPaymentsByOrderId(orderId, connection);
  const existingPrepayment = existingPayments.find(
    (payment) => payment.payment_type === "prepayment"
  );

  await Order.upsertPayment(connection, {
    orderId,
    paymentType: "prepayment",
    checkNumber: existingPrepayment?.check_number || null,
    paymentDate: existingPrepayment?.payment_date || null,
    amount,
    dueAmount: existingPrepayment?.due_amount ?? null,
    isPaid: amount > 0 ? 1 : 0,
    memo: existingPrepayment?.memo || null,
  });

  await syncServeWorkflowFromPrepayment(connection, orderId);
  await syncInvoiceAmountPaidFromOrder(connection, orderId);
}

async function syncServeWorkflowFromPrepayment(connection, orderId) {
  const payments = await Order.findPaymentsByOrderId(orderId, connection);
  const prepaymentPaid = getOrderPaymentAmount(payments, "prepayment");
  const isServeComplete = prepaymentPaid >= DEFAULT_PREPAYMENT_CHARGE;

  await Order.upsertWorkflowStage(
    orderId,
    "Serve",
    isServeComplete ? "complete" : "pending",
    isServeComplete ? new Date() : null,
    connection
  );
}

async function createInvoice(body, userId) {
  const orderId = Number(body.orderId);

  if (!Number.isFinite(orderId)) {
    throw new ApiError(400, "orderId is required");
  }

  if (!trimOrNull(body.invoiceDate)) {
    throw new ApiError(400, "Invoice date is required");
  }

  const order = await Order.findById(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (Number(order.certificate_no_records)) {
    throw new ApiError(
      400,
      "Standard invoices cannot be created for Certificate of No Records orders"
    );
  }

  const existing = await Invoice.findByOrderId(orderId);

  if (existing && hasStandardInvoiceFields(existing)) {
    throw new ApiError(409, "An invoice already exists for this order");
  }

  if (existing && !hasStandardInvoiceFields(existing)) {
    return updateInvoice(existing.id, body);
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await syncInvoicePrepayment(connection, orderId, body.prepaymentAmount);

    const orderPayments = await Order.findPaymentsByOrderId(orderId, connection);
    const invoicePayload = buildInvoicePayload(body, null, {
      orderPayments,
    });
    const recipientEmails = await resolveInvoiceRecipientFromOrder(order, connection);

    const invoiceId = await Invoice.create(connection, {
      invoiceNumber: trimOrNull(body.invoiceNumber) || `INV-${order.order_number}`,
      orderId,
      facilityId: order.facility_id,
      status: invoicePayload.status,
      invoiceDate: invoicePayload.invoiceDate,
      sentDate: invoicePayload.sentDate,
      pageCount: invoicePayload.pageCount,
      perPageAmount: invoicePayload.perPageAmount,
      clericalTimeHours: invoicePayload.clericalTimeHours,
      clericalHourlyRate: invoicePayload.clericalHourlyRate,
      shippingHandling: invoicePayload.shippingHandling,
      storageFee: invoicePayload.storageFee,
      totalAmount: invoicePayload.totalAmount,
      amountPaid: invoicePayload.amountPaid,
      amountDue: invoicePayload.amountDue,
      notes: invoicePayload.notes,
      sendOrderDetails: invoicePayload.sendOrderDetails,
      isRushOrder: invoicePayload.isRushOrder,
      recipientEmails,
      createdBy: userId || null,
    });

    await connection.execute(
      `UPDATE orders
       SET invoice_date = :invoiceDate, updated_at = NOW()
       WHERE id = :orderId`,
      { invoiceDate: invoicePayload.invoiceDate, orderId }
    );

    await connection.commit();

    return getInvoiceById(invoiceId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateInvoice(id, body) {
  const existing = await Invoice.findById(id);

  if (!existing) {
    throw new ApiError(404, "Invoice not found");
  }

  if (!trimOrNull(body.invoiceDate)) {
    throw new ApiError(400, "Invoice date is required");
  }

  const order = await Order.findById(existing.order_id);

  if (order && Number(order.certificate_no_records)) {
    throw new ApiError(
      400,
      "Standard invoices cannot be updated for Certificate of No Records orders"
    );
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await syncInvoicePrepayment(connection, existing.order_id, body.prepaymentAmount);

    const orderPayments = await Order.findPaymentsByOrderId(existing.order_id, connection);
    const invoicePayload = buildInvoicePayload(body, existing, {
      orderPayments,
    });
    const recipientEmails = order
      ? await resolveInvoiceRecipientFromOrder(order, connection)
      : trimOrNull(existing.recipient_emails);

    await Invoice.update(connection, id, {
      status: invoicePayload.status,
      invoiceDate: invoicePayload.invoiceDate,
      sentDate: invoicePayload.sentDate,
      pageCount: invoicePayload.pageCount,
      perPageAmount: invoicePayload.perPageAmount,
      clericalTimeHours: invoicePayload.clericalTimeHours,
      clericalHourlyRate: invoicePayload.clericalHourlyRate,
      shippingHandling: invoicePayload.shippingHandling,
      storageFee: invoicePayload.storageFee,
      totalAmount: invoicePayload.totalAmount,
      amountPaid: invoicePayload.amountPaid,
      amountDue: invoicePayload.amountDue,
      notes: invoicePayload.notes,
      sendOrderDetails: invoicePayload.sendOrderDetails,
      isRushOrder: invoicePayload.isRushOrder,
      recipientEmails,
    });

    await connection.execute(
      `UPDATE orders
       SET invoice_date = :invoiceDate, updated_at = NOW()
       WHERE id = :orderId`,
      { invoiceDate: invoicePayload.invoiceDate, orderId: existing.order_id }
    );

    await connection.commit();

    return getInvoiceById(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function ensureCompanyEntry(companiesMap, row) {
  const companyId = getInvoiceCompanyId(row);

  if (!companiesMap.has(companyId)) {
    companiesMap.set(companyId, {
      id: companyId,
      company: getInvoiceCompanyName(row),
      email: getInvoiceDisplayEmail(row),
      cases: 0,
      needsResend: 0,
      invoiced: 0,
      paid: 0,
      due: 0,
    });
  }

  return companiesMap.get(companyId);
}

function accumulateCompanyFinancials(
  companiesMap,
  row,
  financials,
  { needsResend = false } = {}
) {
  const company = ensureCompanyEntry(companiesMap, row);
  company.cases += 1;

  if (needsResend) {
    company.needsResend += 1;
  }

  company.invoiced += financials.totalAmount;
  company.paid += financials.amountPaid;
  company.due += financials.amountDue;
}

function isStandardNeedsResend(row) {
  return row.status === "Needs Resend" || Boolean(row.sent_date);
}

function isXrayNeedsResend(row) {
  return Boolean(row.sent_date);
}

function processCompanyStandardRows(
  companiesMap,
  rows,
  paymentsByOrderId,
  { needsResend = false } = {}
) {
  rows.forEach((row) => {
    const financials = resolveRowFinancials(
      row,
      paymentsByOrderId[row.order_id] || []
    );

    accumulateCompanyFinancials(companiesMap, row, financials, {
      needsResend: needsResend || isStandardNeedsResend(row),
    });
  });
}

function processCompanyXrayRows(
  companiesMap,
  rows,
  paymentsByOrderId,
  { needsResend = false } = {}
) {
  rows.forEach((row) => {
    const financials = resolveXrayRowFinancials(
      row,
      paymentsByOrderId[row.order_id] || []
    );

    accumulateCompanyFinancials(companiesMap, row, financials, {
      needsResend: needsResend || isXrayNeedsResend(row),
    });
  });
}

function sumStandardFinancials(rows, paymentsByOrderId) {
  let invoiced = 0;
  let paid = 0;
  let due = 0;

  rows.forEach((row) => {
    const financials = resolveRowFinancials(
      row,
      paymentsByOrderId[row.order_id] || []
    );
    invoiced += financials.totalAmount;
    paid += financials.amountPaid;
    due += financials.amountDue;
  });

  return { invoiced, paid, due };
}

function sumXrayFinancials(rows, paymentsByOrderId) {
  let invoiced = 0;
  let paid = 0;
  let due = 0;

  rows.forEach((row) => {
    const financials = resolveXrayRowFinancials(
      row,
      paymentsByOrderId[row.order_id] || []
    );
    invoiced += financials.totalAmount;
    paid += financials.amountPaid;
    due += financials.amountDue;
  });

  return { invoiced, paid, due };
}

async function getCompanyWise() {
  const [
    standardOutstanding,
    standardResend,
    xrayOutstanding,
    xrayResend,
  ] = await Promise.all([
    Invoice.findOutstanding({}),
    Invoice.findResend({}),
    InvoiceXray.findOutstanding({}),
    InvoiceXray.findResend({}),
  ]);

  const standardRows = [...standardOutstanding, ...standardResend];
  const xrayRows = [...xrayOutstanding, ...xrayResend];
  const orderIds = [
    ...new Set([
      ...standardRows.map((row) => row.order_id),
      ...xrayRows.map((row) => row.order_id),
    ]),
  ];
  const paymentRows = await Order.findPaymentsByOrderIds(orderIds);
  const paymentsByOrderId = groupPaymentsByOrderId(paymentRows);
  const companiesMap = new Map();

  processCompanyStandardRows(
    companiesMap,
    standardOutstanding,
    paymentsByOrderId
  );
  processCompanyStandardRows(companiesMap, standardResend, paymentsByOrderId, {
    needsResend: true,
  });
  processCompanyXrayRows(companiesMap, xrayOutstanding, paymentsByOrderId);
  processCompanyXrayRows(companiesMap, xrayResend, paymentsByOrderId, {
    needsResend: true,
  });

  const companies = Array.from(companiesMap.values())
    .map((company) => ({
      ...company,
      invoiced: formatMoney(company.invoiced),
      paid: formatMoney(company.paid),
      due: formatMoney(company.due),
    }))
    .sort((a, b) => a.company.localeCompare(b.company));

  const standardTotals = sumStandardFinancials(standardRows, paymentsByOrderId);
  const xrayTotals = sumXrayFinancials(xrayRows, paymentsByOrderId);

  const summary = {
    companies: companies.length,
    totalCases: standardRows.length + xrayRows.length,
    needsResend: companies.reduce((sum, company) => sum + company.needsResend, 0),
    invoiced: formatMoney(standardTotals.invoiced + xrayTotals.invoiced),
    paid: formatMoney(standardTotals.paid + xrayTotals.paid),
    due: formatMoney(standardTotals.due + xrayTotals.due),
  };

  return { companies, summary };
}

function mapCompanyInvoiceRow(row, orderPayments = []) {
  const isSent = Boolean(row.sent_date);
  const displayDate = isSent ? row.sent_date : row.invoice_date;
  const isWrittenOff = row.status === "Written Off";
  const financials = resolveRowFinancials(row, orderPayments);

  return {
    id: row.id,
    invoiceId: row.order_number,
    orderId: row.order_id,
    invoiceDbId: row.id,
    invoiceType: "invoice",
    invoiceDate: toShortDate(row.invoice_date),
    days: daysSince(displayDate),
    status: row.status || "Unpaid",
    needsResend: isStandardNeedsResend(row),
    isWrittenOff,
    isSent,
    invoiced: formatMoney(financials.totalAmount),
    paid: formatMoney(financials.amountPaid),
    due: formatMoney(financials.amountDue),
  };
}

function mapCompanyXrayInvoiceRow(row, orderPayments = []) {
  const isSent = Boolean(row.sent_date);
  const displayDate = isSent ? row.sent_date : row.xray_invoice_date;
  const financials = resolveXrayRowFinancials(row, orderPayments);
  const orderId = row.order_id;
  const status = isSent
    ? financials.amountDue <= 0
      ? "Paid"
      : "Needs Resend"
    : financials.amountDue <= 0
      ? "Paid"
      : financials.amountPaid > 0
        ? "Partial"
        : "Unpaid";

  return {
    id: `xray-${orderId}`,
    invoiceId: row.order_number,
    orderId,
    invoiceDbId: orderId,
    invoiceType: "xray",
    invoiceDate: toShortDate(row.xray_invoice_date),
    days: daysSince(displayDate),
    status,
    needsResend: isXrayNeedsResend(row),
    isWrittenOff: false,
    isSent,
    invoiced: formatMoney(financials.totalAmount),
    paid: formatMoney(financials.amountPaid),
    due: formatMoney(financials.amountDue),
  };
}

function buildCompanyInvoiceList(standardRows = [], xrayRows = [], paymentsByOrderId = {}) {
  const mergedRows = [
    ...standardRows.map((row) => ({
      sortDate: row.invoice_date,
      invoice: mapCompanyInvoiceRow(
        row,
        paymentsByOrderId[row.order_id] || []
      ),
    })),
    ...xrayRows.map((row) => ({
      sortDate: row.xray_invoice_date,
      invoice: mapCompanyXrayInvoiceRow(
        row,
        paymentsByOrderId[row.order_id] || []
      ),
    })),
  ];

  return mergedRows
    .sort((left, right) => String(right.sortDate).localeCompare(String(left.sortDate)))
    .map((entry) => entry.invoice);
}

async function getByCompany(providerId, query = {}) {
  const companyId = Number(providerId);

  if (!Number.isFinite(companyId)) {
    throw new ApiError(400, "Invalid company id");
  }

  const dateFilters = {
    dateFrom: trimOrNull(query.dateFrom),
    dateTo: trimOrNull(query.dateTo),
  };

  const [
    standardOutstanding,
    standardResend,
    xrayOutstanding,
    xrayResend,
  ] = await Promise.all([
    Invoice.findByProviderId(companyId, dateFilters),
    Invoice.findResendByProviderId(companyId, dateFilters),
    InvoiceXray.findByProviderId(companyId, dateFilters),
    InvoiceXray.findResendByProviderId(companyId, dateFilters),
  ]);

  const standardRows = [...standardOutstanding, ...standardResend];
  const xrayRows = [...xrayOutstanding, ...xrayResend];

  if (!standardRows.length && !xrayRows.length) {
    return {
      company: {
        id: companyId,
        name: "Company",
        email: "",
      },
      invoices: [],
      summary: {
        totalCases: 0,
        needsResend: 0,
        totalInvoiced: "$0.00",
        totalPaid: "$0.00",
        totalDue: "$0.00",
      },
    };
  }

  const referenceRow = standardRows[0] || xrayRows[0];
  const orderIds = [
    ...new Set([
      ...standardRows.map((row) => row.order_id),
      ...xrayRows.map((row) => row.order_id),
    ]),
  ];
  const paymentRows = await Order.findPaymentsByOrderIds(orderIds);
  const paymentsByOrderId = groupPaymentsByOrderId(paymentRows);
  const invoices = buildCompanyInvoiceList(
    standardRows,
    xrayRows,
    paymentsByOrderId
  );

  let totalInvoiced = 0;
  let totalPaid = 0;
  let totalDue = 0;

  const standardTotals = sumStandardFinancials(standardRows, paymentsByOrderId);
  const xrayTotals = sumXrayFinancials(xrayRows, paymentsByOrderId);
  totalInvoiced = standardTotals.invoiced + xrayTotals.invoiced;
  totalPaid = standardTotals.paid + xrayTotals.paid;
  totalDue = standardTotals.due + xrayTotals.due;

  return {
    company: {
      id: companyId,
      name: getInvoiceCompanyName(referenceRow),
      email:
        getInvoiceDisplayEmail(referenceRow) ||
        getXrayRecipientEmail(referenceRow) ||
        "",
    },
    invoices,
    summary: {
      totalCases: invoices.length,
      needsResend: invoices.filter((invoice) => invoice.needsResend).length,
      totalInvoiced: formatMoney(totalInvoiced),
      totalPaid: formatMoney(totalPaid),
      totalDue: formatMoney(totalDue),
    },
  };
}

async function deliverInvoiceEmail(
  invoice,
  {
    isResend = false,
    reminderLevel = null,
    orderPayments = [],
    recipientEmails = null,
  } = {}
) {
  if (!invoice) {
    throw new ApiError(404, "Invoice not found");
  }

  const recipients = recipientEmails
    ? assertValidRecipientEmails(recipientEmails)
    : normalizeRecipientEmails(await resolveInvoiceRecipientEmail(invoice));

  if (!recipients.length) {
    throw new ApiError(400, NO_PROVIDER_EMAIL_MESSAGE);
  }

  const payments =
    orderPayments.length > 0
      ? orderPayments
      : await Order.findPaymentsByOrderId(invoice.order_id);
  const financials = resolveRowFinancials(invoice, payments);
  const order = await Order.findById(invoice.order_id);
  const invoiceRow = order
    ? await Invoice.findByOrderId(invoice.order_id)
    : null;
  const attachments = [];

  if (order && invoiceRow) {
    const payload = buildPrintInvoicePdfData(invoiceRow, order, payments);

    if (payload) {
      const { generatePrintInvoicePdf } = require("../utils/printInvoicePdf");
      const pdfBuffer = await generatePrintInvoicePdf(payload);
      const safeOrderNumber = `${order.order_number || order.id}`.replace(
        /[^\w.-]+/g,
        "_"
      );

      attachments.push({
        filename: `invoice-${safeOrderNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      });
    }
  }

  const { sendInvoiceEmail } = require("./emailService");
  const deliveredTo = [];

  const reminderNumber = Number(reminderLevel) || 0;
  const isReminder = reminderNumber > 0;

  for (const email of recipients) {
    const result = await sendInvoiceEmail({
      to: email,
      companyName: invoice.provider_name || invoice.facility_name || "Company",
      caseNo: invoice.order_number || "",
      applicant: buildApplicantName(invoice),
      invoiceDate: toShortDate(invoice.invoice_date),
      sentDate: toShortDate(isResend ? invoice.sent_date || new Date() : new Date()),
      invoiced: formatMoney(financials.totalAmount),
      paid: formatMoney(financials.amountPaid),
      due: formatMoney(financials.amountDue),
      isResend: isResend || isReminder,
      reminderLevel: isReminder ? reminderNumber : null,
      sendOrderDetails: Boolean(invoice.send_order_details),
      isRushOrder: Boolean(invoice.is_rush_order),
      rushLevel: calculateOrderRushLevel(invoice.order_created_at).label,
      orderDetailsText: Boolean(invoice.send_order_details)
        ? buildOrderDetailsText(invoice, payments)
        : "",
      attachments,
      subjectOverride: isReminder
        ? `Reminder ${reminderNumber} - Invoice - Case ${invoice.order_number || ""}`
        : null,
    });

    if (!result.delivered && !(config.nodeEnv === "development" && result.devLogged)) {
      const hint =
        config.nodeEnv === "development" && result.devLogged
          ? "SMTP is not configured or delivery failed (check backend logs)."
          : "Failed to deliver invoice email.";

      throw new ApiError(500, hint);
    }

    deliveredTo.push(email);
  }

  return {
    recipient: deliveredTo.join(", "),
    recipients: deliveredTo,
    delivered: deliveredTo.length > 0,
    devLogged: false,
  };
}

async function deliverXrayInvoiceEmail(
  xrayRow,
  order,
  orderPayments = [],
  { isResend = false, reminderLevel = null, recipientEmails = null } = {}
) {
  if (!xrayRow || !order) {
    throw new ApiError(404, "X-Ray invoice not found");
  }

  const invoice = await Invoice.findByOrderId(order.id);
  const recipients = recipientEmails
    ? assertValidRecipientEmails(recipientEmails)
    : normalizeRecipientEmails(
        invoice
          ? await resolveInvoiceRecipientEmail(invoice)
          : await resolveInvoiceRecipientFromOrder(order)
      );

  if (!recipients.length) {
    throw new ApiError(400, NO_PROVIDER_EMAIL_MESSAGE);
  }

  const payments =
    orderPayments.length > 0
      ? orderPayments
      : await Order.findPaymentsByOrderId(order.id);
  const payload = buildPrintXrayInvoicePdfData(xrayRow, order, payments);
  const attachments = [];

  if (payload) {
    const { generatePrintXrayInvoicePdf } = require("../utils/printXrayInvoicePdf");
    const pdfBuffer = await generatePrintXrayInvoicePdf(payload);
    const safeOrderNumber = `${order.order_number || order.id}`.replace(
      /[^\w.-]+/g,
      "_"
    );

    attachments.push({
      filename: `xray-invoice-${safeOrderNumber}.pdf`,
      content: pdfBuffer,
      contentType: "application/pdf",
    });
  }

  const financials = resolveXrayRowFinancials(xrayRow, payments);
  const { sendInvoiceEmail } = require("./emailService");
  const deliveredTo = [];

  const reminderNumber = Number(reminderLevel) || 0;
  const isReminder = reminderNumber > 0;

  for (const email of recipients) {
    const result = await sendInvoiceEmail({
      to: email,
      companyName: order.provider_name || order.serve_company_name || "Company",
      caseNo: order.order_number || "",
      applicant: buildApplicantName(order),
      invoiceDate: toShortDate(xrayRow.xray_invoice_date),
      sentDate: toShortDate(
        isResend ? xrayRow.sent_date || new Date() : new Date()
      ),
      invoiced: formatMoney(financials.totalAmount),
      paid: formatMoney(financials.amountPaid),
      due: formatMoney(financials.amountDue),
      isResend: isResend || isReminder,
      reminderLevel: isReminder ? reminderNumber : null,
      subjectOverride: isReminder
        ? `Reminder ${reminderNumber} - X-Ray Invoice - Case ${order.order_number || ""}`
        : isResend
          ? `Resent X-Ray Invoice - Case ${order.order_number || ""}`
          : `X-Ray Invoice - Case ${order.order_number || ""}`,
      attachments,
    });

    if (!result.delivered && !(config.nodeEnv === "development" && result.devLogged)) {
      const hint =
        config.nodeEnv === "development" && result.devLogged
          ? "SMTP is not configured or delivery failed (check backend logs)."
          : "Failed to deliver X-Ray invoice email.";

      throw new ApiError(500, hint);
    }

    deliveredTo.push(email);
  }

  return {
    recipient: deliveredTo.join(", "),
    recipients: deliveredTo,
    delivered: deliveredTo.length > 0,
    devLogged: false,
  };
}

async function sendInvoices(invoiceIds = [], options = {}) {
  const ids = [
    ...new Set(
      (Array.isArray(invoiceIds) ? invoiceIds : [])
        .map((id) => normalizeInvoiceId(id))
        .filter(Boolean)
    ),
  ];

  if (!ids.length) {
    throw new ApiError(400, "At least one invoice id is required");
  }

  const customEmails = options.emails
    ? assertValidRecipientEmails(options.emails)
    : null;

  const existing = await Invoice.findByIds(ids);
  const unsentIds = existing
    .filter((row) => !row.sent_date)
    .map((row) => normalizeInvoiceId(row.id))
    .filter(Boolean);

  if (!unsentIds.length) {
    throw new ApiError(400, "Selected invoices are already sent");
  }

  const sent = [];

  for (const invoiceId of unsentIds) {
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      throw new ApiError(404, `Invoice ${invoiceId} not found`);
    }

    if (invoice.sent_date) {
      continue;
    }

    const recipientEmails =
      customEmails || normalizeRecipientEmails(await resolveInvoiceRecipientEmail(invoice));

    if (!recipientEmails.length) {
      throw new ApiError(400, NO_PROVIDER_EMAIL_MESSAGE);
    }

    const orderPayments = await Order.findPaymentsByOrderId(invoice.order_id);
    const { recipient: deliveredTo } = await deliverInvoiceEmail(invoice, {
      isResend: false,
      orderPayments,
      recipientEmails,
    });

    const markedCount = await Invoice.markAsSent([invoiceId]);

    if (!markedCount) {
      continue;
    }

    await getPool().execute(
      `UPDATE invoices
       SET recipient_emails = :recipientEmails,
           updated_at = NOW()
       WHERE id = :invoiceId`,
      { recipientEmails: deliveredTo, invoiceId }
    );

    if (invoice.order_id) {
      await Order.upsertWorkflowStage(
        invoice.order_id,
        "SENT",
        "sent",
        new Date()
      );
    }

    sent.push({ invoiceId, recipient: deliveredTo });
  }

  if (!sent.length) {
    throw new ApiError(400, "Selected invoices are already sent");
  }

  return { sentCount: sent.length, sent };
}

function canDeliverInvoiceEmail(invoice) {
  if (!invoice) return false;

  if (invoice.status === "Needs Resend") {
    return true;
  }

  return Boolean(invoice.sent_date);
}

async function resendInvoices(invoiceIds = [], options = {}) {
  const ids = [
    ...new Set(
      (Array.isArray(invoiceIds) ? invoiceIds : [])
        .map((id) => normalizeInvoiceId(id))
        .filter(Boolean)
    ),
  ];

  if (!ids.length) {
    throw new ApiError(400, "At least one invoice id is required");
  }

  const customEmails = options.emails
    ? assertValidRecipientEmails(options.emails)
    : null;

  const resent = [];

  for (const invoiceId of ids) {
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      throw new ApiError(404, `Invoice ${invoiceId} not found`);
    }

    if (!canDeliverInvoiceEmail(invoice)) {
      throw new ApiError(
        400,
        "Only sent invoices awaiting email or marked for resend can be emailed"
      );
    }

    const recipientEmails =
      customEmails || normalizeRecipientEmails(await resolveInvoiceRecipientEmail(invoice));

    if (!recipientEmails.length) {
      throw new ApiError(400, NO_PROVIDER_EMAIL_MESSAGE);
    }

    const { recipient: deliveredTo } = await deliverInvoiceEmail(invoice, {
      isResend: true,
      recipientEmails,
    });

    await getPool().execute(
      `UPDATE invoices
       SET recipient_emails = :recipientEmails,
           sent_date = CURDATE(),
           status = CASE
             WHEN status IN ('Paid', 'Partial', 'Unpaid', 'Written Off') THEN status
             ELSE 'Needs Resend'
           END,
           updated_at = NOW()
       WHERE id = :invoiceId`,
      { recipientEmails: deliveredTo, invoiceId }
    );

    if (invoice.order_id) {
      await Order.upsertWorkflowStage(invoice.order_id, "SENT", "sent", new Date());
    }

    resent.push({ invoiceId, recipient: deliveredTo });
  }

  return { resentCount: resent.length };
}

async function emailInvoiceByOrderId(orderId) {
  const normalizedOrderId = Number(orderId);

  if (!Number.isFinite(normalizedOrderId)) {
    throw new ApiError(400, "Invalid order id");
  }

  const invoice = await Invoice.findByOrderId(normalizedOrderId);

  if (!invoice) {
    throw new ApiError(404, "No invoice found for this order");
  }

  if (invoice.sent_date) {
    throw new ApiError(400, "Invoice is already marked as sent");
  }

  const recipientEmail = await resolveInvoiceRecipientEmail(invoice);

  if (!recipientEmail) {
    throw new ApiError(400, NO_PROVIDER_EMAIL_MESSAGE);
  }

  const orderPayments = await Order.findPaymentsByOrderId(normalizedOrderId);
  const { recipient, delivered, devLogged } = await deliverInvoiceEmail(invoice, {
    isResend: false,
    orderPayments,
  });

  const invoiceId = normalizeInvoiceId(invoice.id);
  const sentCount = await Invoice.markAsSent([invoiceId]);

  if (!sentCount) {
    throw new ApiError(400, "Invoice is already marked as sent");
  }

  await getPool().execute(
    `UPDATE invoices
     SET recipient_emails = :recipientEmails,
         updated_at = NOW()
     WHERE id = :invoiceId`,
    { recipientEmails: recipientEmail, invoiceId }
  );

  await Order.upsertWorkflowStage(normalizedOrderId, "SENT", "sent", new Date());

  const sentOn = new Date();

  return {
    invoiceId,
    orderId: normalizedOrderId,
    isResend: false,
    recipient,
    recipientEmail: recipient,
    emailed: delivered,
    devLogged: Boolean(devLogged),
    sentDate: toShortDate(sentOn),
    sentDateCompact: toCompactDate(sentOn),
  };
}

async function sendXrayInvoices(orderIds = [], options = {}) {
  const ids = [
    ...new Set(
      (Array.isArray(orderIds) ? orderIds : [])
        .map((id) => normalizeOrderId(id))
        .filter(Boolean)
    ),
  ];

  if (!ids.length) {
    throw new ApiError(400, "At least one order id is required");
  }

  const customEmails = options.emails
    ? assertValidRecipientEmails(options.emails)
    : null;

  const sent = [];

  for (const orderId of ids) {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new ApiError(404, `Order ${orderId} not found`);
    }

    const xrayRow = await InvoiceXray.findByOrderId(orderId);

    if (!xrayRow) {
      throw new ApiError(404, `No X-Ray invoice found for order ${orderId}`);
    }

    if (xrayRow.sent_date) {
      continue;
    }

    const orderPayments = await Order.findPaymentsByOrderId(orderId);
    const recipientEmails =
      customEmails ||
      normalizeRecipientEmails(
        await resolveInvoiceRecipientFromOrder(order)
      );

    if (!recipientEmails.length) {
      throw new ApiError(400, NO_PROVIDER_EMAIL_MESSAGE);
    }

    const { recipient: deliveredTo } = await deliverXrayInvoiceEmail(
      xrayRow,
      order,
      orderPayments,
      { isResend: false, recipientEmails }
    );

    const markedCount = await InvoiceXray.markAsSent(orderId);

    if (!markedCount) {
      continue;
    }

    await getPool().execute(
      `UPDATE invoice_xray_details
       SET recipient_emails = :recipientEmails,
           updated_at = NOW()
       WHERE order_id = :orderId`,
      { recipientEmails: deliveredTo, orderId }
    );

    sent.push({ orderId, recipient: deliveredTo });
  }

  if (!sent.length) {
    throw new ApiError(400, "Selected X-Ray invoices are already sent");
  }

  return { sentCount: sent.length, sent };
}

async function resendXrayInvoices(orderIds = [], options = {}) {
  const ids = [
    ...new Set(
      (Array.isArray(orderIds) ? orderIds : [])
        .map((id) => normalizeOrderId(id))
        .filter(Boolean)
    ),
  ];

  if (!ids.length) {
    throw new ApiError(400, "At least one order id is required");
  }

  const customEmails = options.emails
    ? assertValidRecipientEmails(options.emails)
    : null;

  const resent = [];

  for (const orderId of ids) {
    const order = await Order.findById(orderId);

    if (!order) {
      throw new ApiError(404, `Order ${orderId} not found`);
    }

    const xrayRow = await InvoiceXray.findByOrderId(orderId);

    if (!xrayRow) {
      throw new ApiError(404, `No X-Ray invoice found for order ${orderId}`);
    }

    if (!xrayRow.sent_date) {
      throw new ApiError(
        400,
        "Only sent X-Ray invoices can be resent from the resend tab"
      );
    }

    const orderPayments = await Order.findPaymentsByOrderId(orderId);
    const recipientEmails =
      customEmails ||
      normalizeRecipientEmails(
        await resolveInvoiceRecipientFromOrder(order)
      );

    if (!recipientEmails.length) {
      throw new ApiError(400, NO_PROVIDER_EMAIL_MESSAGE);
    }

    const { recipient: deliveredTo } = await deliverXrayInvoiceEmail(
      xrayRow,
      order,
      orderPayments,
      { isResend: true, recipientEmails }
    );

    await getPool().execute(
      `UPDATE invoice_xray_details
       SET sent_date = CURDATE(),
           recipient_emails = :recipientEmails,
           updated_at = NOW()
       WHERE order_id = :orderId`,
      { recipientEmails: deliveredTo, orderId }
    );

    resent.push({ orderId, recipient: deliveredTo });
  }

  return { resentCount: resent.length, resent };
}

async function emailXrayInvoiceByOrderId(orderId, options = {}) {
  const normalizedOrderId = normalizeOrderId(orderId);

  if (!normalizedOrderId) {
    throw new ApiError(400, "Invalid order id");
  }

  const result = await sendXrayInvoices([normalizedOrderId], options);
  const sentEntry = result.sent?.[0];

  if (!sentEntry) {
    throw new ApiError(400, "X-Ray invoice is already marked as sent");
  }

  const sentOn = new Date();

  return {
    orderId: normalizedOrderId,
    recipient: sentEntry.recipient,
    recipientEmail: sentEntry.recipient,
    emailed: true,
    devLogged: false,
    xraySentDate: toShortDate(sentOn),
    xraySentDateCompact: toCompactDate(sentOn),
  };
}

async function writeOffInvoices(body = {}, userId) {
  const items = Array.isArray(body.invoices) ? body.invoices : [];

  if (!items.length) {
    throw new ApiError(400, "No invoices selected for write off");
  }

  const orderAction = body.orderAction === "close_order" ? "close_order" : "keep_write_off";
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const writtenOff = [];

    for (const item of items) {
      const invoiceId = normalizeInvoiceId(
        item.invoiceId || item.invoiceDbId || item.id
      );

      if (!invoiceId) {
        continue;
      }

      const invoice = await Invoice.findById(invoiceId);

      if (!invoice) {
        throw new ApiError(404, `Invoice ${invoiceId} not found`);
      }

      if (invoice.status === "Written Off") {
        throw new ApiError(400, "Invoice is already written off");
      }

      const orderPayments = await Order.findPaymentsByOrderId(
        invoice.order_id,
        connection
      );
      const financials = resolveRowFinancials(invoice, orderPayments);
      const currentDue = financials.amountDue;
      const requestedWriteOff = toNumber(
        item.writeOffAmount ?? item.dueAmount ?? body.amount
      );

      if (currentDue <= 0 || body.isZeroDue) {
        const newOrderStatus =
          orderAction === "close_order" ? "Completed" : "Write Offs";
        const isWriteOffs = orderAction === "keep_write_off" ? 1 : 0;

        await connection.execute(
          `UPDATE orders
           SET status = :status, is_write_offs = :isWriteOffs, updated_at = NOW()
           WHERE id = :orderId`,
          {
            status: newOrderStatus,
            isWriteOffs,
            orderId: invoice.order_id,
          }
        );

        if (invoice.status !== "Paid") {
          await Invoice.writeOff(connection, invoiceId, {
            status: currentDue <= 0 ? "Paid" : "Written Off",
            amountDue: 0,
            writeoffAmount: toNumber(invoice.writeoff_amount),
            writeoffBy: userId || null,
            writeoffReason:
              orderAction === "close_order"
                ? "Order closed with no remaining due"
                : "Order marked as write off with no remaining due",
          });
        }

        writtenOff.push({
          invoiceId,
          orderId: invoice.order_id,
          writeOffAmount: 0,
          amountDue: 0,
          status:
            orderAction === "close_order" ? "Completed" : "Write Offs",
          orderStatus: newOrderStatus,
        });

        await syncOrderPaymentDuesFromInvoice(connection, invoice.order_id);
        continue;
      }

      const writeOffAmount = requestedWriteOff;

      if (writeOffAmount <= 0) {
        continue;
      }

      const appliedAmount = Math.min(writeOffAmount, currentDue);

      if (appliedAmount <= 0) {
        throw new ApiError(400, "There is no due amount available to write off");
      }

      const newDue = Math.max(0, currentDue - appliedAmount);
      const totalWriteoff = toNumber(invoice.writeoff_amount) + appliedAmount;
      const newStatus = newDue <= 0 ? "Written Off" : "Partial";
      const writeoffReason =
        body.writeOffType === "specified"
          ? `Specified write off of ${formatMoney(appliedAmount)}`
          : `Full write off of ${formatMoney(appliedAmount)}`;

      await Invoice.writeOff(connection, invoiceId, {
        status: newStatus,
        amountDue: newDue,
        writeoffAmount: totalWriteoff,
        writeoffBy: userId || null,
        writeoffReason,
      });

      if (newDue <= 0) {
        const newOrderStatus =
          orderAction === "close_order" ? "Completed" : "Write Offs";
        const isWriteOffs = orderAction === "keep_write_off" ? 1 : 0;

        await connection.execute(
          `UPDATE orders
           SET status = :status, is_write_offs = :isWriteOffs, updated_at = NOW()
           WHERE id = :orderId`,
          {
            status: newOrderStatus,
            isWriteOffs,
            orderId: invoice.order_id,
          }
        );
      }

      writtenOff.push({
        invoiceId,
        orderId: invoice.order_id,
        writeOffAmount: appliedAmount,
        amountDue: newDue,
        status: newStatus,
        orderStatus: newDue <= 0 ? orderAction === "close_order" ? "Completed" : "Write Offs" : null,
      });

      await syncOrderPaymentDuesFromInvoice(connection, invoice.order_id);
    }

    if (!writtenOff.length) {
      throw new ApiError(400, "No valid invoices to write off");
    }

    await connection.commit();

    return { writtenOffCount: writtenOff.length, invoices: writtenOff };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function isReminderAlreadySent(row, reminderLevel) {
  if (reminderLevel === 1) return Boolean(row.reminder_1_sent_at);
  if (reminderLevel === 2) return Boolean(row.reminder_2_sent_at);
  if (reminderLevel === 3) return Boolean(row.reminder_3_sent_at);
  return true;
}

function canSendInvoiceReminder(row, orderPayments, reminderLevel) {
  if (!row?.sent_date) return false;
  if (isReminderAlreadySent(row, reminderLevel)) return false;

  if (reminderLevel === 2 && !row.reminder_1_sent_at) return false;
  if (reminderLevel === 3 && !row.reminder_2_sent_at) return false;

  if (row.status === "Paid" || row.status === "Written Off") return false;

  const financials = resolveRowFinancials(row, orderPayments);
  return financials.amountDue > 0;
}

function canSendXrayInvoiceReminder(row, orderPayments, reminderLevel) {
  if (!row?.sent_date) return false;
  if (isReminderAlreadySent(row, reminderLevel)) return false;

  if (reminderLevel === 2 && !row.reminder_1_sent_at) return false;
  if (reminderLevel === 3 && !row.reminder_2_sent_at) return false;

  const financials = resolveXrayRowFinancials(row, orderPayments);
  return financials.amountDue > 0;
}

async function markStandardInvoiceReminderSent(invoiceId, reminderLevel) {
  const columnMap = {
    1: "reminder_1_sent_at",
    2: "reminder_2_sent_at",
    3: "reminder_3_sent_at",
  };
  const column = columnMap[reminderLevel];

  if (!column) {
    throw new ApiError(400, "Invalid reminder level");
  }

  await getPool().execute(
    `UPDATE invoices
     SET ${column} = NOW(), updated_at = NOW()
     WHERE id = :invoiceId`,
    { invoiceId }
  );
}

async function markXrayInvoiceReminderSent(orderId, reminderLevel) {
  const columnMap = {
    1: "reminder_1_sent_at",
    2: "reminder_2_sent_at",
    3: "reminder_3_sent_at",
  };
  const column = columnMap[reminderLevel];

  if (!column) {
    throw new ApiError(400, "Invalid reminder level");
  }

  await getPool().execute(
    `UPDATE invoice_xray_details
     SET ${column} = NOW(), updated_at = NOW()
     WHERE order_id = :orderId`,
    { orderId }
  );
}

async function sendAutomaticInvoiceReminder(targetId, reminderLevel, type = "standard") {
  const level = Number(reminderLevel);

  if (![1, 2, 3].includes(level)) {
    throw new ApiError(400, "Invalid reminder level");
  }

  if (type === "xray") {
    const orderId = normalizeOrderId(targetId);

    if (!orderId) {
      throw new ApiError(400, "Invalid order id");
    }

    const order = await Order.findById(orderId);
    const xrayRow = await InvoiceXray.findByOrderId(orderId);

    if (!order || !xrayRow) {
      throw new ApiError(404, "X-Ray invoice not found");
    }

    const orderPayments = await Order.findPaymentsByOrderId(orderId);

    if (!canSendXrayInvoiceReminder(xrayRow, orderPayments, level)) {
      return false;
    }

    const recipientEmails = await resolveAutomaticReminderRecipientEmails({
      order,
      xrayRow,
    });

    if (!recipientEmails.length) {
      throw new ApiError(400, NO_PROVIDER_EMAIL_MESSAGE);
    }

    await deliverXrayInvoiceEmail(xrayRow, order, orderPayments, {
      isResend: true,
      reminderLevel: level,
      recipientEmails,
    });

    await markXrayInvoiceReminderSent(orderId, level);
    return true;
  }

  const invoiceId = normalizeInvoiceId(targetId);
  const invoice = await Invoice.findById(invoiceId);

  if (!invoice) {
    throw new ApiError(404, "Invoice not found");
  }

  const orderPayments = await Order.findPaymentsByOrderId(invoice.order_id);

  if (!canSendInvoiceReminder(invoice, orderPayments, level)) {
    return false;
  }

  const order = await Order.findById(invoice.order_id);
  const recipientEmails = await resolveAutomaticReminderRecipientEmails({
    invoice,
    order,
  });

  if (!recipientEmails.length) {
    throw new ApiError(400, NO_PROVIDER_EMAIL_MESSAGE);
  }

  await deliverInvoiceEmail(invoice, {
    isResend: true,
    reminderLevel: level,
    orderPayments,
    recipientEmails,
  });

  await markStandardInvoiceReminderSent(invoiceId, level);
  return true;
}

module.exports = {
  getInvoices,
  getOutstandingInvoices,
  getResendInvoices,
  getCompanyWise,
  getByCompany,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  sendInvoices,
  resendInvoices,
  sendXrayInvoices,
  resendXrayInvoices,
  getXrayOutstandingInvoices,
  getXrayResendInvoices,
  emailInvoiceByOrderId,
  emailXrayInvoiceByOrderId,
  writeOffInvoices,
  getStandardInvoicesByOrderIds,
  getXrayDetailsByOrderIds,
  getXrayInvoiceByOrderId,
  createOrUpdateXrayInvoice,
  sendAutomaticInvoiceReminder,
  mapOrderInvoiceSummary,
  mapOrderPaymentsSummary,
  mapOrderInvoiceFees,
  resolveCustodianDueAmount,
  resolveCustodianPaymentDue,
  shouldMarkCustodianStageComplete,
  DEFAULT_CUSTODIAN_CHARGE,
  syncOrderCustodianDueFromInvoice,
  syncOrderPaymentDuesFromInvoice,
  buildPrintInvoicePdfData,
  buildPrintXrayInvoicePdfData,
  syncInvoiceAmountPaidFromOrder,
};
