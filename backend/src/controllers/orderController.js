const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const orderService = require("../services/orderService");
const batchScanService = require("../services/batchScanService");
const activityLogService = require("../services/activityLogService");
const {
  validateCreateOrder,
  validateUpdateOrder,
  validateOrderNote,
  validateWorkflowStageUpdate,
} = require("../validators/orderValidator");

function getOrderLogContext(order) {
  const facilityId = order?.facility ? Number(order.facility) : null;

  return {
    facilityId: Number.isFinite(facilityId) ? facilityId : null,
    companyName: order?.facilityName || order?.serveCompanyName || "System",
  };
}

async function logOrderActivity(
  req,
  order,
  { action, details, callbackDate = null, attachmentPath = null, skipOrderLog = false }
) {
  const logContext = getOrderLogContext(order);
  const taggedDetails = activityLogService.appendOrderId(details, order.id);

  await activityLogService.recordFromRequest(req, {
    context: "orders",
    action,
    details: taggedDetails,
    facilityId: logContext.facilityId,
    companyName: logContext.companyName,
    targetEmployeeId: req.user.id,
  });

  if (!skipOrderLog) {
    await orderService.addOrderActivityLog({
      orderId: order.id,
      actorId: req.user.id,
      note: details,
      callbackDate,
      attachmentPath,
    });
  }
}

exports.getAll = asyncHandler(async (req, res) => {
  const orders = await orderService.getAllOrders(req.query);
  return ApiResponse.success(res, { orders });
});

exports.getStats = asyncHandler(async (_req, res) => {
  const stats = await orderService.getOrderStats();
  return ApiResponse.success(res, { stats });
});

exports.getUnprocessed = asyncHandler(async (_req, res) => {
  const items = await batchScanService.getUnprocessedQueue();
  return ApiResponse.success(res, items, "Unprocessed subpoenas retrieved");
});

exports.getUnprocessedById = asyncHandler(async (req, res) => {
  const item = await batchScanService.getUnprocessedExtract(req.params.extractId);
  return ApiResponse.success(res, item, "Unprocessed subpoena retrieved");
});

exports.getUnprocessedFile = asyncHandler(async (req, res) => {
  const fileInfo = await batchScanService.getUnprocessedExtractFile(
    req.params.extractId
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${fileInfo.fileName.replace(/"/g, "")}"`
  );
  return res.sendFile(fileInfo.absolutePath);
});

exports.batchScan = asyncHandler(async (req, res) => {
  const result = await batchScanService.processBatchScan(
    req.file,
    req.body.uploadedBy || req.user?.id
  );
  return ApiResponse.created(res, result, "Batch scan processed successfully");
});

exports.uploadSubpoena = asyncHandler(async (req, res) => {
  const result = await batchScanService.processSingleSubpoena(
    req.file,
    req.user?.id
  );
  return ApiResponse.created(
    res,
    result,
    "Subpoena uploaded and extracted successfully"
  );
});

exports.getById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id);
  return ApiResponse.success(res, { order });
});

exports.getReminders = asyncHandler(async (req, res) => {
  const reminders = await orderService.getOrderReminders(req.user, {
    scope: req.query.scope,
  });
  return ApiResponse.success(res, { reminders });
});

exports.create = asyncHandler(async (req, res) => {
  const validation = validateCreateOrder(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const order = await orderService.createOrder(
    req.body,
    req.user.id,
    req.files
  );

  await logOrderActivity(req, order, {
    action: "create",
    details: `Created order ${order.orderNumber} for ${getOrderLogContext(order).companyName}`,
  });

  return ApiResponse.created(res, { order }, "Order created successfully");
});

exports.update = asyncHandler(async (req, res) => {
  const validation = validateUpdateOrder(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const order = await orderService.updateOrder(
    req.params.id,
    req.body,
    req.user.id,
    req.files
  );

  await logOrderActivity(req, order, {
    action: "update",
    details: `Updated order ${order.orderNumber} for ${getOrderLogContext(order).companyName}`,
  });

  return ApiResponse.success(res, { order }, "Order updated successfully");
});

exports.remove = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id);
  const result = await orderService.deleteOrder(req.params.id);

  await logOrderActivity(req, order, {
    action: "delete",
    details: `Deleted order ${order.orderNumber} for ${getOrderLogContext(order).companyName}`,
  });

  return ApiResponse.success(res, result, result.message);
});

exports.getNotes = asyncHandler(async (req, res) => {
  const notes = await orderService.getOrderNotes(req.params.id, {
    includeCalled:
      String(req.query.includeCalled || "").toLowerCase() === "true" ||
      String(req.query.includeCalled || "") === "1",
    noteId: req.query.noteId || null,
    actorId: req.user.id,
    actorRole: req.user.role,
  });
  return ApiResponse.success(res, { notes });
});

exports.createNote = asyncHandler(async (req, res) => {
  const validation = validateOrderNote(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const order = await orderService.getOrderById(req.params.id);
  const notes = await orderService.addOrderNote(
    req.params.id,
    req.body,
    req.user.id,
    req.file
  );

  await logOrderActivity(req, order, {
    action: "create_note",
    details: `Added note to order ${order.orderNumber}`,
    skipOrderLog: true,
  });

  return ApiResponse.created(res, { notes }, "Note added successfully");
});

exports.updateNote = asyncHandler(async (req, res) => {
  const validation = validateOrderNote(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const order = await orderService.getOrderById(req.params.id);
  const result = await orderService.updateOrderNote(
    req.params.id,
    req.params.noteId,
    req.body,
    req.user.id,
    req.file
  );

  await logOrderActivity(req, order, {
    action: "update_note",
    details: `Saved callback note on order ${order.orderNumber}`,
    skipOrderLog: true,
  });

  return ApiResponse.success(res, result, "Note updated successfully");
});

exports.getActivityLogs = asyncHandler(async (req, res) => {
  const logs = await orderService.getOrderActivityLogs(req.params.id);
  return ApiResponse.success(res, { logs });
});

exports.getWorkflowStages = asyncHandler(async (req, res) => {
  const stages = await orderService.getWorkflowStages(req.params.id);
  return ApiResponse.success(res, { stages });
});

exports.updateWorkflowStage = asyncHandler(async (req, res) => {
  const validation = validateWorkflowStageUpdate(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const order = await orderService.getOrderById(req.params.id);
  const stages = await orderService.updateOrderWorkflowStage(
    req.params.id,
    req.body.stageName,
    req.body.stageStatus
  );

  await logOrderActivity(req, order, {
    action: "workflow_update",
    details: `Updated "${req.body.stageName}" workflow stage to ${req.body.stageStatus} on order ${order.orderNumber}`,
  });

  return ApiResponse.success(res, { stages }, "Workflow stage updated");
});
