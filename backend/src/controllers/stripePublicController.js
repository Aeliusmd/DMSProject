const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const stripePaymentService = require("../services/stripePaymentService");

exports.getPaymentPage = asyncHandler(async (req, res) => {
  const data = await stripePaymentService.getPaymentPageData(req.params.token);
  return ApiResponse.success(res, data);
});

exports.createCheckout = asyncHandler(async (req, res) => {
  const invoiceType = `${req.body?.invoiceType || ""}`.trim().toLowerCase();
  const result = await stripePaymentService.createCheckoutSession(
    req.params.token,
    invoiceType
  );
  return ApiResponse.success(res, result);
});

exports.getCheckoutResult = asyncHandler(async (req, res) => {
  const sessionId = req.query.session_id || req.query.sessionId || "";
  const result = await stripePaymentService.getCheckoutResult(
    req.params.token,
    sessionId
  );
  return ApiResponse.success(res, result);
});

exports.downloadReceipt = asyncHandler(async (req, res) => {
  const sessionId = req.params.sessionId;
  const token = req.query.token || "";

  const pdfBuffer = await stripePaymentService.generatePaymentReceiptPdf(
    sessionId,
    token
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="payment-receipt-${sessionId}.pdf"`
  );
  return res.send(pdfBuffer);
});
