const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const companyPortalActivityLogService = require("../services/companyPortalActivityLogService");

exports.list = asyncHandler(async (req, res) => {
  const result = await companyPortalActivityLogService.queryLogs(
    req.companyUser.id,
    req.query
  );

  if (Array.isArray(result)) {
    return ApiResponse.success(res, { logs: result });
  }

  return ApiResponse.success(res, result);
});
