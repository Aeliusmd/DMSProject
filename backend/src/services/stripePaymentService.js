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
} = require("../utils/sqlSafety");
const { parsePaymentListLimit } = require("../validators/queryValidators");

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

async function createCheckoutSession(token, invoiceType) {
  const tokenRow = await resolveTokenRow(token);
  const payable = await assertInvoicePayable(tokenRow.order_id, invoiceType);
  const stripe = getStripe();

  await deleteAbandonedPendingPayments(tokenRow.order_id, payable.invoiceType);

  const amountCents = Math.round(toNumber(payable.amountDue) * 100);

  if (amountCents <= 0) {
    throw new ApiError(400, "Invoice amount must be greater than zero");
  }

  const baseClient = (config.clientUrl || "http://localhost:3000").replace(/\/$/, "");
  const successUrl = `${baseClient}/pay/${token}/result?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseClient}/pay/${token}?canceled=1`;

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
  const paymentType = row.invoice_type === "xray" ? "xray" : "regular";
  const paymentTypeLabel = paymentType === "xray" ? "X-Ray" : "Regular";
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
        : row.payment_method_type || "Card",
    channel: "online",
    paymentMethod:
      row.payment_method_type === "card"
        ? "Card"
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
    notes: "",
  };
}

async function getOnlinePayments(query = {}) {
  const pool = getPool();
  const limit = parsePaymentListLimit(query);
  const conditions = ["s.status = 'succeeded'"];
  const params = {};

  if (query.orderId) {
    conditions.push("o.id = :orderId");
    params.orderId = assertPositiveInt(query.orderId, "orderId");
  }

  const dateFrom = parseOptionalIsoDate(query.dateFrom, "dateFrom");
  if (dateFrom) {
    conditions.push("DATE(COALESCE(s.paid_at, s.created_at)) >= :dateFrom");
    params.dateFrom = dateFrom;
  }

  const dateTo = parseOptionalIsoDate(query.dateTo, "dateTo");
  if (dateTo) {
    conditions.push("DATE(COALESCE(s.paid_at, s.created_at)) <= :dateTo");
    params.dateTo = dateTo;
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
     ORDER BY COALESCE(s.paid_at, s.created_at) DESC
     LIMIT ${limit}`,
    params
  );

  return rows.map(mapOnlinePaymentRow);
}

async function getOnlinePaymentsForOrder(orderId) {
  return getOnlinePayments({ orderId });
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
    processingFee: charge?.balance_transaction
      ? null
      : null,
    netAmount: charge?.amount ? charge.amount / 100 : null,
    failureMessage: paymentIntent?.last_payment_error?.message || charge?.failure_message || null,
  };
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

  const [updatedRows] = await pool.execute(
    `SELECT s.*, o.order_number,
            COALESCE(p.company_name, o.serve_company_name, f.facility_name, '—') AS company_name
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

module.exports = {
  buildPaymentUrl,
  ensurePaymentAccessToken,
  getPaymentUrlForOrder,
  orderHasUnpaidInvoices,
  getPaymentPageData,
  createCheckoutSession,
  getCheckoutResult,
  generatePaymentReceiptPdf,
  handleStripeWebhook,
  getOnlinePayments,
  getOnlinePaymentsForOrder,
  fulfillSuccessfulCheckoutSession,
};
