const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const activityLogService = require("../services/activityLogService");

exports.getAll = asyncHandler(async (_req, res) => {
  const logs = await activityLogService.getAllLogs();
  return ApiResponse.success(res, { logs });
});

exports.getEmployeeLogs = asyncHandler(async (req, res) => {
  const logs = await activityLogService.getEmployeeLogs(req.params.employeeId);
  return ApiResponse.success(res, { logs });
});

exports.getById = asyncHandler(async (req, res) => {
  const log = await activityLogService.getLogById(req.params.id);
  return ApiResponse.success(res, { log });
});