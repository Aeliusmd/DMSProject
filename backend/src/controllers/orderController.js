const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const batchScanService = require("../services/batchScanService");
const { notImplemented } = require("./_controllerHelper");

exports.getAll = notImplemented("Get orders");
exports.getById = notImplemented("Get order by ID");
exports.create = notImplemented("Create order");
exports.update = notImplemented("Update order");
exports.remove = notImplemented("Delete order");

exports.getUnprocessed = asyncHandler(async (_req, res) => {
  const items = await batchScanService.getUnprocessedQueue();
  return ApiResponse.success(res, items, "Unprocessed subpoenas retrieved");
});

exports.getUnprocessedById = asyncHandler(async (req, res) => {
  const item = await batchScanService.getUnprocessedExtract(req.params.extractId);
  return ApiResponse.success(res, item, "Unprocessed subpoena retrieved");
});

exports.batchScan = asyncHandler(async (req, res) => {
  const result = await batchScanService.processBatchScan(
    req.file,
    req.body.uploadedBy
  );
  return ApiResponse.created(res, result, "Batch scan processed successfully");
});
