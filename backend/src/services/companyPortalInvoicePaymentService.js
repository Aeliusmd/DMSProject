const config = require("../config");
const ApiError = require("../utils/ApiError");
const { getPool } = require("../config/database");
const CompanyPortalOrder = require("../models/CompanyPortalOrder");
const Order = require("../models/Order");
const companyPortalWalletService = require("./companyPortalWalletService");
const stripePaymentService = require("./stripePaymentService");
const companyPortalOrderService = require("./companyPortalOrderService");
const {
  maybeAdvanceCompanyPortalAfterInvoicesPaid,
} = require("./companyPortalStageHooks");

function normalizeInvoiceType(value) {
  return `${value || ""}`.trim().toLowerCase() === "xray" ? "xray" : "regular";
}

function normalizePaymentMethod(value) {
  return `${value || ""}`.trim().toLowerCase() === "stripe" ? "stripe" : "wallet";
}

async function resolvePortalOrder(orderNumber, companyUserId, { employeeId = null } = {}) {
  const cleaned = String(orderNumber || "").trim().toUpperCase();
  if (!cleaned) {
    throw new ApiError(400, "Order number is required");
  }

  const order = await CompanyPortalOrder.findByOrderNumberForUser(
    cleaned,
    companyUserId,
    { employeeId }
  );

  if (!order) {
    throw new ApiError(404, "No order found with that order number");
  }

  if (!order.internal_order_id) {
    throw new ApiError(
      400,
      "This order is not ready for invoice payment yet. Please check back later."
    );
  }

  return order;
}

async function payInvoiceWithWallet({
  companyUserId,
  employeeId = null,
  orderNumber,
  invoiceType,
}) {
  const portalOrder = await resolvePortalOrder(orderNumber, companyUserId, {
    employeeId,
  });
  const internalOrderId = Number(portalOrder.internal_order_id);
  const normalizedType = normalizeInvoiceType(invoiceType);

  const payable = await stripePaymentService.assertInvoicePayable(
    internalOrderId,
    normalizedType
  );

  await companyPortalWalletService.assertSufficientBalance(
    companyUserId,
    employeeId,
    payable.amountDue
  );

  const pool = getPool();
  const connection = await pool.getConnection();
  let walletTxId = null;

  try {
    await connection.beginTransaction();

    const payableFresh = await stripePaymentService.assertInvoicePayable(
      internalOrderId,
      normalizedType
    );

    const debitResult = await companyPortalWalletService.debitForOrder(
      {
        companyUserId,
        employeeId,
        amount: payableFresh.amountDue,
        orderId: portalOrder.id,
        description: `${payableFresh.description} payment`,
      },
      connection
    );

    walletTxId = debitResult.transactionId;

    await stripePaymentService.fulfillInvoicePayment(
      connection,
      internalOrderId,
      normalizedType
    );

    await stripePaymentService.recordCompanyPortalWalletInvoicePayment(
      connection,
      {
        orderId: internalOrderId,
        invoiceType: normalizedType,
        invoiceNumber: payableFresh.invoiceNumber,
        amount: payableFresh.amountDue,
        walletTxId,
        customerEmail: portalOrder.contact_email,
        customerName: portalOrder.company_name,
      }
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await Order.syncOrderStatusFromWorkflow(internalOrderId);

  try {
    await maybeAdvanceCompanyPortalAfterInvoicesPaid(internalOrderId);
  } catch (error) {
    console.warn(
      "[company-portal] Invoice paid-stage advance skipped:",
      error.message || error
    );
  }

  return companyPortalOrderService.trackOrderByNumber(orderNumber, companyUserId, {
    employeeId,
  });
}

async function startInvoiceStripeCheckout({
  companyUserId,
  employeeId = null,
  orderNumber,
  invoiceType,
}) {
  const portalOrder = await resolvePortalOrder(orderNumber, companyUserId, {
    employeeId,
  });
  const normalizedType = normalizeInvoiceType(invoiceType);
  const internalOrderId = Number(portalOrder.internal_order_id);

  await stripePaymentService.assertInvoicePayable(internalOrderId, normalizedType);

  const token = await stripePaymentService.ensurePaymentAccessToken(internalOrderId);
  const baseClient = (config.clientUrl || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  const encodedOrderNumber = encodeURIComponent(portalOrder.order_number);

  const checkout = await stripePaymentService.createCheckoutSession(
    token,
    normalizedType,
    {
      successUrl: `${baseClient}/company-portal/orders/track/${encodedOrderNumber}?invoicePaid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseClient}/company-portal/orders/track/${encodedOrderNumber}?canceled=1`,
    }
  );

  return {
    paymentMethod: "stripe",
    checkoutUrl: checkout.checkoutUrl,
    sessionId: checkout.sessionId,
  };
}

async function confirmInvoiceStripePayment({
  companyUserId,
  employeeId = null,
  orderNumber,
  sessionId,
}) {
  if (employeeId) {
    throw new ApiError(
      403,
      "Company employees cannot confirm online card payments. Use wallet payment only."
    );
  }

  if (!sessionId) {
    throw new ApiError(400, "session_id is required");
  }

  const portalOrder = await resolvePortalOrder(orderNumber, companyUserId, {
    employeeId,
  });
  const internalOrderId = Number(portalOrder.internal_order_id);

  const Stripe = require("stripe");
  const stripe = new Stripe(config.stripe.secretKey);
  let session;

  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (error) {
    throw new ApiError(404, "Payment session not found");
  }

  if (Number(session.metadata?.order_id) !== internalOrderId) {
    throw new ApiError(403, "Payment session does not match this order");
  }

  if (session.payment_status === "paid") {
    await stripePaymentService.fulfillSuccessfulCheckoutSession(session);
  } else {
    throw new ApiError(400, "Payment has not been completed yet");
  }

  return companyPortalOrderService.trackOrderByNumber(orderNumber, companyUserId, {
    employeeId,
  });
}

async function payInvoice({
  companyUserId,
  employeeId = null,
  orderNumber,
  invoiceType,
  paymentMethod,
}) {
  const method = normalizePaymentMethod(paymentMethod);

  if (method === "stripe") {
    if (employeeId) {
      throw new ApiError(
        403,
        "Company employees can only pay invoices from their wallet. Online card payment is available to company administrators only."
      );
    }

    return startInvoiceStripeCheckout({
      companyUserId,
      employeeId,
      orderNumber,
      invoiceType,
    });
  }

  const order = await payInvoiceWithWallet({
    companyUserId,
    employeeId,
    orderNumber,
    invoiceType,
  });

  return {
    paymentMethod: "wallet",
    order,
  };
}

module.exports = {
  payInvoice,
  payInvoiceWithWallet,
  startInvoiceStripeCheckout,
  confirmInvoiceStripePayment,
};
