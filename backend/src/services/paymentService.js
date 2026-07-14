/**
 * Manual invoice payment recording for the Payments page.
 */

const ApiError = require("../utils/ApiError");
const { rethrowServiceError } = require("../utils/serviceErrorUtils");
const { getPool } = require("../config/database");
const Order = require("../models/Order");
const Invoice = require("../models/Invoice");
const InvoiceXray = require("../models/InvoiceXray");
const { toSqlDateOnly } = require("../utils/dateUtils");
const { sanitizeTrimOrNull } = require("../utils/sanitize");
const { FIELD_LIMITS } = require("../utils/fieldLimits");
const {
  parseOptionalIsoDate,
  assertPositiveInt,
} = require("../utils/sqlSafety");
const { parsePaymentListLimit } = require("../validators/queryValidators");

function toNumber(value) {
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
}

function formatMoney(value) {
  return `$${toNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function trimOrNull(value, options = {}) {
  return sanitizeTrimOrNull(value, options);
}

function buildApplicantName(row = {}) {
  return [row.applicant_first_name, row.applicant_middle_name, row.applicant_last_name]
    .map((part) => trimOrNull(part))
    .filter(Boolean)
    .join(" ");
}

function getCompanyName(row = {}) {
  return (
    trimOrNull(row.provider_name) ||
    trimOrNull(row.serve_company_name) ||
    trimOrNull(row.facility_name) ||
    "—"
  );
}

function hasStandardInvoiceFields(row = {}) {
  return (
    Boolean(row.invoice_date) ||
    toNumber(row.page_count) > 0 ||
    toNumber(row.clerical_time_hours) > 0 ||
    toNumber(row.clerical_hourly_rate) > 0 ||
    toNumber(row.shipping_handling) > 0 ||
    toNumber(row.storage_fee) > 0
  );
}

function hasXrayInvoiceFields(row = {}) {
  if (!row) return false;
  return (
    Boolean(row.xray_invoice_date) ||
    toNumber(row.view_count) > 0 ||
    toNumber(row.payment) > 0
  );
}

function buildStandardInvoiceNumber(order = {}) {
  const orderRef = trimOrNull(order.order_number) || String(order.id || "");
  return `INV-${orderRef}`;
}

function buildXrayInvoiceNumber(order = {}, xrayRow = {}) {
  const stored = trimOrNull(xrayRow.invoice_number);
  if (stored) return stored;
  const orderRef = trimOrNull(order.order_number) || String(order.id || "");
  return `INV-${orderRef}X`;
}

function mapInvoiceSearchItem(type, row, order) {
  if (type === "regular") {
    const total = toNumber(row.total_amount);
    const amountDue = toNumber(row.amount_due);
    const isPaid = row.status === "Paid" || amountDue <= 0;

    return {
      type: "regular",
      label: "Regular Invoice",
      invoiceNumber: row.invoice_number || buildStandardInvoiceNumber(order),
      amount: total,
      amountDue,
      status: isPaid ? "Paid" : row.status || "Unpaid",
      isPaid,
      paymentMethod: row.payment_method || null,
      paymentCheckNumber: row.payment_check_number || "",
      paymentDate: row.payment_date || null,
    };
  }

  const total = toNumber(row.payment);
  const amountPaid = toNumber(row.amount_paid);
  const amountDue = Math.max(0, total - amountPaid);
  const isPaid = amountDue <= 0 && total > 0;

  return {
    type: "xray",
    label: "X-Ray Invoice",
    invoiceNumber: buildXrayInvoiceNumber(order, row),
    amount: total,
    amountDue,
    status: isPaid ? "Paid" : "Unpaid",
    isPaid,
    paymentMethod: row.payment_method || null,
    paymentCheckNumber: row.payment_check_number || "",
    paymentDate: row.payment_date || null,
  };
}

async function resolveOrderByReference(orderRef) {
  const trimmed = trimOrNull(orderRef);
  if (!trimmed) {
    throw new ApiError(400, "Order ID is required");
  }

  let order = null;

  if (/^\d+$/.test(trimmed)) {
    order = await Order.findById(Number(trimmed));
  }

  if (!order) {
    const match = await Order.findByOrderNumber(trimmed);
    if (match?.id) {
      order = await Order.findById(match.id);
    }
  }

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  return order;
}

async function searchOrderInvoices(orderRef) {
  const order = await resolveOrderByReference(orderRef);
  const [invoice, xray] = await Promise.all([
    Invoice.findByOrderId(order.id),
    InvoiceXray.findByOrderId(order.id),
  ]);

  const invoices = [];

  if (invoice && hasStandardInvoiceFields(invoice)) {
    invoices.push(mapInvoiceSearchItem("regular", invoice, order));
  }

  if (xray && hasXrayInvoiceFields(xray)) {
    invoices.push(mapInvoiceSearchItem("xray", xray, order));
  }

  return {
    order: {
      id: order.id,
      orderNumber: order.order_number,
      applicant: buildApplicantName(order),
      company: getCompanyName(order),
      caseNo: order.case_number || "",
    },
    invoices,
  };
}

async function recordManualInvoicePayment(body = {}, userId = null) {
  const orderId = Number(body.orderId);
  const invoiceType = `${body.invoiceType || ""}`.trim().toLowerCase();
  const checkNumber = trimOrNull(body.checkNumber);
  const paymentDate = trimOrNull(body.paymentDate);
  const note = trimOrNull(body.note, { maxLength: FIELD_LIMITS.TEXT });

  if (!Number.isFinite(orderId)) {
    throw new ApiError(400, "orderId is required");
  }

  if (!["regular", "xray"].includes(invoiceType)) {
    throw new ApiError(400, "invoiceType must be regular or xray");
  }

  if (!checkNumber) {
    throw new ApiError(400, "Check number is required");
  }

  if (!paymentDate) {
    throw new ApiError(400, "Payment date is required");
  }

  const sqlPaymentDate = toSqlDateOnly(paymentDate);
  if (!sqlPaymentDate) {
    throw new ApiError(400, "Payment date is invalid");
  }

  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (invoiceType === "regular") {
      const invoice = await Invoice.findByOrderId(orderId, connection);
      if (!invoice || !hasStandardInvoiceFields(invoice)) {
        throw new ApiError(404, "Regular invoice not found for this order");
      }

      const total = toNumber(invoice.total_amount);
      if (total <= 0) {
        throw new ApiError(400, "Invoice total must be greater than zero");
      }

      if (invoice.status === "Paid" || toNumber(invoice.amount_due) <= 0) {
        throw new ApiError(400, "This invoice is already paid");
      }

      await connection.execute(
        `UPDATE invoices
         SET amount_paid = :amountPaid,
             amount_due = 0,
             status = 'Paid',
             payment_method = 'manual',
             payment_check_number = :checkNumber,
             payment_date = :paymentDate,
             notes = :note,
             payment_recorded_by = :recordedBy,
             payment_recorded_at = NOW(),
             updated_at = NOW()
         WHERE id = :id`,
        {
          id: invoice.id,
          amountPaid: total,
          checkNumber,
          paymentDate: sqlPaymentDate,
          note,
          recordedBy: userId || null,
        }
      );
    } else {
      const xray = await InvoiceXray.findByOrderId(orderId, connection);
      if (!xray || !hasXrayInvoiceFields(xray)) {
        throw new ApiError(404, "X-Ray invoice not found for this order");
      }

      const total = toNumber(xray.payment);
      if (total <= 0) {
        throw new ApiError(400, "X-Ray invoice total must be greater than zero");
      }

      if (toNumber(xray.amount_paid) >= total) {
        throw new ApiError(400, "This X-Ray invoice is already paid");
      }

      await connection.execute(
        `UPDATE invoice_xray_details
         SET amount_paid = :amountPaid,
             status = 'Paid',
             payment_method = 'manual',
             payment_check_number = :checkNumber,
             payment_date = :paymentDate,
             notes = :note,
             payment_recorded_by = :recordedBy,
             payment_recorded_at = NOW(),
             updated_at = NOW()
         WHERE order_id = :orderId`,
        {
          orderId,
          amountPaid: total,
          checkNumber,
          paymentDate: sqlPaymentDate,
          note,
          recordedBy: userId || null,
        }
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    rethrowServiceError(error);
  } finally {
    connection.release();
  }

  await Order.syncOrderStatusFromWorkflow(orderId);

  try {
    const personalPortalService = require("./personalPortalService");
    await personalPortalService.syncPortalStatusForDmsOrder(orderId);
  } catch (_syncError) {
    // Non-blocking
  }

  return searchOrderInvoices(order.order_number);
}

function mapManualPaymentRow(row) {
  const paymentType = row.payment_type === "xray" ? "xray" : "regular";
  const paymentTypeLabel = paymentType === "xray" ? "X-Ray" : "Regular";

  return {
    id: row.id,
    orderId: row.order_id,
    orderNo: row.order_number,
    company: row.company_name || "—",
    applicant: row.applicant_name || "—",
    caseNo: row.case_number || "",
    invoiceNo: row.invoice_number || "",
    invoiceId: row.invoice_ref || "",
    paymentType,
    paymentTypeLabel,
    amount: toNumber(row.amount),
    amountDisplay: `$${toNumber(row.amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    paymentDate: row.payment_date,
    status: "Paid",
    method: "Check",
    channel: "manual",
    referenceNo: row.payment_check_number || "",
    recordedBy: row.recorded_by_name || "System",
    recordedAt: row.payment_recorded_at || null,
    notes: row.notes || "",
  };
}

async function getManualPayments(query = {}) {
  const pool = getPool();
  const limit = parsePaymentListLimit(query);
  const conditions = ["i.payment_method = 'manual'"];
  const params = {};

  if (query.orderId) {
    conditions.push("o.id = :orderId");
    params.orderId = assertPositiveInt(query.orderId, "orderId");
  }

  const dateFrom = parseOptionalIsoDate(query.dateFrom, "dateFrom");
  if (dateFrom) {
    conditions.push("i.payment_date >= :dateFrom");
    params.dateFrom = dateFrom;
  }

  const dateTo = parseOptionalIsoDate(query.dateTo, "dateTo");
  if (dateTo) {
    conditions.push("i.payment_date <= :dateTo");
    params.dateTo = dateTo;
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const [standardRows] = await pool.execute(
    `SELECT
       CONCAT('manual-inv-', i.id) AS id,
       o.id AS order_id,
       o.order_number,
       o.case_number,
       COALESCE(p.company_name, o.serve_company_name, f.facility_name, '—') AS company_name,
       TRIM(CONCAT_WS(' ', o.applicant_first_name, o.applicant_middle_name, o.applicant_last_name)) AS applicant_name,
       i.invoice_number,
       CAST(i.id AS CHAR) AS invoice_ref,
       'regular' AS payment_type,
       i.amount_paid AS amount,
       i.payment_date,
       i.payment_check_number,
       i.payment_recorded_at,
       i.notes,
       e.name AS recorded_by_name
     FROM invoices i
     INNER JOIN orders o ON o.id = i.order_id
     LEFT JOIN facilities f ON f.id = o.facility_id
     LEFT JOIN providers p ON p.id = o.provider_id
     LEFT JOIN matrix_employees e ON e.id = i.payment_recorded_by
     ${whereClause}`,
    params
  );

  const xrayConditions = ["x.payment_method = 'manual'"];
  const xrayParams = {};

  if (query.orderId) {
    xrayConditions.push("o.id = :orderId");
    xrayParams.orderId = assertPositiveInt(query.orderId, "orderId");
  }

  if (dateFrom) {
    xrayConditions.push("x.payment_date >= :dateFrom");
    xrayParams.dateFrom = dateFrom;
  }

  if (dateTo) {
    xrayConditions.push("x.payment_date <= :dateTo");
    xrayParams.dateTo = dateTo;
  }

  const xrayWhereClause = `WHERE ${xrayConditions.join(" AND ")}`;

  const [xrayRows] = await pool.execute(
    `SELECT
       CONCAT('manual-xray-', x.id) AS id,
       o.id AS order_id,
       o.order_number,
       o.case_number,
       COALESCE(p.company_name, o.serve_company_name, f.facility_name, '—') AS company_name,
       TRIM(CONCAT_WS(' ', o.applicant_first_name, o.applicant_middle_name, o.applicant_last_name)) AS applicant_name,
       x.invoice_number,
       CAST(o.id AS CHAR) AS invoice_ref,
       'xray' AS payment_type,
       x.amount_paid AS amount,
       x.payment_date,
       x.payment_check_number,
       x.payment_recorded_at,
       x.notes,
       e.name AS recorded_by_name
     FROM invoice_xray_details x
     INNER JOIN orders o ON o.id = x.order_id
     LEFT JOIN facilities f ON f.id = o.facility_id
     LEFT JOIN providers p ON p.id = o.provider_id
     LEFT JOIN matrix_employees e ON e.id = x.payment_recorded_by
     ${xrayWhereClause}`,
    xrayParams
  );

  const payments = [...standardRows, ...xrayRows]
    .map(mapManualPaymentRow)
    .sort((a, b) =>
      String(b.paymentDate || "").localeCompare(String(a.paymentDate || ""))
    )
    .slice(0, limit);

  return payments;
}

function mapDetailInvoice(type, row, order) {
  if (type === "regular") {
    const amount = toNumber(row.total_amount);
    const paid = toNumber(row.amount_paid);
    const due = Math.max(0, toNumber(row.amount_due));
    const status = row.status || (due <= 0 ? "Paid" : "Unpaid");

    return {
      id: `inv-${row.id}`,
      invoiceNo: row.invoice_number || buildStandardInvoiceNumber(order),
      typeLabel: "Regular",
      invoiceDate: row.invoice_date || null,
      lastSentDate: row.sent_date || null,
      amount,
      paid,
      due,
      amountDisplay: formatMoney(amount),
      paidDisplay: formatMoney(paid),
      dueDisplay: formatMoney(due),
      status,
    };
  }

  const amount = toNumber(row.payment);
  const paid = toNumber(row.amount_paid);
  const due = Math.max(0, amount - paid);
  const status = due <= 0 && amount > 0 ? "Paid" : "Unpaid";

  return {
    id: `xray-${row.id}`,
    invoiceNo: buildXrayInvoiceNumber(order, row),
    typeLabel: "X-Ray",
    invoiceDate: row.xray_invoice_date || null,
    lastSentDate: row.sent_date || null,
    amount,
    paid,
    due,
    amountDisplay: formatMoney(amount),
    paidDisplay: formatMoney(paid),
    dueDisplay: formatMoney(due),
    status,
  };
}

async function getOrderPaymentDetail(orderRef) {
  const stripePaymentService = require("./stripePaymentService");
  const order = await resolveOrderByReference(orderRef);
  const [invoice, xray, manualRows, onlineRows] = await Promise.all([
    Invoice.findByOrderId(order.id),
    InvoiceXray.findByOrderId(order.id),
    getManualPayments({ orderId: order.id }),
    stripePaymentService.getOnlinePaymentsForOrder(order.id),
  ]);

  const invoices = [];
  if (invoice && hasStandardInvoiceFields(invoice)) {
    invoices.push(mapDetailInvoice("regular", invoice, order));
  }
  if (xray && hasXrayInvoiceFields(xray)) {
    invoices.push(mapDetailInvoice("xray", xray, order));
  }

  const totals = invoices.reduce(
    (acc, row) => {
      acc.invoiced += row.amount;
      acc.paid += row.paid;
      acc.due += row.due;
      return acc;
    },
    { invoiced: 0, paid: 0, due: 0 }
  );

  return {
    orderId: order.id,
    orderNo: order.order_number,
    company: getCompanyName(order),
    applicant: buildApplicantName(order) || "—",
    caseNo: order.case_number || "",
    invoices,
    manualPayments: manualRows,
    onlinePayments: onlineRows,
    totals: {
      ...totals,
      invoicedDisplay: formatMoney(totals.invoiced),
      paidDisplay: formatMoney(totals.paid),
      dueDisplay: formatMoney(totals.due),
    },
  };
}

async function getOnlinePayments(query = {}) {
  const stripePaymentService = require("./stripePaymentService");
  return stripePaymentService.getOnlinePayments(query);
}

module.exports = {
  searchOrderInvoices,
  recordManualInvoicePayment,
  getManualPayments,
  getOnlinePayments,
  getOrderPaymentDetail,
};
