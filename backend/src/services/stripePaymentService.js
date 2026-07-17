/**
 * Stripe online invoice payments — public pay links, Checkout, webhooks.
 */

const crypto = require("crypto");
const Stripe = require("stripe");

const config = require("../config");
const ApiError = require("../utils/ApiError");
const { rethrowServiceError, runNonCritical } = require("../utils/serviceErrorUtils");
const { getPool } = require("../config/database");
const Order = require("../models/Order");
const Invoice = require("../models/Invoice");
const InvoiceXray = require("../models/InvoiceXray");
const logger = require("../utils/logger");
const {
  parseOptionalIsoDate,
  assertPositiveInt,
  likePrefix,
} = require("../utils/sqlSafety");

let stripeClient = null;

function getStripe() {
  if (!stripeClient) {
    const secretKey = config.stripe?.secretKey;
    if (!secretKey) {
      throw new ApiError(500, "Stripe is not configured");
    }
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
}

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = `${value}`.trim();
  return trimmed === "" ? null : trimmed;
}

function formatMoney(value) {
  return `$${toNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

function mapPublicInvoiceItem(type, row, order) {
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
      amountDueDisplay: formatMoney(amountDue),
      amountDisplay: formatMoney(total),
      status: isPaid ? "Paid" : row.status || "Unpaid",
      isPaid,
      paymentMethod: row.payment_method || null,
    };
  }

  const total = toNumber(row.payment);
  const amountPaid = toNumber(row.amount_paid);
  const writeoff = toNumber(row.writeoff_amount);
  const amountDue = Math.max(0, total - amountPaid - writeoff);
  const isPaid = amountDue <= 0 && total > 0;
  const isWrittenOff = row.status === "Written Off";

  return {
    type: "xray",
    label: "X-Ray Invoice",
    invoiceNumber: buildXrayInvoiceNumber(order, row),
    amount: total,
    amountDue,
    amountDueDisplay: formatMoney(amountDue),
    amountDisplay: formatMoney(total),
    status: isWrittenOff ? "Written Off" : isPaid ? "Paid" : row.status || "Unpaid",
    isPaid,
    paymentMethod: row.payment_method || null,
  };
}

function buildPaymentUrl(token) {
  const base = (config.clientUrl || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/pay/${token}`;
}

async function resolveTokenRow(token) {
  const trimmed = trimOrNull(token);
  if (!trimmed) {
    throw new ApiError(400, "Invalid payment link");
  }

  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, token, order_id, expires_at
     FROM invoice_payment_access_tokens
     WHERE token = :token
     LIMIT 1`,
    { token: trimmed }
  );

  const row = rows[0];
  if (!row) {
    throw new ApiError(404, "Payment link is invalid or expired");
  }

  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    throw new ApiError(410, "Payment link has expired");
  }

  return row;
}

async function ensurePaymentAccessToken(orderId) {
  const pool = getPool();
  const [existing] = await pool.execute(
    `SELECT token FROM invoice_payment_access_tokens WHERE order_id = :orderId LIMIT 1`,
    { orderId }
  );

  if (existing[0]?.token) {
    return existing[0].token;
  }

  const token = crypto.randomBytes(32).toString("hex");
  await pool.execute(
    `INSERT INTO invoice_payment_access_tokens (token, order_id) VALUES (:token, :orderId)`,
    { token, orderId }
  );

  return token;
}

async function orderHasUnpaidInvoices(orderId) {
  const [invoice, xray] = await Promise.all([
    Invoice.findByOrderId(orderId),
    InvoiceXray.findByOrderId(orderId),
  ]);

  if (invoice && hasStandardInvoiceFields(invoice)) {
    const due = toNumber(invoice.amount_due);
    if (invoice.status !== "Paid" && due > 0) return true;
  }

  if (xray && hasXrayInvoiceFields(xray)) {
    const total = toNumber(xray.payment);
    const paid = toNumber(xray.amount_paid);
    const writeoff = toNumber(xray.writeoff_amount);
    const due = Math.max(0, total - paid - writeoff);
    if (xray.status !== "Written Off" && due > 0) return true;
  }

  return false;
}

async function getPaymentUrlForOrder(orderId) {
  const hasUnpaid = await orderHasUnpaidInvoices(orderId);
  if (!hasUnpaid) return null;

  const token = await ensurePaymentAccessToken(orderId);
  return buildPaymentUrl(token);
}

async function getPaymentPageData(token) {
  const tokenRow = await resolveTokenRow(token);
  const order = await Order.findById(tokenRow.order_id);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  const [invoice, xray] = await Promise.all([
    Invoice.findByOrderId(order.id),
    InvoiceXray.findByOrderId(order.id),
  ]);

  const invoices = [];
  if (invoice && hasStandardInvoiceFields(invoice)) {
    invoices.push(mapPublicInvoiceItem("regular", invoice, order));
  }
  if (xray && hasXrayInvoiceFields(xray)) {
    invoices.push(mapPublicInvoiceItem("xray", xray, order));
  }

  if (!invoices.length) {
    throw new ApiError(404, "No invoices found for this order");
  }

  const unpaidCount = invoices.filter((item) => !item.isPaid).length;

  return {
    token,
    order: {
      id: order.id,
      orderNumber: order.order_number,
      applicant: buildApplicantName(order) || "—",
      company: getCompanyName(order),
      caseNo: order.case_number || "",
    },
    invoices,
    unpaidCount,
    stripePublishableKey: config.stripe.publishableKey || "",
  };
}

async function assertInvoicePayable(orderId, invoiceType) {
  const order = await Order.findById(orderId);
  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  if (invoiceType === "regular") {
    const invoice = await Invoice.findByOrderId(orderId);
    if (!invoice || !hasStandardInvoiceFields(invoice)) {
      throw new ApiError(404, "Regular invoice not found");
    }

    const due = toNumber(invoice.amount_due);
    if (invoice.status === "Paid" || due <= 0) {
      throw new ApiError(400, "This invoice is already paid");
    }

    return {
      order,
      invoiceType: "regular",
      invoiceNumber: invoice.invoice_number || buildStandardInvoiceNumber(order),
      amountDue: due,
      description: `Regular Invoice ${invoice.invoice_number || buildStandardInvoiceNumber(order)}`,
    };
  }

  if (invoiceType === "xray") {
    const xray = await InvoiceXray.findByOrderId(orderId);
    if (!xray || !hasXrayInvoiceFields(xray)) {
      throw new ApiError(404, "X-Ray invoice not found");
    }

    if (xray.status === "Written Off") {
      throw new ApiError(400, "This X-Ray invoice is written off");
    }

    const total = toNumber(xray.payment);
    const paid = toNumber(xray.amount_paid);
    const writeoff = toNumber(xray.writeoff_amount);
    const due = Math.max(0, total - paid - writeoff);

    if (due <= 0) {
      throw new ApiError(400, "This X-Ray invoice is already paid");
    }

    return {
      order,
      invoiceType: "xray",
      invoiceNumber: buildXrayInvoiceNumber(order, xray),
      amountDue: due,
      description: `X-Ray Invoice ${buildXrayInvoiceNumber(order, xray)}`,
    };
  }

  throw new ApiError(400, "invoiceType must be regular or xray");
}

async function deleteAbandonedPendingPayments(orderId, invoiceType) {
  const pool = getPool();
  await pool.execute(
    `DELETE FROM stripe_online_payments
     WHERE order_id = :orderId
       AND invoice_type = :invoiceType
       AND status IN ('pending', 'expired')`,
    { orderId, invoiceType }
  );
}

async function createCheckoutSession(token, invoiceType, urlOptions = {}) {
  const tokenRow = await resolveTokenRow(token);
  const payable = await assertInvoicePayable(tokenRow.order_id, invoiceType);
  const stripe = getStripe();

  await deleteAbandonedPendingPayments(tokenRow.order_id, payable.invoiceType);

  const amountCents = Math.round(toNumber(payable.amountDue) * 100);

  if (amountCents <= 0) {
    throw new ApiError(400, "Invoice amount must be greater than zero");
  }

  const baseClient = (config.clientUrl || "http://localhost:3000").replace(/\/$/, "");
  const successUrl =
    urlOptions.successUrl ||
    `${baseClient}/pay/${token}/result?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    urlOptions.cancelUrl || `${baseClient}/pay/${token}?canceled=1`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: config.stripe.currency || "usd",
          product_data: {
            name: payable.description,
            description: `Order ${payable.order.order_number || payable.order.id}`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    customer_email: trimOrNull(payable.order.provider_email) || undefined,
    metadata: {
      order_id: String(tokenRow.order_id),
      invoice_type: payable.invoiceType,
      invoice_number: payable.invoiceNumber,
      amount: String(payable.amountDue),
      access_token: token,
      currency: config.stripe.currency || "usd",
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
  };
}

function mapStripeStatus(status) {
  if (status === "succeeded") return "Succeeded";
  if (status === "pending") return "Pending";
  if (status === "expired") return "Failed";
  return "Failed";
}

function mapOnlinePaymentRow(row) {
  const intentId = String(row.stripe_payment_intent_id || "");
  const isWalletOrderFeePrepayment =
    row.payment_method_type === "wallet" && intentId.startsWith("wallet_tx_");

  const paymentType =
    isWalletOrderFeePrepayment
      ? "prepayment"
      : row.invoice_type === "xray"
        ? "xray"
        : row.invoice_type === "personal_portal"
          ? "personal_portal"
          : "regular";
  const paymentTypeLabel =
    paymentType === "xray"
      ? "X-Ray"
      : paymentType === "personal_portal"
        ? "Personal"
        : paymentType === "prepayment"
          ? "Prepayment"
          : "Regular";
  const uiStatus = mapStripeStatus(row.status);

  return {
    id: `online-${row.id}`,
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
    amountDisplay: formatMoney(row.amount),
    transactionDate: row.paid_at || row.created_at,
    paymentDate: row.paid_at || row.created_at,
    status: uiStatus,
    method:
      row.payment_method_type === "card"
        ? "Card"
        : row.payment_method_type === "wallet"
          ? "Wallet"
          : row.payment_method_type || "Card",
    channel: "online",
    paymentMethod:
      row.payment_method_type === "card"
        ? "Card"
        : row.payment_method_type === "wallet"
          ? "Wallet"
          : row.payment_method_type || "Card",
    customerName: row.customer_name || "",
    customerEmail: row.customer_email || "",
    stripePaymentId: row.stripe_payment_intent_id || "",
    stripeChargeId: row.stripe_charge_id || "",
    stripeCustomerId: row.stripe_customer_id || "",
    cardBrand: row.card_brand || null,
    cardLast4: row.card_last4 || null,
    currency: row.currency || "usd",
    processingFee: toNumber(row.processing_fee),
    processingFeeDisplay: formatMoney(row.processing_fee),
    netAmount: toNumber(row.net_amount),
    netAmountDisplay: formatMoney(row.net_amount),
    failureMessage: row.failure_message || "",
    receiptUrl: row.receipt_url || "",
    walletReceiptOrderId:
      row.payment_method_type === "wallet" ? row.order_id : null,
    notes: "",
  };
}

function wantsPaymentSummary(query = {}) {
  const raw = String(query.includeSummary ?? "1").trim().toLowerCase();
  return !(raw === "0" || raw === "false" || raw === "no");
}

async function getOnlinePayments(query = {}) {
  // Heal missing company-portal wallet invoice rows (skipped previously when
  // $15 prepayment blocked invoice inserts).
  try {
    await backfillMissingWalletInvoiceOnlinePayments({ limit: 50 });
  } catch (error) {
    console.warn(
      "[company-portal] wallet invoice payment backfill skipped:",
      error.message || error
    );
  }

  const pool = getPool();
  const {
    parsePaymentListLimit,
    parsePaymentPageSize,
    wantsPaymentKeyset,
  } = require("../validators/queryValidators");

  const useKeyset = wantsPaymentKeyset(query);
  const pageSize = useKeyset ? parsePaymentPageSize(query) : null;
  const limit = useKeyset ? pageSize + 1 : parsePaymentListLimit(query);
  const includeSummary = useKeyset ? wantsPaymentSummary(query) : false;

  const conditions = ["s.status = 'succeeded'"];
  const params = {};

  let orderIdFilter = null;
  if (query.orderId && Number.isFinite(Number(query.orderId)) && Number(query.orderId) > 0) {
    orderIdFilter = assertPositiveInt(query.orderId, "orderId");
  }

  const orderSearch =
    String(query.orderSearch || "").trim() ||
    (query.orderId && !orderIdFilter ? String(query.orderId).trim() : "");

  if (orderSearch) {
    if (/^\d+$/.test(orderSearch)) {
      if (!orderIdFilter) {
        orderIdFilter = assertPositiveInt(orderSearch, "orderSearch");
      }
      conditions.push("(o.id = :orderId OR o.order_number LIKE :orderSearch)");
      params.orderId = orderIdFilter;
      params.orderSearch = likePrefix(orderSearch);
    } else {
      conditions.push("o.order_number LIKE :orderSearch");
      params.orderSearch = likePrefix(orderSearch);
      if (orderIdFilter) {
        // Explicit numeric orderId param plus textual orderSearch → AND both.
        conditions.push("o.id = :orderId");
        params.orderId = orderIdFilter;
      }
    }
  } else if (orderIdFilter) {
    conditions.push("o.id = :orderId");
    params.orderId = orderIdFilter;
  }

  const invoiceSearch = String(query.invoiceSearch || "").trim();
  if (invoiceSearch) {
    if (/^\d+$/.test(invoiceSearch)) {
      conditions.push(
        `(s.id = :invoiceSearchId OR s.invoice_number LIKE :invoiceSearch)`
      );
      params.invoiceSearchId = assertPositiveInt(invoiceSearch, "invoiceSearch");
      params.invoiceSearch = likePrefix(invoiceSearch);
    } else {
      conditions.push("s.invoice_number LIKE :invoiceSearch");
      params.invoiceSearch = likePrefix(invoiceSearch);
    }
  }

  const dateFrom = parseOptionalIsoDate(query.dateFrom, "dateFrom");
  if (dateFrom) {
    conditions.push("s.paid_at >= :dateFrom");
    params.dateFrom = dateFrom;
  }

  const dateTo = parseOptionalIsoDate(query.dateTo, "dateTo");
  if (dateTo) {
    // Inclusive calendar day without DATE() on the column (keeps index usable).
    conditions.push("s.paid_at < DATE_ADD(:dateTo, INTERVAL 1 DAY)");
    params.dateTo = dateTo;
  }

  if (useKeyset && query.cursor) {
    const cursorId = Number(query.cursor);
    if (Number.isFinite(cursorId) && cursorId > 0) {
      conditions.push("s.id < :cursorId");
      params.cursorId = cursorId;
    }
  }

  const whereClause = `WHERE ${conditions.join(" AND ")}`;

  const [rows] = await pool.execute(
    `SELECT
       s.*,
       o.order_number,
       o.case_number,
       COALESCE(p.company_name, o.serve_company_name, f.facility_name, '—') AS company_name,
       TRIM(CONCAT_WS(' ', o.applicant_first_name, o.applicant_middle_name, o.applicant_last_name)) AS applicant_name,
       CAST(s.id AS CHAR) AS invoice_ref
     FROM stripe_online_payments s
     INNER JOIN orders o ON o.id = s.order_id
     LEFT JOIN facilities f ON f.id = o.facility_id
     LEFT JOIN providers p ON p.id = o.provider_id
     ${whereClause}
     ORDER BY s.id DESC
     LIMIT ${limit}`,
    params
  );

  if (!useKeyset) {
    return rows.map(mapOnlinePaymentRow);
  }

  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const payments = pageRows.map(mapOnlinePaymentRow);
  const last = pageRows[pageRows.length - 1];

  let summary = null;
  if (includeSummary) {
    const summaryConditions = conditions.filter((c) => !c.includes(":cursorId"));
    const summaryParams = Object.fromEntries(
      Object.entries(params).filter(([key]) => key !== "cursorId")
    );

    const [aggRows] = await pool.execute(
      `SELECT
         COUNT(*) AS cnt,
         COALESCE(SUM(s.amount), 0) AS total
       FROM stripe_online_payments s
       INNER JOIN orders o ON o.id = s.order_id
       WHERE ${summaryConditions.join(" AND ")}`,
      summaryParams
    );

    const totalTransactions = Number(aggRows[0]?.cnt || 0);
    const totalCollected = toNumber(aggRows[0]?.total);
    summary = {
      totalTransactions,
      totalCollected: formatMoney(totalCollected),
      succeededCount: totalTransactions,
      pendingCount: 0,
      failedCount: 0,
    };
  }

  return {
    payments,
    summary,
    pagination: {
      type: "keyset",
      pageSize,
      hasMore,
      nextCursor: hasMore && last ? String(last.id) : null,
    },
  };
}

async function getOnlinePaymentsForOrder(orderId) {
  return getOnlinePayments({ orderId, limit: 500 });
}

async function extractStripePaymentDetails(session) {
  const stripe = getStripe();
  let paymentIntent = null;
  let charge = null;

  if (session.payment_intent) {
    paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent, {
      expand: ["latest_charge", "payment_method"],
    });
    charge =
      paymentIntent.latest_charge && typeof paymentIntent.latest_charge === "object"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge
          ? await stripe.charges.retrieve(paymentIntent.latest_charge)
          : null;
  }

  const card =
    paymentIntent?.payment_method?.card ||
    charge?.payment_method_details?.card ||
    null;

  return {
    stripePaymentIntentId: paymentIntent?.id || session.payment_intent || null,
    stripeChargeId: charge?.id || null,
    stripeCustomerId: session.customer || paymentIntent?.customer || null,
    paymentMethodType: paymentIntent?.payment_method_types?.[0] || charge?.payment_method_details?.type || "card",
    cardBrand: card?.brand || null,
    cardLast4: card?.last4 || null,
    customerEmail: session.customer_details?.email || charge?.billing_details?.email || null,
    customerName: session.customer_details?.name || charge?.billing_details?.name || null,
    receiptUrl: charge?.receipt_url || null,
    receiptNumber: charge?.receipt_number || null,
    processingFee: charge?.balance_transaction
      ? null
      : null,
    netAmount: charge?.amount ? charge.amount / 100 : null,
    failureMessage: paymentIntent?.last_payment_error?.message || charge?.failure_message || null,
  };
}

async function fetchStripeReceiptNumber(chargeId) {
  const normalized = `${chargeId || ""}`.trim();
  if (!normalized) return null;

  try {
    const stripe = getStripe();
    const charge = await stripe.charges.retrieve(normalized);
    return charge?.receipt_number || null;
  } catch (error) {
    logger.warn("Unable to fetch Stripe receipt number", {
      chargeId: normalized,
      message: error.message,
    });
    return null;
  }
}

async function fulfillInvoicePayment(connection, orderId, invoiceType) {
  if (invoiceType === "regular") {
    const invoice = await Invoice.findByOrderId(orderId, connection);
    if (!invoice) return;

    const total = toNumber(invoice.total_amount);
    if (invoice.status === "Paid" && toNumber(invoice.amount_due) <= 0) {
      return;
    }

    await connection.execute(
      `UPDATE invoices
       SET amount_paid = :amountPaid,
           amount_due = 0,
           status = 'Paid',
           payment_method = 'online',
           payment_date = CURDATE(),
           payment_recorded_at = NOW(),
           updated_at = NOW()
       WHERE id = :id`,
      { id: invoice.id, amountPaid: total }
    );
    return;
  }

  const xray = await InvoiceXray.findByOrderId(orderId, connection);
  if (!xray) return;

  const total = toNumber(xray.payment);
  if (toNumber(xray.amount_paid) >= total) return;

  await connection.execute(
    `UPDATE invoice_xray_details
     SET amount_paid = :amountPaid,
         status = 'Paid',
         payment_method = 'online',
         payment_date = CURDATE(),
         payment_recorded_at = NOW(),
         updated_at = NOW()
     WHERE order_id = :orderId`,
    { orderId, amountPaid: total }
  );
}

async function updatePaymentRecord(connection, paymentRecordId, fields) {
  await connection.execute(
    `UPDATE stripe_online_payments
     SET status = :status,
         stripe_payment_intent_id = :paymentIntentId,
         stripe_charge_id = :chargeId,
         stripe_customer_id = :customerId,
         payment_method_type = :paymentMethodType,
         card_brand = :cardBrand,
         card_last4 = :cardLast4,
         customer_email = :customerEmail,
         customer_name = :customerName,
         receipt_url = :receiptUrl,
         processing_fee = :processingFee,
         net_amount = :netAmount,
         failure_message = :failureMessage,
         paid_at = :paidAt,
         updated_at = NOW()
     WHERE id = :id`,
    {
      id: paymentRecordId,
      status: fields.status,
      paymentIntentId: fields.stripePaymentIntentId,
      chargeId: fields.stripeChargeId,
      customerId: fields.stripeCustomerId,
      paymentMethodType: fields.paymentMethodType,
      cardBrand: fields.cardBrand,
      cardLast4: fields.cardLast4,
      customerEmail: fields.customerEmail,
      customerName: fields.customerName,
      receiptUrl: fields.receiptUrl,
      processingFee: fields.processingFee,
      netAmount: fields.netAmount,
      failureMessage: fields.failureMessage,
      paidAt: fields.paidAt,
    }
  );
}

async function sendPaymentNotificationEmail(paymentRow, outcome) {
  await runNonCritical(
    "Failed to send payment notification email",
    async () => {
      const { sendPaymentResultEmail } = require("./emailService");
      await sendPaymentResultEmail({
        to: paymentRow.customer_email,
        outcome,
        companyName: paymentRow.company_name || "Customer",
        orderNumber: paymentRow.order_number || "",
        invoiceNumber: paymentRow.invoice_number || "",
        amount: formatMoney(paymentRow.amount),
        failureMessage: paymentRow.failure_message || "",
        receiptUrl: paymentRow.receipt_url || "",
      });
    },
    logger
  );
}

async function insertSuccessfulPaymentRecord(connection, session, stripeDetails) {
  const orderId = Number(session.metadata?.order_id);
  const invoiceType = session.metadata?.invoice_type;
  const invoiceNumber = session.metadata?.invoice_number || "";
  const amount = toNumber(session.metadata?.amount);
  const currency = session.metadata?.currency || config.stripe.currency || "usd";

  const [existingRows] = await connection.execute(
    `SELECT id, status
     FROM stripe_online_payments
     WHERE stripe_checkout_session_id = :sessionId
     LIMIT 1`,
    { sessionId: session.id }
  );

  const existing = existingRows[0];
  if (existing?.status === "succeeded") {
    return existing.id;
  }

  if (existing) {
    await updatePaymentRecord(connection, existing.id, {
      status: "succeeded",
      ...stripeDetails,
      paidAt: new Date(),
      failureMessage: null,
    });
    return existing.id;
  }

  const [insertResult] = await connection.execute(
    `INSERT INTO stripe_online_payments
       (order_id, invoice_type, invoice_number, amount, currency, status,
        stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id,
        stripe_customer_id, payment_method_type, card_brand, card_last4,
        customer_email, customer_name, receipt_url, processing_fee, net_amount,
        failure_message, paid_at)
     VALUES
       (:orderId, :invoiceType, :invoiceNumber, :amount, :currency, 'succeeded',
        :sessionId, :paymentIntentId, :chargeId, :customerId, :paymentMethodType,
        :cardBrand, :cardLast4, :customerEmail, :customerName, :receiptUrl,
        :processingFee, :netAmount, NULL, :paidAt)`,
    {
      orderId,
      invoiceType,
      invoiceNumber,
      amount,
      currency,
      sessionId: session.id,
      paymentIntentId: stripeDetails.stripePaymentIntentId,
      chargeId: stripeDetails.stripeChargeId,
      customerId: stripeDetails.stripeCustomerId,
      paymentMethodType: stripeDetails.paymentMethodType,
      cardBrand: stripeDetails.cardBrand,
      cardLast4: stripeDetails.cardLast4,
      customerEmail: stripeDetails.customerEmail,
      customerName: stripeDetails.customerName,
      receiptUrl: stripeDetails.receiptUrl,
      processingFee: stripeDetails.processingFee,
      netAmount: stripeDetails.netAmount,
      paidAt: new Date(),
    }
  );

  return insertResult.insertId;
}

async function fulfillSuccessfulCheckoutSession(session) {
  if (session.metadata?.payment_kind === "personal_portal") {
    const personalPortalService = require("./personalPortalService");
    await personalPortalService.fulfillPersonalPortalPayment(session);
    return;
  }

  if (session.metadata?.payment_kind === "personal_portal_research_fee") {
    const personalPortalService = require("./personalPortalService");
    await personalPortalService.fulfillPersonalPortalResearchFeePayment(session);
    return;
  }

  const orderId = Number(session.metadata?.order_id);
  const invoiceType = session.metadata?.invoice_type;

  if (!orderId || !invoiceType) {
    logger.warn("Stripe session missing metadata", { sessionId: session.id });
    return;
  }

  const pool = getPool();
  const [existingRows] = await pool.execute(
    `SELECT id, status
     FROM stripe_online_payments
     WHERE stripe_checkout_session_id = :sessionId
     LIMIT 1`,
    { sessionId: session.id }
  );

  if (existingRows[0]?.status === "succeeded") {
    return;
  }

  const stripeDetails = await extractStripePaymentDetails(session);
  const connection = await pool.getConnection();

  let paymentRecordId = null;

  try {
    await connection.beginTransaction();
    await fulfillInvoicePayment(connection, orderId, invoiceType);
    paymentRecordId = await insertSuccessfulPaymentRecord(
      connection,
      session,
      stripeDetails
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    rethrowServiceError(error);
  } finally {
    connection.release();
  }

  await Order.syncOrderStatusFromWorkflow(orderId);

 await Order.syncOrderStatusFromWorkflow(orderId);

// Advance the company portal workflow after invoices are paid.
try {
  const {
    maybeAdvanceCompanyPortalAfterInvoicesPaid,
  } = require("./companyPortalStageHooks");

  await maybeAdvanceCompanyPortalAfterInvoicesPaid(orderId);
} catch (error) {
  console.warn(
    "[company-portal] Paid-stage advance skipped:",
    error.message || error
  );
}

// Synchronize the personal portal order status.
try {
  const personalPortalService = require("./personalPortalService");

  await personalPortalService.syncPortalStatusForDmsOrder(orderId);
} catch (error) {
  console.warn(
    "[personal-portal] Status sync after online payment skipped:",
    error.message || error
  );
}

const [updatedRows] = await pool.execute(
  `SELECT s.*, o.order_number,
          COALESCE(
            p.company_name,
            o.serve_company_name,
            f.facility_name,
            '—'
          ) AS company_name
   FROM stripe_online_payments s
   INNER JOIN orders o ON o.id = s.order_id
   LEFT JOIN facilities f ON f.id = o.facility_id
   LEFT JOIN providers p ON p.id = o.provider_id
   WHERE s.id = :id`,
  { id: paymentRecordId }
);
  if (updatedRows[0]?.customer_email) {
    await sendPaymentNotificationEmail(updatedRows[0], "success");
  }
}

async function markPaymentFailed(sessionOrIntent, failureMessage) {
  const sessionId = sessionOrIntent.id?.startsWith("cs_")
    ? sessionOrIntent.id
    : sessionOrIntent.metadata?.checkout_session || null;

  if (!sessionId) {
    return;
  }

  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, status, customer_email
     FROM stripe_online_payments
     WHERE stripe_checkout_session_id = :sessionId
     LIMIT 1`,
    { sessionId }
  );

  const record = rows[0];
  if (!record || record.status === "succeeded") {
    await pool.execute(
      `DELETE FROM stripe_online_payments
       WHERE stripe_checkout_session_id = :sessionId
         AND status IN ('pending', 'expired')`,
      { sessionId }
    );
    return;
  }

  if (record.status === "failed") {
    return;
  }

  await pool.execute(
    `UPDATE stripe_online_payments
     SET status = 'failed',
         failure_message = :failureMessage,
         updated_at = NOW()
     WHERE id = :id`,
    { id: record.id, failureMessage: failureMessage || "Payment failed" }
  );

  if (record.customer_email) {
    const [updatedRows] = await pool.execute(
      `SELECT s.*, o.order_number,
              COALESCE(p.company_name, o.serve_company_name, f.facility_name, '—') AS company_name
       FROM stripe_online_payments s
       INNER JOIN orders o ON o.id = s.order_id
       LEFT JOIN facilities f ON f.id = o.facility_id
       LEFT JOIN providers p ON p.id = o.provider_id
       WHERE s.id = :id`,
      { id: record.id }
    );

    if (updatedRows[0]) {
      await sendPaymentNotificationEmail(
        { ...updatedRows[0], failure_message: failureMessage },
        "failure"
      );
    }
  }
}

async function handleStripeWebhook(rawBody, signature) {
  const webhookSecret = config.stripe.webhookSecret;
  if (!webhookSecret) {
    throw new ApiError(500, "Stripe webhook secret is not configured");
  }

  const stripe = getStripe();
  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    throw new ApiError(400, `Webhook signature verification failed: ${error.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.metadata?.portal === "company") {
        if (session.payment_status === "paid") {
          const companyPortalOrderService = require("./companyPortalOrderService");
          await companyPortalOrderService.fulfillCompanyPortalCheckoutSession(
            session
          );
        }
        break;
      }

      if (session.metadata?.portal === "company_wallet") {
        if (session.payment_status === "paid") {
          const companyPortalWalletService = require("./companyPortalWalletService");
          await companyPortalWalletService.fulfillWalletTopupSession(session);
        }
        break;
      }

      if (session.payment_status === "paid") {
        await fulfillSuccessfulCheckoutSession(session);
      } else {
        await markPaymentFailed(session, "Payment was not completed");
      }
      break;
    }
    case "checkout.session.expired": {
      const pool = getPool();
      await pool.execute(
        `DELETE FROM stripe_online_payments
         WHERE stripe_checkout_session_id = :sessionId
           AND status IN ('pending', 'expired')`,
        { sessionId: event.data.object.id }
      );
      break;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      await markPaymentFailed(intent, intent.last_payment_error?.message || "Payment failed");
      break;
    }
    default:
      break;
  }

  return { received: true };
}

async function getCheckoutResult(token, sessionId) {
  await resolveTokenRow(token);

  if (!trimOrNull(sessionId)) {
    throw new ApiError(400, "session_id is required");
  }

  const pool = getPool();
  const stripe = getStripe();

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    throw new ApiError(404, "Payment session not found");
  }

  const accessToken = session.metadata?.access_token;
  if (accessToken && accessToken !== token) {
    throw new ApiError(404, "Payment session not found");
  }

  if (session.payment_status === "paid") {
    await fulfillSuccessfulCheckoutSession(session);
  }

  async function loadPayment() {
    const [rows] = await pool.execute(
      `SELECT s.*, o.order_number, o.case_number,
              TRIM(CONCAT_WS(' ', o.applicant_first_name, o.applicant_middle_name, o.applicant_last_name)) AS applicant_name,
              COALESCE(p.company_name, o.serve_company_name, f.facility_name, '—') AS company_name
       FROM stripe_online_payments s
       INNER JOIN orders o ON o.id = s.order_id
       LEFT JOIN facilities f ON f.id = o.facility_id
       LEFT JOIN providers p ON p.id = o.provider_id
       WHERE s.stripe_checkout_session_id = :sessionId
         AND s.status = 'succeeded'
       LIMIT 1`,
      { sessionId }
    );
    return rows[0] || null;
  }

  let payment = await loadPayment();
  const pageData = await getPaymentPageData(token);
  const unpaidInvoices = pageData.invoices.filter((item) => !item.isPaid);

  if (payment) {
    return {
      success: true,
      status: "Succeeded",
      amount: toNumber(payment.amount),
      amountDisplay: formatMoney(payment.amount),
      invoiceNumber: payment.invoice_number || "",
      invoiceType: payment.invoice_type,
      invoiceTypeLabel:
        payment.invoice_type === "xray" ? "X-Ray Invoice" : "Regular Invoice",
      orderNumber: payment.order_number || "",
      company: payment.company_name || "",
      applicant: payment.applicant_name || "",
      caseNo: payment.case_number || "",
      customerEmail: payment.customer_email || "",
      failureMessage: "",
      receiptUrl: payment.receipt_url || "",
      paidAt: payment.paid_at || null,
      sessionId: payment.stripe_checkout_session_id,
      paymentId: payment.id,
      token,
      hasAnotherUnpaidInvoice: unpaidInvoices.length > 0,
      unpaidInvoices,
    };
  }

  const invoiceType = session.metadata?.invoice_type || "regular";
  const invoiceNumber = session.metadata?.invoice_number || "";
  const amount = toNumber(session.metadata?.amount);
  const failureMessage =
    session.status === "expired"
      ? "Checkout session expired"
      : "Payment was not completed";

  return {
    success: false,
    status: "Failed",
    amount,
    amountDisplay: formatMoney(amount),
    invoiceNumber,
    invoiceType,
    invoiceTypeLabel: invoiceType === "xray" ? "X-Ray Invoice" : "Regular Invoice",
    orderNumber: pageData.order?.orderNumber || "",
    company: pageData.order?.company || "",
    applicant: pageData.order?.applicant || "",
    caseNo: pageData.order?.caseNo || "",
    customerEmail: session.customer_details?.email || "",
    failureMessage,
    receiptUrl: "",
    paidAt: null,
    sessionId,
    paymentId: null,
    token,
    hasAnotherUnpaidInvoice: false,
    unpaidInvoices,
  };
}

async function generatePaymentReceiptPdf(sessionId, token) {
  await resolveTokenRow(token);

  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT s.*, o.order_number, o.case_number,
            TRIM(CONCAT_WS(' ', o.applicant_first_name, o.applicant_middle_name, o.applicant_last_name)) AS applicant_name,
            COALESCE(p.company_name, o.serve_company_name, f.facility_name, '—') AS company_name
     FROM stripe_online_payments s
     INNER JOIN orders o ON o.id = s.order_id
     LEFT JOIN facilities f ON f.id = o.facility_id
     LEFT JOIN providers p ON p.id = o.provider_id
     WHERE s.stripe_checkout_session_id = :sessionId
       AND s.status = 'succeeded'
     LIMIT 1`,
    { sessionId }
  );

  const payment = rows[0];
  if (!payment) {
    throw new ApiError(404, "Payment receipt not found");
  }

  const { generatePaymentReceiptPdf: buildReceiptPdf } = require("../utils/paymentReceiptPdf");
  return buildReceiptPdf(payment);
}

async function recordPersonalPortalStripePayment(session) {
  const PersonalRequestOrder = require("../models/PersonalRequestOrder");
  const PersonalRequestStripePayment = require("../models/PersonalRequestStripePayment");

  const requestId = Number(session.metadata?.personal_request_id);
  if (!requestId) {
    return;
  }

  const request = await PersonalRequestOrder.findById(requestId);
  if (!request) {
    logger.warn("Personal portal payment record skipped; request missing", {
      requestId,
      sessionId: session.id,
    });
    return;
  }

  const stripeDetails = await extractStripePaymentDetails(session);
  const amount =
    toNumber(session.metadata?.amount) ||
    (session.amount_total != null ? session.amount_total / 100 : 0) ||
    (config.personalPortal?.processingFeeCents || 3500) / 100;
  const currency =
    session.metadata?.currency ||
    session.currency ||
    config.stripe.currency ||
    "usd";
  const paidAt = new Date();
  const customerEmail =
    stripeDetails.customerEmail || request.email || null;
  const customerName =
    stripeDetails.customerName ||
    `${request.first_name || ""} ${request.last_name || ""}`.trim() ||
    null;

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const existing = await PersonalRequestStripePayment.findByCheckoutSessionId(
      session.id,
      connection
    );

    if (existing?.status === "succeeded") {
      await connection.commit();
      return;
    }

    if (existing) {
      await PersonalRequestStripePayment.markSucceeded(connection, existing.id, {
        orderId: request.order_id || null,
        amount,
        currency,
        stripePaymentIntentId: stripeDetails.stripePaymentIntentId,
        stripeChargeId: stripeDetails.stripeChargeId,
        stripeCustomerId: stripeDetails.stripeCustomerId,
        paymentMethodType: stripeDetails.paymentMethodType,
        cardBrand: stripeDetails.cardBrand,
        cardLast4: stripeDetails.cardLast4,
        customerEmail,
        customerName,
        receiptUrl: stripeDetails.receiptUrl,
        processingFee: stripeDetails.processingFee,
        netAmount: stripeDetails.netAmount ?? amount,
        paidAt,
      });
    } else {
      await PersonalRequestStripePayment.insertSucceeded(connection, {
        personalRequestOrderId: requestId,
        orderId: request.order_id || null,
        amount,
        currency,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: stripeDetails.stripePaymentIntentId,
        stripeChargeId: stripeDetails.stripeChargeId,
        stripeCustomerId: stripeDetails.stripeCustomerId,
        paymentMethodType: stripeDetails.paymentMethodType,
        cardBrand: stripeDetails.cardBrand,
        cardLast4: stripeDetails.cardLast4,
        customerEmail,
        customerName,
        receiptUrl: stripeDetails.receiptUrl,
        processingFee: stripeDetails.processingFee,
        netAmount: stripeDetails.netAmount ?? amount,
        paidAt,
      });
    }

    if (request.order_id && stripeDetails.receiptNumber) {
      const orderPayments = await Order.findPaymentsByOrderId(
        request.order_id,
        connection
      );
      const prepayment = orderPayments.find(
        (row) => row.payment_type === "prepayment"
      );
      await Order.upsertPayment(connection, {
        orderId: request.order_id,
        paymentType: "prepayment",
        checkNumber: stripeDetails.receiptNumber,
        paymentDate:
          prepayment?.payment_date ||
          paidAt.toISOString().slice(0, 10),
        amount: prepayment?.amount ?? amount,
        dueAmount: prepayment?.due_amount ?? 0,
        isPaid: prepayment?.is_paid ?? 1,
        memo:
          prepayment?.memo ||
          "Personal portal processing fee ($35 prepayment)",
      });
    }

    // Also mirror into staff online payments list when table + DMS order exist
    if (request.order_id) {
      const [tableRows] = await connection.execute(
        `SELECT COUNT(*) AS cnt
         FROM information_schema.tables
         WHERE table_schema = DATABASE()
           AND table_name = 'stripe_online_payments'`
      );

      if (Number(tableRows[0]?.cnt) > 0) {
        try {
          const [existingOnline] = await connection.execute(
            `SELECT id, status
             FROM stripe_online_payments
             WHERE stripe_checkout_session_id = :sessionId
             LIMIT 1`,
            { sessionId: session.id }
          );

          if (!existingOnline[0]) {
            await connection.execute(
              `INSERT INTO stripe_online_payments
                 (order_id, invoice_type, invoice_number, amount, currency, status,
                  stripe_checkout_session_id, stripe_payment_intent_id, stripe_charge_id,
                  stripe_customer_id, payment_method_type, card_brand, card_last4,
                  customer_email, customer_name, receipt_url, processing_fee, net_amount,
                  failure_message, paid_at)
               VALUES
                 (:orderId, 'personal_portal', :invoiceNumber, :amount, :currency, 'succeeded',
                  :sessionId, :paymentIntentId, :chargeId, :customerId, :paymentMethodType,
                  :cardBrand, :cardLast4, :customerEmail, :customerName, :receiptUrl,
                  :processingFee, :netAmount, NULL, :paidAt)`,
              {
                orderId: request.order_id,
                invoiceNumber: request.confirmation_reference || `PR-${requestId}`,
                amount,
                currency,
                sessionId: session.id,
                paymentIntentId: stripeDetails.stripePaymentIntentId,
                chargeId: stripeDetails.stripeChargeId,
                customerId: stripeDetails.stripeCustomerId,
                paymentMethodType: stripeDetails.paymentMethodType,
                cardBrand: stripeDetails.cardBrand,
                cardLast4: stripeDetails.cardLast4,
                customerEmail,
                customerName,
                receiptUrl: stripeDetails.receiptUrl,
                processingFee: stripeDetails.processingFee,
                netAmount: stripeDetails.netAmount ?? amount,
                paidAt,
              }
            );
          } else if (existingOnline[0].status !== "succeeded") {
            await updatePaymentRecord(connection, existingOnline[0].id, {
              status: "succeeded",
              ...stripeDetails,
              paidAt,
              failureMessage: null,
            });
          }
        } catch (mirrorError) {
          logger.warn("Could not mirror personal portal payment to stripe_online_payments", {
            sessionId: session.id,
            message: mirrorError.message,
          });
        }
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    rethrowServiceError(error);
  } finally {
    connection.release();
  }
}

async function recordCompanyPortalWalletOrderPayment(internalOrderId, portalOrder) {
  const orderId = Number(internalOrderId);
  if (!Number.isFinite(orderId) || orderId <= 0 || !portalOrder) {
    return false;
  }

  if (portalOrder.payment_method !== "wallet" || portalOrder.payment_status !== "paid") {
    return false;
  }

  const CompanyPortalWalletTransaction = require("../models/CompanyPortalWalletTransaction");
  const walletTx = await CompanyPortalWalletTransaction.findOrderPaymentByPortalOrderId(
    portalOrder.id
  );

  if (!walletTx) {
    return false;
  }

  const amount = Number(portalOrder.payment_amount);
  const paidAmount =
    Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(2)) : 15;
  const walletRef = `wallet_tx_${walletTx.id}`;
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `SELECT id FROM orders WHERE id = :orderId FOR UPDATE`,
      { orderId }
    );

    const [existingRows] = await connection.execute(
      `SELECT id
       FROM stripe_online_payments
       WHERE stripe_payment_intent_id = :walletRef
          OR (
            order_id = :orderId
            AND payment_method_type = 'wallet'
            AND status = 'succeeded'
          )
       LIMIT 1`,
      { walletRef, orderId }
    );

    if (existingRows[0]?.id) {
      await connection.commit();
      return false;
    }

    const paidAt = portalOrder.paid_at ? new Date(portalOrder.paid_at) : new Date();

    await connection.execute(
      `INSERT INTO stripe_online_payments
         (order_id, invoice_type, invoice_number, amount, currency, status,
          stripe_payment_intent_id, payment_method_type,
          customer_email, customer_name, paid_at)
       VALUES
         (:orderId, 'regular', :invoiceNumber, :amount, :currency, 'succeeded',
          :walletRef, 'wallet', :customerEmail, :customerName, :paidAt)`,
      {
        orderId,
        invoiceNumber: portalOrder.order_number || `CP-${portalOrder.id}`,
        amount: paidAmount,
        currency: config.stripe.currency || "usd",
        walletRef,
        customerEmail: portalOrder.contact_email || null,
        customerName: portalOrder.company_name || null,
        paidAt,
      }
    );

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function recordCompanyPortalWalletInvoicePayment(
  connection,
  {
    orderId,
    invoiceType,
    invoiceNumber,
    amount,
    walletTxId,
    customerEmail,
    customerName,
  }
) {
  const internalOrderId = Number(orderId);
  if (!Number.isFinite(internalOrderId) || internalOrderId <= 0 || !walletTxId) {
    return false;
  }

  const normalizedType = invoiceType === "xray" ? "xray" : "regular";
  const paidAmount = Number(Number(amount || 0).toFixed(2));
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
    return false;
  }

  // Prefixed separately from order-fee prepayments (`wallet_tx_*`) so a $15
  // portal fee row does not block recording the real invoice wallet payment.
  const walletRef = `wallet_inv_${walletTxId}_${normalizedType}`;

  await connection.execute(
    `SELECT id FROM orders WHERE id = :orderId FOR UPDATE`,
    { orderId: internalOrderId }
  );

  const [existingRows] = await connection.execute(
    `SELECT id
     FROM stripe_online_payments
     WHERE order_id = :orderId
       AND status = 'succeeded'
       AND (
         stripe_payment_intent_id = :walletRef
         OR (
           payment_method_type = 'wallet'
           AND invoice_type = :invoiceType
           AND stripe_payment_intent_id LIKE 'wallet_inv\\_%'
         )
       )
     LIMIT 1`,
    { walletRef, orderId: internalOrderId, invoiceType: normalizedType }
  );

  if (existingRows[0]?.id) {
    return false;
  }

  await connection.execute(
    `INSERT INTO stripe_online_payments
       (order_id, invoice_type, invoice_number, amount, currency, status,
        stripe_payment_intent_id, payment_method_type,
        customer_email, customer_name, paid_at)
     VALUES
       (:orderId, :invoiceType, :invoiceNumber, :amount, :currency, 'succeeded',
        :walletRef, 'wallet', :customerEmail, :customerName, :paidAt)`,
    {
      orderId: internalOrderId,
      invoiceType: normalizedType,
      invoiceNumber: invoiceNumber || "",
      amount: paidAmount,
      currency: config.stripe.currency || "usd",
      walletRef,
      customerEmail: customerEmail || null,
      customerName: customerName || null,
      paidAt: new Date(),
    }
  );

  return true;
}

async function backfillMissingWalletInvoiceOnlinePayments({ limit = 100 } = {}) {
  const CompanyPortalWalletTransaction = require("../models/CompanyPortalWalletTransaction");
  const pool = getPool();
  const missing =
    await CompanyPortalWalletTransaction.listInvoicePaymentsMissingOnlineRecord(
      limit
    );

  let inserted = 0;

  for (const row of missing) {
    const description = String(row.description || "").toLowerCase();
    const invoiceType =
      description.includes("x-ray") || description.includes("xray")
        ? "xray"
        : "regular";
    const invoiceMatch = String(row.description || "").match(
      /Invoice\s+(\S+)/i
    );
    const invoiceNumber =
      invoiceMatch?.[1] || row.order_number || `CP-${row.portal_order_id}`;

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const didInsert = await recordCompanyPortalWalletInvoicePayment(
        connection,
        {
          orderId: row.internal_order_id,
          invoiceType,
          invoiceNumber,
          amount: row.amount,
          walletTxId: row.wallet_tx_id,
          customerEmail: row.contact_email,
          customerName: row.company_name,
        }
      );
      await connection.commit();
      if (didInsert) inserted += 1;
    } catch (error) {
      await connection.rollback();
      console.warn(
        "[company-portal] wallet invoice payment backfill failed:",
        row.wallet_tx_id,
        error.message || error
      );
    } finally {
      connection.release();
    }
  }

  return { checked: missing.length, inserted };
}

module.exports = {
  buildPaymentUrl,
  ensurePaymentAccessToken,
  getPaymentUrlForOrder,
  orderHasUnpaidInvoices,
  getPaymentPageData,
  assertInvoicePayable,
  createCheckoutSession,
  getCheckoutResult,
  generatePaymentReceiptPdf,
  handleStripeWebhook,
  getOnlinePayments,
  getOnlinePaymentsForOrder,
  fulfillSuccessfulCheckoutSession,
  fulfillInvoicePayment,
  extractStripePaymentDetails,
  fetchStripeReceiptNumber,
  recordPersonalPortalStripePayment,
  recordCompanyPortalWalletOrderPayment,
  recordCompanyPortalWalletInvoicePayment,
  backfillMissingWalletInvoiceOnlinePayments,
};
