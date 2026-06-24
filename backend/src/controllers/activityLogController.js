const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const activityLogService = require("../services/activityLogService");
const { isEmployee, isManager } = require("../utils/roles");

exports.getMyLogs = asyncHandler(async (req, res) => {
  const logs = await activityLogService.getMyLogs(req.user.id);
  return ApiResponse.success(res, { logs });
});

exports.list = asyncHandler(async (req, res) => {
  const logs =
    isEmployee(req.user?.role) || isManager(req.user?.role)
      ? await activityLogService.getMyLogs(req.user.id)
      : await activityLogService.getAllLogs();

  return ApiResponse.success(res, { logs });
});

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