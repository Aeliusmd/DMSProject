const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const staffPersonalOrderService = require("../services/staffPersonalOrderService");

const getStats = asyncHandler(async (_req, res) => {
  const data = await staffPersonalOrderService.getStaffPersonalOrderStats();
  return ApiResponse.success(res, data, "Personal order stats retrieved");
});

module.exports = {
  getStats,
};
