const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const { throwIfInvalid } = require("../utils/validationUtils");
const { validateStripeCheckout, validateStripeReceiptDownload } = require("../validators/stripeValidator");
const { validateStripeCheckoutResult } = require("../validators/queryValidators");
const stripePaymentService = require("../services/stripePaymentService");
const { sendBufferResponse } = require("../utils/responseUtils");

exports.getPaymentPage = asyncHandler(async (req, res) => {
  const data = await stripePaymentService.getPaymentPageData(req.params.token);
  return ApiResponse.success(res, data);
});

exports.createCheckout = asyncHandler(async (req, res) => {
  throwIfInvalid(validateStripeCheckout(req.body));
  const invoiceType = `${req.body?.invoiceType || ""}`.trim().toLowerCase();
  const result = await stripePaymentService.createCheckoutSession(
    req.params.token,
    invoiceType
  );
  return ApiResponse.success(res, result);
});

exports.getCheckoutResult = asyncHandler(async (req, res) => {
  throwIfInvalid(validateStripeCheckoutResult(req.query));
  const sessionId = req.query.session_id || req.query.sessionId || "";
  const result = await stripePaymentService.getCheckoutResult(
    req.params.token,
    sessionId
  );
  return ApiResponse.success(res, result);
});

exports.downloadReceipt = asyncHandler(async (req, res) => {
  throwIfInvalid(validateStripeReceiptDownload(req.params, req.query));

  const sessionId = req.params.sessionId;
  const token = req.query.token || "";

  const pdfBuffer = await stripePaymentService.generatePaymentReceiptPdf(
    sessionId,
    token
  );

  sendBufferResponse(res, pdfBuffer, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="payment-receipt-${sessionId}.pdf"`,
  });
});
