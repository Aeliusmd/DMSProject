const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const paymentService = require("../services/paymentService");
const activityLogService = require("../services/activityLogService");

function formatCurrency(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "$0.00";

  return `$${num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function logManualPaymentActivity(req, saved = {}, payload = {}) {
  const order = saved.order || {};
  const invoiceType =
    payload.invoiceType === "xray" ? "X-Ray Invoice" : "Regular Invoice";
  const savedInvoice = (saved.invoices || []).find(
    (item) => item.type === payload.invoiceType
  );
  const amount = savedInvoice ? formatCurrency(savedInvoice.amount) : "$0.00";
  const details = activityLogService.appendOrderId(
    `Recorded manual payment for ${invoiceType} ${savedInvoice?.invoiceNumber || ""} on order ${order.orderNumber || order.id || ""} — Check #${payload.checkNumber || "—"}, Date ${payload.paymentDate || "—"}, Amount ${amount}${payload.note ? `, Note: ${payload.note}` : ""}`,
    order.id || null
  );

  await activityLogService.recordFromRequest(req, {
    context: "billing",
    module: activityLogService.MODULES.BILLING,
    action: "record_payment",
    details,
    facilityId: null,
    companyName: order.company || "System",
  });
}

exports.searchOrderInvoices = asyncHandler(async (req, res) => {
  const orderRef = req.query.orderId || req.query.q || "";
  const result = await paymentService.searchOrderInvoices(orderRef);
  return ApiResponse.success(res, result);
});

exports.recordManualPayment = asyncHandler(async (req, res) => {
  const result = await paymentService.recordManualInvoicePayment(
    req.body,
    req.user?.id
  );
  await logManualPaymentActivity(req, result, req.body);
  return ApiResponse.success(res, result, "Manual payment recorded");
});

exports.getManualPayments = asyncHandler(async (req, res) => {
  const payments = await paymentService.getManualPayments(req.query);
  return ApiResponse.success(res, { payments });
});

exports.getOnlinePayments = asyncHandler(async (req, res) => {
  const payments = await paymentService.getOnlinePayments(req.query);
  return ApiResponse.success(res, { payments });
});

exports.getOrderPaymentDetail = asyncHandler(async (req, res) => {
  const detail = await paymentService.getOrderPaymentDetail(req.params.orderId);
  return ApiResponse.success(res, detail);
});
