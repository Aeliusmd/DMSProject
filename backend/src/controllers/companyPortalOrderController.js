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

  const companyPortalWalletService = require("../services/companyPortalWalletService");
  await companyPortalWalletService.assertSufficientOrderBalance(
    req.companyUser.id,
    req.companyUser.employeeId || null
  );

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
  const data = await companyPortalOrderService.getDashboard(req.companyUser.id, {
    employeeId: req.companyUser.employeeId || null,
  });
  return ApiResponse.success(res, data);
});

exports.listOrders = asyncHandler(async (req, res) => {
  const result = await companyPortalOrderService.listOrders(req.companyUser.id, {
    limit: req.query.limit,
    pagination: req.query.pagination,
    cursor: req.query.cursor,
    pageSize: req.query.pageSize,
    employeeId: req.companyUser.employeeId || null,
  });

  if (Array.isArray(result)) {
    return ApiResponse.success(res, { orders: result });
  }

  return ApiResponse.success(res, result);
});

exports.trackOrder = asyncHandler(async (req, res) => {
  const order = await companyPortalOrderService.trackOrderByNumber(
    req.params.orderNumber,
    req.companyUser.id,
    { employeeId: req.companyUser.employeeId || null }
  );
  return ApiResponse.success(res, { order });
});

exports.payInvoice = asyncHandler(async (req, res) => {
  const invoiceType = `${req.body?.invoiceType || ""}`.trim().toLowerCase();
  if (invoiceType !== "regular" && invoiceType !== "xray") {
    throw new ApiError(400, "invoiceType must be regular or xray");
  }

  const paymentMethod = `${req.body?.paymentMethod || "wallet"}`.trim().toLowerCase();
  if (paymentMethod !== "wallet" && paymentMethod !== "stripe") {
    throw new ApiError(400, "paymentMethod must be wallet or stripe");
  }

  const companyPortalInvoicePaymentService = require("../services/companyPortalInvoicePaymentService");
  const result = await companyPortalInvoicePaymentService.payInvoice({
    companyUserId: req.companyUser.id,
    employeeId: req.companyUser.employeeId || null,
    orderNumber: req.params.orderNumber,
    invoiceType,
    paymentMethod,
  });

  const message =
    paymentMethod === "stripe"
      ? "Redirect to complete card payment"
      : "Invoice paid successfully from wallet";

  return ApiResponse.success(res, result, message);
});

exports.confirmInvoicePayment = asyncHandler(async (req, res) => {
  const sessionId =
    req.body?.sessionId || req.body?.session_id || req.query?.session_id || "";

  const companyPortalInvoicePaymentService = require("../services/companyPortalInvoicePaymentService");
  const order = await companyPortalInvoicePaymentService.confirmInvoiceStripePayment(
    {
      companyUserId: req.companyUser.id,
      employeeId: req.companyUser.employeeId || null,
      orderNumber: req.params.orderNumber,
      sessionId,
    }
  );

  return ApiResponse.success(res, { order }, "Invoice payment confirmed");
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
      paymentMethod: "wallet",
      employeeId: req.companyUser.employeeId || null,
      placedByName: req.companyUser.employeeName || null,
    }
  );

  return ApiResponse.success(
    res,
    result,
    "Order placed successfully using wallet balance"
  );
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
  const payload = await companyPortalOrderService.getReleasedDocuments(
    Number(req.params.orderId),
    req.companyUser.id
  );

  if (payload.kind === "records") {
    const {
      sendFileResponse,
      streamArchiveToResponse,
    } = require("../utils/responseUtils");
    const { createZipArchive } = require("../utils/zipArchive");
    const files = payload.files || [];

    if (!files.length) {
      throw new ApiError(404, "Released documents not found");
    }

    if (files.length === 1) {
      const file = files[0];
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(file.filename)}"`
      );
      await sendFileResponse(res, file.path);
      return;
    }

    const safeOrderNumber = `${payload.orderNumber || req.params.orderId}`.replace(
      /[^\w.-]+/g,
      "_"
    );
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeOrderNumber}-records.zip"`
    );

    const archive = createZipArchive();
    files.forEach((file) => {
      archive.file(file.path, { name: file.filename });
    });
    await streamArchiveToResponse(archive, res);
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(payload.fileName)}"`
  );

  const stream = fs.createReadStream(payload.absolutePath);
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
