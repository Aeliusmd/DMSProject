const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const CompanyPortalOrder = require("../models/CompanyPortalOrder");
const Order = require("../models/Order");
const companyPortalInternalSyncService = require("../services/companyPortalInternalSyncService");
const orderService = require("../services/orderService");
const activityLogService = require("../services/activityLogService");

function getInternalOrderLogContext(orderRow = {}) {
  const facilityId = Number(orderRow.facility_id);
  return {
    facilityId: Number.isFinite(facilityId) && facilityId > 0 ? facilityId : null,
    companyName:
      orderRow.facility_name ||
      orderRow.serve_company_name ||
      orderRow.company_name ||
      "System",
    orderNumber: orderRow.order_number || `#${orderRow.id || ""}`,
  };
}

/**
 * Write both the global Activity Log and the per-order Order Log for company
 * portal status / facility actions. Failures are non-blocking.
 */
async function logCompanyOrderActivity(req, internalOrderId, { action, details }) {
  try {
    const order = await Order.findById(internalOrderId);
    if (!order) return;

    const logContext = getInternalOrderLogContext(order);
    const taggedDetails = activityLogService.appendOrderId(details, order.id);

    await activityLogService.recordFromRequest(req, {
      context: "orders",
      action,
      details: taggedDetails,
      facilityId: logContext.facilityId,
      companyName: logContext.companyName,
      targetEmployeeId: req.user?.id,
    });

    await orderService.addOrderActivityLog({
      orderId: order.id,
      actorId: req.user?.id,
      authorName: req.user?.name || null,
      note: details,
    });
  } catch (_error) {
    // Logging must not fail the primary company-order action.
  }
}

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

  const order = await Order.findById(orderId);
  const logContext = getInternalOrderLogContext(order || {});
  await logCompanyOrderActivity(req, orderId, {
    action: "company_portal_stage",
    details: `Company portal stage changed to "${status}" for order ${logContext.orderNumber}`,
  });

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

exports.getNewFacilityRequest = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    throw new ApiError(400, "Invalid order id");
  }

  const { portalOrder, newFacility } =
    await companyPortalInternalSyncService.getNewFacilityContextForInternalOrder(
      orderId
    );

  return ApiResponse.success(res, {
    companyPortalOrderId: portalOrder.id,
    companyPortalStatus: portalOrder.status,
    newFacilityRequest: newFacility
      ? {
          id: newFacility.id,
          status: newFacility.status,
          facilityName: newFacility.facility_name || "",
          facilityAddress: newFacility.facility_address || "",
          facilityCity: newFacility.facility_city || "",
          facilityState: newFacility.facility_state || "",
          facilityZip: newFacility.facility_zip || "",
          treatingDoctor: newFacility.treating_doctor || "",
          searchFeeAmount: Number(newFacility.search_fee_amount) || 0,
          internalFacilityId: newFacility.internal_facility_id || null,
        }
      : null,
  });
});

exports.linkFacility = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    throw new ApiError(400, "Invalid order id");
  }

  const facilityId = Number(req.body?.facilityId);
  const result = await companyPortalInternalSyncService.linkFacilityToPortalOrder(
    orderId,
    facilityId
  );

  const order = await Order.findById(orderId);
  const logContext = getInternalOrderLogContext(order || {});
  await logCompanyOrderActivity(req, orderId, {
    action: "company_portal_link_facility",
    details: `Linked facility to company portal order ${logContext.orderNumber}`,
  });

  return ApiResponse.success(
    res,
    result,
    "Facility linked to company portal order"
  );
});

exports.markNoFacility = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    throw new ApiError(400, "Invalid order id");
  }

  const updated =
    await companyPortalInternalSyncService.markPortalOrderNoFacility(orderId);

  const order = await Order.findById(orderId);
  const logContext = getInternalOrderLogContext(order || {});
  await logCompanyOrderActivity(req, orderId, {
    action: "company_portal_no_facility",
    details: `Changed company portal order ${logContext.orderNumber} status to No facility`,
  });

  return ApiResponse.success(
    res,
    {
      companyPortalOrderId: updated.id,
      companyPortalStatus: updated.status,
      internalOrderId: updated.internal_order_id,
    },
    "Order marked as No facility"
  );
});

exports.restoreInProcess = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    throw new ApiError(400, "Invalid order id");
  }

  const updated =
    await companyPortalInternalSyncService.restorePortalOrderInProcess(orderId);

  const order = await Order.findById(orderId);
  const logContext = getInternalOrderLogContext(order || {});
  await logCompanyOrderActivity(req, orderId, {
    action: "company_portal_restore_in_process",
    details: `Restored company portal order ${logContext.orderNumber} from No facility back to In Process`,
  });

  return ApiResponse.success(
    res,
    {
      companyPortalOrderId: updated.id,
      companyPortalStatus: updated.status,
      internalOrderId: updated.internal_order_id,
    },
    "Order restored to In Process"
  );
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
