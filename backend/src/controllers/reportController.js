const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const reportService = require("../services/reportService");
const { notImplemented } = require("./_controllerHelper");

exports.getOrdersReport = notImplemented("Get orders report");

exports.getActivityReport = asyncHandler(async (req, res) => {
  const report = await reportService.getActivityReport({
    dateFrom: req.query.dateFrom || req.query.reportDate || null,
    dateTo: req.query.dateTo || req.query.throughDate || null,
    facilityId:
      req.query.facilityId && req.query.facilityId !== "all"
        ? req.query.facilityId
        : null,
    activity: req.query.activity || "All",
    search: req.query.search || "",
  });

  return ApiResponse.success(res, report);
});
