const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const activityLogService = require("../services/activityLogService");
const { isEmployee, isManager } = require("../utils/roles");

exports.getMyLogs = asyncHandler(async (req, res) => {
  const result = await activityLogService.getMyLogs(req.user.id, req.query);
  if (Array.isArray(result)) {
    return ApiResponse.success(res, { logs: result });
  }
  return ApiResponse.success(res, result);
});

exports.list = asyncHandler(async (req, res) => {
  const restrictOwn = isEmployee(req.user?.role) || isManager(req.user?.role);
  const result = await activityLogService.getAllLogs({
    ...req.query,
    performedBy: restrictOwn ? req.user.id : undefined,
  });

  if (Array.isArray(result)) {
    return ApiResponse.success(res, { logs: result });
  }
  return ApiResponse.success(res, result);
});

exports.getAll = asyncHandler(async (req, res) => {
  const result = await activityLogService.getAllLogs(req.query);
  if (Array.isArray(result)) {
    return ApiResponse.success(res, { logs: result });
  }
  return ApiResponse.success(res, result);
});

exports.getEmployeeLogs = asyncHandler(async (req, res) => {
  const result = await activityLogService.getEmployeeLogs(
    req.params.employeeId,
    req.query
  );

  if (Array.isArray(result)) {
    return ApiResponse.success(res, { logs: result });
  }

  return ApiResponse.success(res, result);
});

exports.getById = asyncHandler(async (req, res) => {
  const log = await activityLogService.getLogById(req.params.id);
  return ApiResponse.success(res, { log });
});