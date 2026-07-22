const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const Order = require("../models/Order");
const staffPersonalOrderService = require("../services/staffPersonalOrderService");
const personalPortalService = require("../services/personalPortalService");
const orderService = require("../services/orderService");
const activityLogService = require("../services/activityLogService");

function getInternalOrderLogContext(orderRow = {}) {
  const facilityId = Number(orderRow.facility_id);
  return {
    facilityId: Number.isFinite(facilityId) && facilityId > 0 ? facilityId : null,
    companyName:
      orderRow.facility_name ||
      orderRow.serve_company_name ||
      "Personal Portal",
    orderNumber: orderRow.order_number || `#${orderRow.id || ""}`,
  };
}

async function logPersonalOrderActivity(req, internalOrderId, { action, details }) {
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
    // Logging must not fail the primary action.
  }
}

const getStats = asyncHandler(async (_req, res) => {
  const data = await staffPersonalOrderService.getStaffPersonalOrderStats();
  return ApiResponse.success(res, data, "Personal order stats retrieved");
});

const getNewFacilityRequest = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    throw new ApiError(400, "Invalid order id");
  }

  const { requestOrder, primaryFacility } =
    await personalPortalService.getNewFacilityContextForInternalOrder(orderId);

  return ApiResponse.success(res, {
    personalRequestId: requestOrder.id,
    personalPortalStatus: requestOrder.portal_status,
    newFacilityRequest: primaryFacility
      ? {
          id: requestOrder.id,
          status: Boolean(Number(primaryFacility.is_manual_lookup))
            ? "pending"
            : "linked",
          facilityName: primaryFacility.facility_name || "",
          facilityAddress: primaryFacility.facility_address || "",
          facilityCity: "",
          facilityState: "",
          facilityZip: "",
          treatingDoctor: primaryFacility.treating_doctor || "",
          searchFeeAmount:
            (require("../config").personalPortal?.researchFeeCents || 500) / 100,
          internalFacilityId: primaryFacility.facility_id || null,
        }
      : null,
  });
});

const linkFacility = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    throw new ApiError(400, "Invalid order id");
  }

  const facilityId = Number(req.body?.facilityId);
  const result = await personalPortalService.linkFacilityToPersonalPortalOrder(
    orderId,
    facilityId
  );

  const order = await Order.findById(orderId);
  const logContext = getInternalOrderLogContext(order || {});
  await logPersonalOrderActivity(req, orderId, {
    action: "personal_portal_link_facility",
    details: `Linked facility to personal portal order ${logContext.orderNumber}`,
  });

  return ApiResponse.success(
    res,
    result,
    "Facility linked to personal portal order"
  );
});

const markNoFacility = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    throw new ApiError(400, "Invalid order id");
  }

  const updated =
    await personalPortalService.markPersonalPortalOrderNoFacility(orderId);

  const order = await Order.findById(orderId);
  const logContext = getInternalOrderLogContext(order || {});
  await logPersonalOrderActivity(req, orderId, {
    action: "personal_portal_no_facility",
    details: `Changed personal portal order ${logContext.orderNumber} status to No facility`,
  });

  return ApiResponse.success(
    res,
    updated,
    "Order marked as No facility"
  );
});

const restoreInProcess = asyncHandler(async (req, res) => {
  const orderId = Number(req.params.orderId);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    throw new ApiError(400, "Invalid order id");
  }

  const updated =
    await personalPortalService.restorePersonalPortalOrderInProcess(orderId);

  const order = await Order.findById(orderId);
  const logContext = getInternalOrderLogContext(order || {});
  await logPersonalOrderActivity(req, orderId, {
    action: "personal_portal_restore_in_process",
    details: `Restored personal portal order ${logContext.orderNumber} from No facility back to In Process`,
  });

  return ApiResponse.success(
    res,
    updated,
    "Order restored to In Process"
  );
});

module.exports = {
  getStats,
  getNewFacilityRequest,
  linkFacility,
  markNoFacility,
  restoreInProcess,
};
