const ApiError = require("../utils/ApiError");
const Invoice = require("../models/Invoice");
const InvoiceXray = require("../models/InvoiceXray");
const Order = require("../models/Order");
const Provider = require("../models/Provider");
const config = require("../config");
const { getPool } = require("../config/database");
const { calculateRushLevel } = require("../utils/rushUtils");

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

function getInvoiceRecipientEmail(invoice) {
  return trimOrNull(invoice?.recipient_emails) || trimOrNull(invoice?.provider_email);
}

async function resolveInvoiceRecipientFromOrder(order, connection = null) {
  const providerId = order?.provider_id || null;

  if (!providerId) {
    return null;
  }

  const provider = await Provider.findById(providerId, connection);

  return trimOrNull(provider?.email);
}

function getXrayPayment(xrayRow) {
  return xrayRow ? toNumber(xrayRow.payment) : 0;
}

function getXrayPrepaymentPaid(invoice, xrayRow) {
  if (!invoice || !xrayRow) return 0;
  return Math.min(toNumber(invoice.amount_paid), getXrayPayment(xrayRow));
}

const ORDER_PAYMENT_TYPES = ["prepayment", "custodian", "xray"];

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

function resolveAmountPaid(orderPayments, existing = null) {
  if (orderPayments !== undefined) {
    return sumOrderPayments(orderPayments);
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
    `SELECT id, total_amount, status, writeoff_amount
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
  const amountPaid = sumOrderPayments(orderPayments);
  const totalAmount = toNumber(invoice.total_amount);
  const writeoffAmount = toNumber(invoice.writeoff_amount);
  const { amountDue, status: derivedStatus } = resolveInvoiceAmounts(
    totalAmount,
    amountPaid,
    writeoffAmount
  );
  const status = resolveInvoiceStatusForSave(
    invoice,
    totalAmount,
    amountPaid,
    derivedStatus
  );

  await connection.execute(
    `UPDATE invoices
     SET amount_paid = :amountPaid,
         amount_due = :amountDue,
         status = :status,
         updated_at = NOW()
     WHERE id = :id`,
    { amountPaid, amountDue, status, id: invoice.id }
  );

  return { amountPaid, amountDue, status };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
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

function buildOrderDetailsText(row) {
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
    ORDER_TYPE_LABELS[row.order_type] || row.order_type
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

  return lines.join("\n");
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

function calculateTotals(payload = {}) {
  const servedAmount = toNumber(payload.servedAmount);
  const serviceFee = toNumber(payload.serviceFee);
  const custodianFee = toNumber(payload.custodianFee);
  const xrayFee = toNumber(payload.xrayFee);
  const mileage = toNumber(payload.mileage);
  const parking = toNumber(payload.parking);
  const otherFee = toNumber(payload.other);
  const pageCount = Math.max(0, Math.floor(toNumber(payload.pages)));
  const perPageAmount = toNumber(payload.perPageAmount);
  const pagesAmount = pageCount * perPageAmount;

  const totalAmount =
    servedAmount +
    serviceFee +
    custodianFee +
    xrayFee +
    mileage +
    parking +
    otherFee +
    pagesAmount;

  return {
    servedAmount,
    serviceFee,
    custodianFee,
    xrayFee,
    mileage,
    parking,
    otherFee,
    pageCount,
    perPageAmount,
    totalAmount,
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
    serviceDate: toInputDate(row.service_date),
    sentDate: toInputDate(row.sent_date),
    servedAmount: toNumber(row.served_amount).toFixed(2),
    serviceFee: toNumber(row.service_fee).toFixed(2),
    custodianFee: toNumber(row.custodian_fee).toFixed(2),
    xrayFee: toNumber(row.xray_fee).toFixed(2),
    mileage: toNumber(row.mileage).toFixed(2),
    parking: toNumber(row.parking).toFixed(2),
    other: toNumber(row.other_fee).toFixed(2),
    pages: String(row.page_count ?? 0),
    perPageAmount: toNumber(row.per_page_amount).toFixed(2),
    totalAmount: toNumber(row.total_amount),
    amountPaid: toNumber(row.amount_paid),
    amountDue: toNumber(row.amount_due),
    writeoffAmount: toNumber(row.writeoff_amount),
    notes: row.notes || "",
    sendOrderDetails: Boolean(row.send_order_details),
    rushOrder: Boolean(row.is_rush_order),
    rushLevel: calculateRushLevel(row.subpoena_date),
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

function mapXrayDetail(row, invoice = null) {
  if (!row) return null;

  const payment = getXrayPayment(row);
  const prepayment = getXrayPrepaymentPaid(invoice, row);

  return {
    xrayInvoiceDate: toInputDate(row.xray_invoice_date),
    examDate: toInputDate(row.exam_date),
    views: String(row.view_count ?? 0),
    perViewAmount: toNumber(row.per_view_amount).toFixed(2),
    payment: payment.toFixed(2),
    prepayment: prepayment.toFixed(2),
    checkNumber: row.check_number || "",
    description: row.description || "",
  };
}

function hasStandardInvoiceFields(row) {
  return (
    Boolean(row.invoice_date) ||
    toNumber(row.service_fee) > 0 ||
    toNumber(row.custodian_fee) > 0 ||
    toNumber(row.served_amount) > 0 ||
    toNumber(row.mileage) > 0 ||
    toNumber(row.parking) > 0 ||
    toNumber(row.other_fee) > 0 ||
    toNumber(row.page_count) > 0
  );
}

function mapXrayReviewAmount(xrayRow, invoiceRow = null) {
  if (!xrayRow) return null;

  const payment = getXrayPayment(xrayRow);
  const prepayment = getXrayPrepaymentPaid(invoiceRow, xrayRow);
  const balanceDue = Math.max(0, payment - prepayment);

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

function mapOrderInvoiceFees(invoiceRow, xrayRow = null) {
  if (!invoiceRow) {
    return {
      hasInvoice: false,
      serviceFee: 0,
      custodianFee: 0,
      xrayFee: 0,
    };
  }

  const xrayFeeFromInvoice = toNumber(invoiceRow.xray_fee);
  const xrayFee =
    xrayFeeFromInvoice > 0
      ? xrayFeeFromInvoice
      : xrayRow
        ? toNumber(xrayRow.payment)
        : 0;

  return {
    hasInvoice: true,
    serviceFee: toNumber(invoiceRow.service_fee),
    custodianFee: toNumber(invoiceRow.custodian_fee),
    xrayFee,
  };
}

function mapOrderInvoiceSummary(row, xrayRow = null, orderPayments = []) {
  const paymentsSummary = mapOrderPaymentsSummary(orderPayments);

  if (!row) {
    return {
      createOnly: true,
      hasXray: false,
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

  return {
    createOnly: !hasStandardInvoice,
    hasXray,
    hasStandardInvoice,
    invoiceId: row.id,
    reviewDate: toShortDate(row.invoice_date),
    reviewAmount: formatMoney(row.total_amount),
    printAmount: formatMoney(row.total_amount),
    custodianAmount:
      toNumber(row.custodian_fee) > 0 ? formatMoney(row.custodian_fee) : null,
    sentDate: row.sent_date ? toShortDate(row.sent_date) : null,
    xrayReviewDate: hasXray ? toShortDate(xrayRow.xray_invoice_date) : "",
    xrayReviewAmount: mapXrayReviewAmount(xrayRow, row),
    showEmail: Boolean(getInvoiceRecipientEmail(row)),
    paid:
      toNumber(row.amount_paid) > 0 ? formatMoney(row.amount_paid) : null,
    status: row.status || "Unpaid",
    isWrittenOff: row.status === "Written Off",
    writeoffAmount:
      toNumber(row.writeoff_amount) > 0
        ? formatMoney(row.writeoff_amount)
        : null,
    date: toShortDate(row.invoice_date),
    sentDateRaw: toInputDate(row.sent_date),
    invoiced: formatMoney(row.total_amount),
    due: formatMoney(row.amount_due),
    paidAmount: formatMoney(row.amount_paid),
    ...paymentsSummary,
    servedAmount: toNumber(row.served_amount).toFixed(2),
    serviceFee: toNumber(row.service_fee).toFixed(2),
    custodianFee: toNumber(row.custodian_fee).toFixed(2),
    xrayFee: toNumber(row.xray_fee).toFixed(2),
    mileage: toNumber(row.mileage).toFixed(2),
    parking: toNumber(row.parking).toFixed(2),
    other: toNumber(row.other_fee).toFixed(2),
    pages: String(row.page_count ?? 0),
    perPageAmount: toNumber(row.per_page_amount).toFixed(2),
    notes: row.notes || "",
    sendOrderDetails: Boolean(row.send_order_details),
    rushOrder: Boolean(row.is_rush_order),
    rushLevel: calculateRushLevel(row.subpoena_date),
    subpoenaDate: toInputDate(row.subpoena_date),
  };
}

function normalizeInvoiceId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function mapOutstandingRow(row) {
  const isSent = Boolean(row.sent_date);
  const displayDate = isSent ? row.sent_date : row.invoice_date;
  const invoiceDbId = normalizeInvoiceId(row.id);
  const isWrittenOff = row.status === "Written Off";

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
    invoiced: formatMoney(row.total_amount),
    paid: formatMoney(row.amount_paid),
    due: formatMoney(row.amount_due),
  };
}

function mapResendRow(row) {
  const isSent = Boolean(row.sent_date);
  const displayDate = isSent ? row.sent_date : row.invoice_date;
  const invoiceDbId = normalizeInvoiceId(row.id);

  return {
    id: invoiceDbId || row.id,
    invoiceId: invoiceDbId,
    orderId: row.order_id,
    company: row.facility_name || "",
    email: getInvoiceRecipientEmail(row) || "",
    caseNo: row.order_number,
    applicant: buildApplicantName(row),
    isSent,
    sentDate: toShortDate(displayDate),
    days: daysSince(displayDate),
    invoiceDate: toShortDate(row.invoice_date),
    invoiced: formatMoney(row.total_amount),
    paid: formatMoney(row.amount_paid),
    due: formatMoney(row.amount_due),
  };
}

function buildSummary(rows = []) {
  const companies = new Set();

  let invoiced = 0;
  let paid = 0;
  let due = 0;

  rows.forEach((row) => {
    if (row.facility_id) companies.add(row.facility_id);
    invoiced += toNumber(row.total_amount);
    paid += toNumber(row.amount_paid);
    due += toNumber(row.amount_due);
  });

  return {
    companies: companies.size,
    cases: rows.length,
    invoiced: formatMoney(invoiced),
    paid: formatMoney(paid),
    due: formatMoney(due),
  };
}

function groupOutstandingRows(rows = []) {
  const groups = new Map();

  rows.forEach((row) => {
    const company = row.facility_name || "Unknown Company";
    const mappedRow = mapOutstandingRow(row);

    if (!groups.has(company)) {
      groups.set(company, {
        company,
        emails: row.facility_email || "",
        rows: [],
        total: { invoiced: 0, paid: 0, due: 0 },
      });
    }

    const group = groups.get(company);
    group.rows.push(mappedRow);
    group.total.invoiced += toNumber(row.total_amount);
    group.total.paid += toNumber(row.amount_paid);
    group.total.due += toNumber(row.amount_due);
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
  const xrayFee =
    options.xrayFee !== undefined ? toNumber(options.xrayFee) : toNumber(body.xrayFee);
  const totals = calculateTotals({ ...body, xrayFee });
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
    serviceDate: trimOrNull(body.serviceDate),
    sentDate: existing?.sent_date || null,
    servedAmount: totals.servedAmount,
    serviceFee: totals.serviceFee,
    custodianFee: totals.custodianFee,
    xrayFee: totals.xrayFee,
    mileage: totals.mileage,
    parking: totals.parking,
    otherFee: totals.otherFee,
    pageCount: totals.pageCount,
    perPageAmount: totals.perPageAmount,
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

  return {
    groups: groupOutstandingRows(rows),
    summary: buildSummary(rows),
    count: rows.length,
  };
}

async function getResendInvoices(query = {}) {
  const rows = await Invoice.findResend({
    dateFrom: trimOrNull(query.dateFrom),
    dateTo: trimOrNull(query.dateTo),
  });

  return {
    invoices: rows.map(mapResendRow),
    summary: buildSummary(rows),
    count: rows.length,
  };
}

async function getInvoices(query = {}) {
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

  const invoice = await Invoice.findByOrderId(normalizedOrderId);
  const xray = await InvoiceXray.findByOrderId(normalizedOrderId);

  return {
    invoiceId: invoice?.id || null,
    xray: mapXrayDetail(xray, invoice),
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

    let invoice = await Invoice.findByOrderId(orderId);
    const existingXray = await InvoiceXray.findByOrderId(orderId, connection);
    const orderPayments = await Order.findPaymentsByOrderId(orderId, connection);
    const orderXrayPaid = getOrderPaymentAmount(orderPayments, "xray");
    const prepaymentInput = trimOrNull(body.prepayment);
    const prepayment =
      prepaymentInput !== null ? toNumber(body.prepayment) : orderXrayPaid;
    const oldPrepayment = getXrayPrepaymentPaid(invoice, existingXray);
    const xrayFee = viewsAmount;

    if (!invoice) {
      const totalAmount = xrayFee;
      const amountPaid = prepayment > 0 ? prepayment : orderXrayPaid;
      const { amountDue, status } = resolveInvoiceAmounts(totalAmount, amountPaid);
      const recipientEmails = await resolveInvoiceRecipientFromOrder(order, connection);

      const invoiceId = await Invoice.create(connection, {
        invoiceNumber: `INV-${order.order_number}`,
        orderId,
        facilityId: order.facility_id,
        status,
        invoiceDate: null,
        serviceDate: null,
        sentDate: null,
        servedAmount: 0,
        serviceFee: 0,
        custodianFee: 0,
        xrayFee,
        mileage: 0,
        parking: 0,
        otherFee: 0,
        pageCount: 0,
        perPageAmount: 0,
        totalAmount,
        amountPaid,
        amountDue,
        notes: description,
        sendOrderDetails: 0,
        isRushOrder: 0,
        recipientEmails,
        createdBy: userId || null,
      });

      invoice = { id: invoiceId };
    } else {
      const servedAmount = toNumber(invoice.served_amount);
      const serviceFee = toNumber(invoice.service_fee);
      const custodianFee = toNumber(invoice.custodian_fee);
      const mileage = toNumber(invoice.mileage);
      const parking = toNumber(invoice.parking);
      const otherFee = toNumber(invoice.other_fee);
      const pageCount = Math.max(0, Math.floor(toNumber(invoice.page_count)));
      const perPageAmount = toNumber(invoice.per_page_amount);
      const pagesAmount = pageCount * perPageAmount;
      const totalAmount =
        servedAmount +
        serviceFee +
        custodianFee +
        xrayFee +
        mileage +
        parking +
        otherFee +
        pagesAmount;
      const basePaid = Math.max(0, toNumber(invoice.amount_paid) - oldPrepayment);
      const alreadyIncludedOrderXray =
        !existingXray ? Math.min(basePaid, orderXrayPaid) : 0;
      const incrementalPrepayment = Math.max(
        0,
        prepayment - alreadyIncludedOrderXray
      );
      const amountPaid = basePaid + incrementalPrepayment;
      const writeoffAmount = toNumber(invoice.writeoff_amount);
      const { amountDue, status: derivedStatus } = resolveInvoiceAmounts(
        totalAmount,
        amountPaid,
        writeoffAmount
      );
      const status = resolveInvoiceStatusForSave(
        invoice,
        totalAmount,
        amountPaid,
        derivedStatus
      );
      const recipientEmails = await resolveInvoiceRecipientFromOrder(order, connection);

      await Invoice.update(connection, invoice.id, {
        status,
        invoiceDate: invoice.invoice_date,
        serviceDate: invoice.service_date,
        sentDate: invoice.sent_date,
        servedAmount,
        serviceFee,
        custodianFee,
        xrayFee,
        mileage,
        parking,
        otherFee,
        pageCount,
        perPageAmount,
        totalAmount,
        amountPaid,
        amountDue,
        notes: invoice.notes,
        sendOrderDetails: invoice.send_order_details,
        isRushOrder: invoice.is_rush_order,
        recipientEmails,
      });
    }

    await InvoiceXray.upsert(connection, orderId, {
      xrayInvoiceDate,
      examDate,
      viewCount,
      perViewAmount,
      payment: xrayFee,
      checkNumber,
      description,
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

  const existing = await Invoice.findByOrderId(orderId);

  if (existing) {
    throw new ApiError(409, "An invoice already exists for this order");
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [xrayRow, orderPayments] = await Promise.all([
      InvoiceXray.findByOrderId(orderId, connection),
      Order.findPaymentsByOrderId(orderId, connection),
    ]);
    const xrayFee = getXrayPayment(xrayRow);
    const invoicePayload = buildInvoicePayload(body, null, {
      xrayFee,
      orderPayments,
    });
    const recipientEmails = await resolveInvoiceRecipientFromOrder(order, connection);

    const invoiceId = await Invoice.create(connection, {
      invoiceNumber: trimOrNull(body.invoiceNumber) || `INV-${order.order_number}`,
      orderId,
      facilityId: order.facility_id,
      status: invoicePayload.status,
      invoiceDate: invoicePayload.invoiceDate,
      serviceDate: invoicePayload.serviceDate,
      sentDate: invoicePayload.sentDate,
      servedAmount: invoicePayload.servedAmount,
      serviceFee: invoicePayload.serviceFee,
      custodianFee: invoicePayload.custodianFee,
      xrayFee: invoicePayload.xrayFee,
      mileage: invoicePayload.mileage,
      parking: invoicePayload.parking,
      otherFee: invoicePayload.otherFee,
      pageCount: invoicePayload.pageCount,
      perPageAmount: invoicePayload.perPageAmount,
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
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const xrayRow = await InvoiceXray.findByOrderId(existing.order_id, connection);
    const orderPayments = await Order.findPaymentsByOrderId(existing.order_id, connection);
    const xrayFee = getXrayPayment(xrayRow);
    const invoicePayload = buildInvoicePayload(body, existing, {
      xrayFee,
      orderPayments,
    });
    const recipientEmails = order
      ? await resolveInvoiceRecipientFromOrder(order, connection)
      : trimOrNull(existing.recipient_emails);

    await Invoice.update(connection, id, {
      status: invoicePayload.status,
      invoiceDate: invoicePayload.invoiceDate,
      serviceDate: invoicePayload.serviceDate,
      sentDate: invoicePayload.sentDate,
      servedAmount: invoicePayload.servedAmount,
      serviceFee: invoicePayload.serviceFee,
      custodianFee: invoicePayload.custodianFee,
      xrayFee: invoicePayload.xrayFee,
      mileage: invoicePayload.mileage,
      parking: invoicePayload.parking,
      otherFee: invoicePayload.otherFee,
      pageCount: invoicePayload.pageCount,
      perPageAmount: invoicePayload.perPageAmount,
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

async function getCompanyWise() {
  const rows = await Invoice.findOutstanding({});
  const companiesMap = new Map();

  rows.forEach((row) => {
    const facilityId = row.facility_id;

    if (!companiesMap.has(facilityId)) {
      companiesMap.set(facilityId, {
        id: facilityId,
        company: row.facility_name || "Unknown Company",
        email: row.facility_email || "",
        cases: 0,
        needsResend: 0,
        invoiced: 0,
        paid: 0,
        due: 0,
      });
    }

    const company = companiesMap.get(facilityId);
    company.cases += 1;
    if (row.status === "Needs Resend") {
      company.needsResend += 1;
    }
    company.invoiced += toNumber(row.total_amount);
    company.paid += toNumber(row.amount_paid);
    company.due += toNumber(row.amount_due);
  });

  const companies = Array.from(companiesMap.values())
    .map((company) => ({
      ...company,
      invoiced: formatMoney(company.invoiced),
      paid: formatMoney(company.paid),
      due: formatMoney(company.due),
    }))
    .sort((a, b) => a.company.localeCompare(b.company));

  const summary = {
    companies: companies.length,
    totalCases: rows.length,
    needsResend: companies.reduce((sum, company) => sum + company.needsResend, 0),
    invoiced: formatMoney(rows.reduce((sum, row) => sum + toNumber(row.total_amount), 0)),
    paid: formatMoney(rows.reduce((sum, row) => sum + toNumber(row.amount_paid), 0)),
    due: formatMoney(rows.reduce((sum, row) => sum + toNumber(row.amount_due), 0)),
  };

  return { companies, summary };
}

function mapCompanyInvoiceRow(row) {
  const isSent = Boolean(row.sent_date);
  const displayDate = isSent ? row.sent_date : row.invoice_date;
  const isWrittenOff = row.status === "Written Off";

  return {
    id: row.id,
    invoiceId: row.order_number,
    orderId: row.order_id,
    invoiceDbId: row.id,
    invoiceDate: toShortDate(row.invoice_date),
    days: daysSince(displayDate),
    status: row.status || "Unpaid",
    isWrittenOff,
    isSent,
    invoiced: formatMoney(row.total_amount),
    paid: formatMoney(row.amount_paid),
    due: formatMoney(row.amount_due),
  };
}

async function getByCompany(facilityId, query = {}) {
  const companyId = Number(facilityId);

  if (!Number.isFinite(companyId)) {
    throw new ApiError(400, "Invalid company id");
  }

  const rows = await Invoice.findByFacilityId(companyId, {
    dateFrom: trimOrNull(query.dateFrom),
    dateTo: trimOrNull(query.dateTo),
  });

  if (!rows.length) {
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

  const firstRow = rows[0];
  const invoices = rows.map(mapCompanyInvoiceRow);

  return {
    company: {
      id: companyId,
      name: firstRow.facility_name || "Company",
      email: firstRow.facility_email || "",
    },
    invoices,
    summary: {
      totalCases: invoices.length,
      needsResend: invoices.filter((invoice) => invoice.status === "Needs Resend").length,
      totalInvoiced: formatMoney(
        rows.reduce((sum, row) => sum + toNumber(row.total_amount), 0)
      ),
      totalPaid: formatMoney(
        rows.reduce((sum, row) => sum + toNumber(row.amount_paid), 0)
      ),
      totalDue: formatMoney(
        rows.reduce((sum, row) => sum + toNumber(row.amount_due), 0)
      ),
    },
  };
}

async function deliverInvoiceEmail(invoice, { isResend = false } = {}) {
  if (!invoice) {
    throw new ApiError(404, "Invoice not found");
  }

  const recipient = getInvoiceRecipientEmail(invoice);

  if (!recipient) {
    throw new ApiError(400, "No provider email address is available for this invoice");
  }

  const primaryEmail = recipient.split(",")[0].trim();
  const { sendInvoiceEmail } = require("./emailService");

  const result = await sendInvoiceEmail({
    to: primaryEmail,
    companyName: invoice.provider_name || invoice.facility_name || "Company",
    caseNo: invoice.order_number || "",
    applicant: buildApplicantName(invoice),
    invoiceDate: toShortDate(invoice.invoice_date),
    sentDate: toShortDate(isResend ? invoice.sent_date || new Date() : new Date()),
    invoiced: formatMoney(invoice.total_amount),
    paid: formatMoney(invoice.amount_paid),
    due: formatMoney(invoice.amount_due),
    isResend,
    sendOrderDetails: Boolean(invoice.send_order_details),
    isRushOrder: Boolean(invoice.is_rush_order),
    rushLevel: calculateRushLevel(invoice.subpoena_date),
    orderDetailsText: Boolean(invoice.send_order_details)
      ? buildOrderDetailsText(invoice)
      : "",
  });

  if (!result.delivered) {
    const hint =
      config.nodeEnv === "development" && result.devLogged
        ? "SMTP is not configured or delivery failed (check backend logs)."
        : "Failed to deliver invoice email.";

    throw new ApiError(500, hint);
  }

  return { recipient: primaryEmail, delivered: true };
}

async function sendInvoices(invoiceIds = []) {
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

  const existing = await Invoice.findByIds(ids);
  const unsent = existing.filter((row) => !row.sent_date);

  if (!unsent.length) {
    throw new ApiError(400, "Selected invoices are already sent");
  }

  const unsentIds = unsent
    .map((row) => normalizeInvoiceId(row.id))
    .filter(Boolean);

  const sentCount = await Invoice.markAsSent(unsentIds);

  if (!sentCount) {
    throw new ApiError(400, "Selected invoices are already sent");
  }

  return { sentCount };
}

function canDeliverInvoiceEmail(invoice) {
  if (!invoice) return false;

  if (["Paid", "Written Off"].includes(invoice.status)) {
    return false;
  }

  if (invoice.status === "Needs Resend") {
    return true;
  }

  return Boolean(invoice.sent_date);
}

async function resendInvoices(invoiceIds = []) {
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

    await deliverInvoiceEmail(invoice, {
      isResend: invoice.status === "Needs Resend",
    });

    const updated = await Invoice.markAsEmailSent([invoiceId]);

    if (!updated) {
      throw new ApiError(400, "Unable to update emailed invoice");
    }

    resent.push(invoiceId);
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

  const invoiceId = normalizeInvoiceId(invoice.id);
  const sentCount = await Invoice.markAsSent([invoiceId]);

  if (!sentCount) {
    throw new ApiError(400, "Invoice is already marked as sent");
  }

  return {
    invoiceId,
    orderId: normalizedOrderId,
    isResend: false,
    recipient: null,
    emailed: false,
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
      const writeOffAmount = toNumber(item.writeOffAmount ?? item.dueAmount ?? body.amount);

      if (!invoiceId || writeOffAmount <= 0) {
        continue;
      }

      const invoice = await Invoice.findById(invoiceId);

      if (!invoice) {
        throw new ApiError(404, `Invoice ${invoiceId} not found`);
      }

      if (invoice.status === "Written Off") {
        throw new ApiError(400, "Invoice is already written off");
      }

      const currentDue = toNumber(invoice.amount_due);
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

      if (orderAction === "close_order") {
        await connection.execute(
          `UPDATE orders
           SET status = 'Completed', updated_at = NOW()
           WHERE id = :orderId`,
          { orderId: invoice.order_id }
        );
      }

      writtenOff.push({
        invoiceId,
        orderId: invoice.order_id,
        writeOffAmount: appliedAmount,
        amountDue: newDue,
        status: newStatus,
      });
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
  emailInvoiceByOrderId,
  writeOffInvoices,
  getStandardInvoicesByOrderIds,
  getXrayDetailsByOrderIds,
  getXrayInvoiceByOrderId,
  createOrUpdateXrayInvoice,
  mapOrderInvoiceSummary,
  mapOrderPaymentsSummary,
  mapOrderInvoiceFees,
  syncInvoiceAmountPaidFromOrder,
};
