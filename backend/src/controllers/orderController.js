const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { notImplemented } = require("./_controllerHelper");
const orderService = require("../services/orderService");
const {
  validateCreateOrder,
  validateUpdateOrder,
  validateOrderNote,
  validateWorkflowStageUpdate,
} = require("../validators/orderValidator");

exports.getAll = asyncHandler(async (req, res) => {
  const orders = await orderService.getAllOrders(req.query);
  return ApiResponse.success(res, { orders });
});

exports.getUnprocessed = notImplemented("Get unprocessed orders");

exports.getById = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id);
  return ApiResponse.success(res, { order });
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

  return ApiResponse.success(res, { order }, "Order updated successfully");
});

exports.remove = asyncHandler(async (req, res) => {
  const result = await orderService.deleteOrder(req.params.id);
  return ApiResponse.success(res, result, result.message);
});

exports.getNotes = asyncHandler(async (req, res) => {
  const notes = await orderService.getOrderNotes(req.params.id);
  return ApiResponse.success(res, { notes });
});

exports.createNote = asyncHandler(async (req, res) => {
  const validation = validateOrderNote(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const notes = await orderService.addOrderNote(
    req.params.id,
    req.body,
    req.user.id,
    req.file
  );

  return ApiResponse.created(res, { notes }, "Note added successfully");
});

exports.updateNote = asyncHandler(async (req, res) => {
  const validation = validateOrderNote(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await orderService.updateOrderNote(
    req.params.id,
    req.params.noteId,
    req.body,
    req.user.id,
    req.file
  );

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

  const stages = await orderService.updateOrderWorkflowStage(
    req.params.id,
    req.body.stageName,
    req.body.stageStatus
  );

  return ApiResponse.success(res, { stages }, "Workflow stage updated");
});
