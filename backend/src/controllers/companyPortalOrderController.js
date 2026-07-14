const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const fs = require("fs");
const companyPortalOrderService = require("../services/companyPortalOrderService");
const {
  validateCompanyPortalOrderDetails,
} = require("../validators/companyPortalOrderValidator");
const { sendBufferResponse } = require("../utils/responseUtils");

exports.uploadSubpoena = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Subpoena PDF is required");
  }

  const result = await companyPortalOrderService.uploadAndExtract({
    companyUserId: req.companyUser.id,
    file: req.file,
  });

  return ApiResponse.created(
    res,
    result,
    "Subpoena processed successfully. Complete payment to place the order."
  );
});

exports.getDashboard = asyncHandler(async (req, res) => {
  const data = await companyPortalOrderService.getDashboard(req.companyUser.id);
  return ApiResponse.success(res, data);
});

exports.listOrders = asyncHandler(async (req, res) => {
  const orders = await companyPortalOrderService.listOrders(req.companyUser.id, {
    limit: req.query.limit,
  });
  return ApiResponse.success(res, { orders });
});

exports.trackOrder = asyncHandler(async (req, res) => {
  const order = await companyPortalOrderService.trackOrderByNumber(
    req.params.orderNumber,
    req.companyUser.id
  );
  return ApiResponse.success(res, { order });
});

exports.getOrder = asyncHandler(async (req, res) => {
  const order = await companyPortalOrderService.getOrder(
    Number(req.params.orderId),
    req.companyUser.id
  );
  return ApiResponse.success(res, { order });
});

exports.createCheckout = asyncHandler(async (req, res) => {
  const validation = validateCompanyPortalOrderDetails(req.body || {}, {
    requireFacility: true,
  });

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const uploadToken = req.body?.uploadToken;
  if (!uploadToken) {
    throw new ApiError(400, "Upload token is required");
  }

  const result = await companyPortalOrderService.createCheckout(
    req.companyUser.id,
    {
      uploadToken,
      details: validation.data,
    }
  );

  return ApiResponse.success(res, result, "Checkout session created");
});

exports.confirmPayment = asyncHandler(async (req, res) => {
  const order = await companyPortalOrderService.confirmCheckoutResult(
    req.companyUser.id,
    req.body.sessionId || req.query.session_id
  );

  return ApiResponse.success(res, { order }, "Payment confirmed");
});

exports.getSubpoenaFile = asyncHandler(async (req, res) => {
  const file = await companyPortalOrderService.getSubpoenaFile(
    Number(req.params.orderId),
    req.companyUser.id
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(file.fileName)}"`
  );

  const stream = fs.createReadStream(file.absolutePath);
  stream.pipe(res);
});

exports.downloadReleasedDocuments = asyncHandler(async (req, res) => {
  const file = await companyPortalOrderService.getReleasedDocuments(
    Number(req.params.orderId),
    req.companyUser.id
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(file.fileName)}"`
  );

  const stream = fs.createReadStream(file.absolutePath);
  stream.pipe(res);
});

exports.downloadPaymentReceipt = asyncHandler(async (req, res) => {
  const pdfBuffer = await companyPortalOrderService.generatePaymentReceiptPdf(
    Number(req.params.orderId),
    req.companyUser.id
  );

  const orderId = Number(req.params.orderId);
  sendBufferResponse(res, pdfBuffer, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="payment-receipt-${orderId}.pdf"`,
  });
});
