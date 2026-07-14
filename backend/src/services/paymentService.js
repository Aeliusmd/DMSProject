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
  likePrefix,
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

function resolveManualListFilters(query = {}) {
  const filters = {
    orderId: null,
    orderSearch: null,
    invoiceSearch: null,
    dateFrom: parseOptionalIsoDate(query.dateFrom, "dateFrom"),
    dateTo: parseOptionalIsoDate(query.dateTo, "dateTo"),
  };

  if (query.orderId && Number.isFinite(Number(query.orderId)) && Number(query.orderId) > 0) {
    filters.orderId = assertPositiveInt(query.orderId, "orderId");
  }

  const orderSearch = String(query.orderSearch || "").trim();
  if (orderSearch) {
    if (/^\d+$/.test(orderSearch)) {
      // Pure digits: match PK id or order_number prefix (e.g. 70656 → 70656-1).
      if (!filters.orderId) {
        filters.orderId = assertPositiveInt(orderSearch, "orderSearch");
      }
      filters.orderSearch = orderSearch;
    } else {
      filters.orderSearch = orderSearch;
    }
  } else if (query.orderId && !filters.orderId && String(query.orderId).trim()) {
    const raw = String(query.orderId).trim();
    if (/^\d+$/.test(raw)) {
      filters.orderId = assertPositiveInt(raw, "orderId");
      filters.orderSearch = raw;
    } else {
      filters.orderSearch = raw;
    }
  }

  const invoiceSearch = String(query.invoiceSearch || "").trim();
  if (invoiceSearch) {
    filters.invoiceSearch = invoiceSearch;
  }

  return filters;
}

function wantsPaymentSummary(query = {}) {
  const raw = String(query.includeSummary ?? "1").trim().toLowerCase();
  return !(raw === "0" || raw === "false" || raw === "no");
}

function appendManualFilterConditions(conditions, params, alias, filters, invoiceColumn) {
  if (filters.orderId && filters.orderSearch) {
    // Index-friendly: PK equality OR left-prefix on unique order_number.
    conditions.push(
      "(o.id = :orderId OR o.order_number LIKE :orderSearch)"
    );
    params.orderId = filters.orderId;
    params.orderSearch = likePrefix(filters.orderSearch);
  } else if (filters.orderId) {
    conditions.push("o.id = :orderId");
    params.orderId = filters.orderId;
  } else if (filters.orderSearch) {
    conditions.push("o.order_number LIKE :orderSearch");
    params.orderSearch = likePrefix(filters.orderSearch);
  }

  if (filters.invoiceSearch) {
    conditions.push(`${invoiceColumn} LIKE :invoiceSearch`);
    params.invoiceSearch = likePrefix(filters.invoiceSearch);
  }

  if (filters.dateFrom) {
    conditions.push(`${alias}.payment_date >= :dateFrom`);
    params.dateFrom = filters.dateFrom;
  }

  if (filters.dateTo) {
    conditions.push(`${alias}.payment_date <= :dateTo`);
    params.dateTo = filters.dateTo;
  }
}

function appendManualArmKeyset(conditions, params, alias, sourceType, cursor) {
  if (!cursor) return;

  params.cursorSortDate = cursor.sortDate;
  params.cursorSourceId = cursor.sourceId;

  if (sourceType === "regular") {
    if (cursor.sourceType === "xray") {
      // All regular rows on/after the cursor date were already consumed.
      conditions.push(`${alias}.payment_date < :cursorSortDate`);
      return;
    }

    conditions.push(`(
      ${alias}.payment_date < :cursorSortDate
      OR (
        ${alias}.payment_date = :cursorSortDate
        AND ${alias}.id < :cursorSourceId
      )
    )`);
    return;
  }

  // xray arm
  if (cursor.sourceType === "regular") {
    conditions.push(`${alias}.payment_date <= :cursorSortDate`);
    return;
  }

  conditions.push(`(
    ${alias}.payment_date < :cursorSortDate
    OR (
      ${alias}.payment_date = :cursorSortDate
      AND ${alias}.id < :cursorSourceId
    )
  )`);
}

function toDateKey(value) {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return toDateKey(parsed);
  }

  return null;
}

function parseManualPaymentCursor(cursor) {
  if (!cursor) return null;

  try {
    const decoded = Buffer.from(String(cursor), "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    const sortDate = toDateKey(parsed?.sortDate);
    const sourceType = parsed?.sourceType === "xray" ? "xray" : "regular";
    const sourceId = Number(parsed?.sourceId);

    if (!sortDate || !Number.isFinite(sourceId) || sourceId <= 0) {
      return null;
    }

    return { sortDate, sourceType, sourceId };
  } catch {
    return null;
  }
}

function encodeManualPaymentCursor(row) {
  const sortDate = toDateKey(row?.payment_date);
  if (!sortDate || !row?.source_id) return null;

  return Buffer.from(
    JSON.stringify({
      sortDate,
      sourceType: row.payment_type === "xray" ? "xray" : "regular",
      sourceId: Number(row.source_id),
    })
  ).toString("base64url");
}

function compareManualPaymentRows(a, b) {
  const dateA = toDateKey(a.payment_date) || "";
  const dateB = toDateKey(b.payment_date) || "";
  if (dateA !== dateB) return dateB.localeCompare(dateA);

  const typeA = a.payment_type === "xray" ? "xray" : "regular";
  const typeB = b.payment_type === "xray" ? "xray" : "regular";
  if (typeA !== typeB) return typeA.localeCompare(typeB);

  return Number(b.source_id) - Number(a.source_id);
}

async function getManualPaymentsSummary(filters) {
  const pool = getPool();
  const standardConditions = ["i.payment_method = 'manual'", "i.payment_date IS NOT NULL"];
  const standardParams = {};
  appendManualFilterConditions(
    standardConditions,
    standardParams,
    "i",
    filters,
    "i.invoice_number"
  );

  const xrayConditions = ["x.payment_method = 'manual'", "x.payment_date IS NOT NULL"];
  const xrayParams = {};
  appendManualFilterConditions(
    xrayConditions,
    xrayParams,
    "x",
    filters,
    "x.invoice_number"
  );

  const [[standardAgg], [xrayAgg]] = await Promise.all([
    pool.execute(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(i.amount_paid), 0) AS total
       FROM invoices i
       INNER JOIN orders o ON o.id = i.order_id
       WHERE ${standardConditions.join(" AND ")}`,
      standardParams
    ),
    pool.execute(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(x.amount_paid), 0) AS total
       FROM invoice_xray_details x
       INNER JOIN orders o ON o.id = x.order_id
       WHERE ${xrayConditions.join(" AND ")}`,
      xrayParams
    ),
  ]);

  const totalPayments =
    Number(standardAgg[0]?.cnt || 0) + Number(xrayAgg[0]?.cnt || 0);
  const totalAmount =
    toNumber(standardAgg[0]?.total) + toNumber(xrayAgg[0]?.total);

  return {
    totalPayments,
    totalAmount: formatMoney(totalAmount),
    checkCount: totalPayments,
    wireCount: 0,
    pendingCount: 0,
  };
}

async function fetchManualPaymentArm({
  sourceType,
  filters,
  cursor,
  limit,
}) {
  const pool = getPool();
  const isXray = sourceType === "xray";
  const alias = isXray ? "x" : "i";
  const table = isXray ? "invoice_xray_details x" : "invoices i";
  const recordedBy = isXray ? "x.payment_recorded_by" : "i.payment_recorded_by";
  const invoiceNumber = isXray ? "x.invoice_number" : "i.invoice_number";
  const invoiceRef = isXray ? "CAST(o.id AS CHAR)" : "CAST(i.id AS CHAR)";
  const amountCol = isXray ? "x.amount_paid" : "i.amount_paid";

  const conditions = [
    `${alias}.payment_method = 'manual'`,
    `${alias}.payment_date IS NOT NULL`,
  ];
  const params = {};
  appendManualFilterConditions(
    conditions,
    params,
    alias,
    filters,
    invoiceNumber
  );
  appendManualArmKeyset(conditions, params, alias, sourceType, cursor);

  const [rows] = await pool.execute(
    `SELECT
       CONCAT('manual-${isXray ? "xray" : "inv"}-', ${alias}.id) AS id,
       ${alias}.id AS source_id,
       o.id AS order_id,
       o.order_number,
       o.case_number,
       COALESCE(p.company_name, o.serve_company_name, f.facility_name, '—') AS company_name,
       TRIM(CONCAT_WS(' ', o.applicant_first_name, o.applicant_middle_name, o.applicant_last_name)) AS applicant_name,
       ${invoiceNumber} AS invoice_number,
       ${invoiceRef} AS invoice_ref,
       '${sourceType}' AS payment_type,
       ${amountCol} AS amount,
       ${alias}.payment_date,
       ${alias}.payment_check_number,
       ${alias}.payment_recorded_at,
       ${alias}.notes,
       e.name AS recorded_by_name
     FROM ${table}
     INNER JOIN orders o ON o.id = ${alias}.order_id
     LEFT JOIN facilities f ON f.id = o.facility_id
     LEFT JOIN providers p ON p.id = o.provider_id
     LEFT JOIN matrix_employees e ON e.id = ${recordedBy}
     WHERE ${conditions.join(" AND ")}
     ORDER BY ${alias}.payment_date DESC, ${alias}.id DESC
     LIMIT ${Math.max(1, Number(limit) || 11)}`,
    params
  );

  return rows;
}

async function getManualPaymentsKeyset(query = {}) {
  const { parsePaymentPageSize } = require("../validators/queryValidators");
  const pageSize = parsePaymentPageSize(query);
  const filters = resolveManualListFilters(query);
  const cursor = parseManualPaymentCursor(query.cursor);
  const includeSummary = wantsPaymentSummary(query);
  const armLimit = pageSize + 1;

  const [standardRows, xrayRows, summary] = await Promise.all([
    fetchManualPaymentArm({
      sourceType: "regular",
      filters,
      cursor,
      limit: armLimit,
    }),
    fetchManualPaymentArm({
      sourceType: "xray",
      filters,
      cursor,
      limit: armLimit,
    }),
    includeSummary ? getManualPaymentsSummary(filters) : Promise.resolve(null),
  ]);

  const merged = [...standardRows, ...xrayRows]
    .sort(compareManualPaymentRows)
    .slice(0, armLimit);

  const hasMore = merged.length > pageSize;
  const pageRows = hasMore ? merged.slice(0, pageSize) : merged;
  const payments = pageRows.map(mapManualPaymentRow);

  return {
    payments,
    summary,
    pagination: {
      type: "keyset",
      pageSize,
      hasMore,
      nextCursor: hasMore
        ? encodeManualPaymentCursor(pageRows[pageRows.length - 1])
        : null,
    },
  };
}

async function getManualPayments(query = {}) {
  const { wantsPaymentKeyset } = require("../validators/queryValidators");

  if (wantsPaymentKeyset(query)) {
    return getManualPaymentsKeyset(query);
  }

  const pool = getPool();
  const limit = parsePaymentListLimit(query);
  const filters = resolveManualListFilters(query);

  const conditions = ["i.payment_method = 'manual'"];
  const params = {};
  appendManualFilterConditions(
    conditions,
    params,
    "i",
    filters,
    "i.invoice_number"
  );

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
     WHERE ${conditions.join(" AND ")}`,
    params
  );

  const xrayConditions = ["x.payment_method = 'manual'"];
  const xrayParams = {};
  appendManualFilterConditions(
    xrayConditions,
    xrayParams,
    "x",
    filters,
    "x.invoice_number"
  );

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
     WHERE ${xrayConditions.join(" AND ")}`,
    xrayParams
  );

  return [...standardRows, ...xrayRows]
    .map(mapManualPaymentRow)
    .sort((a, b) =>
      String(b.paymentDate || "").localeCompare(String(a.paymentDate || ""))
    )
    .slice(0, limit);
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
