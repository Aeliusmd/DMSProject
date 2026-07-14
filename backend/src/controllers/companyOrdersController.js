const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const CompanyPortalOrder = require("../models/CompanyPortalOrder");
const companyPortalInternalSyncService = require("../services/companyPortalInternalSyncService");
const orderService = require("../services/orderService");

exports.getStats = asyncHandler(async (req, res) => {
  const stats = await CompanyPortalOrder.getGlobalStageStats();
  return ApiResponse.success(res, stats);
});

exports.listOrders = asyncHandler(async (req, res) => {
  const result = await orderService.getAllOrders({
    ...req.query,
    creationSource: "company_portal",
  });
  return ApiResponse.success(res, result);
});

exports.updateStage = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    throw new ApiError(400, "Invalid order id");
  }

  const status = String(req.body?.status || "").trim();
  const updated = await companyPortalInternalSyncService.updateCompanyPortalStage(
    orderId,
    status
  );

  return ApiResponse.success(
    res,
    {
      companyPortalOrderId: updated.id,
      companyPortalStatus: updated.status,
      internalOrderId: updated.internal_order_id,
    },
    "Company portal stage updated"
  );
});

exports.emailRecords = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    throw new ApiError(400, "Invalid order id");
  }

  const result = await companyPortalInternalSyncService.emailCompanyPortalRecords(
    orderId,
    {
      emails: req.body?.emails,
      email: req.body?.email,
      additionalEmails: req.body?.additionalEmails,
    }
  );

  return ApiResponse.success(res, result, "Records emailed with download link");
});

exports.syncOrder = asyncHandler(async (req, res) => {
  const portalOrderId = Number(req.params.portalOrderId);
  if (!Number.isFinite(portalOrderId) || portalOrderId <= 0) {
    throw new ApiError(400, "Invalid portal order id");
  }

  const synced =
    await companyPortalInternalSyncService.syncPortalOrderById(portalOrderId);

  return ApiResponse.success(res, {
    portalOrderId: synced.portalOrder.id,
    internalOrderId: synced.internalOrderId,
    created: synced.created,
  });
});
