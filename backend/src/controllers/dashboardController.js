const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const dashboardService = require("../services/dashboardService");

exports.getStats = asyncHandler(async (_req, res) => {
  const stats = await dashboardService.getDashboardStats();
  return ApiResponse.success(res, { stats });
});

exports.getTopProviders = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 5;
  const providers = await dashboardService.getTopProviders(limit);
  return ApiResponse.success(res, { providers });
});
