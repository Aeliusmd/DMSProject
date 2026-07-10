const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const reportService = require("../services/reportService");
const { sendBufferResponse } = require("../utils/responseUtils");
const {
  parseOrdersReportQuery,
  parseActivityReportQuery,
} = require("../lib/reportQueryParser");

exports.getOrdersReport = asyncHandler(async (req, res) => {
  const report = await reportService.getOrdersReport(
    parseOrdersReportQuery(req.query)
  );

  return ApiResponse.success(res, report);
});

exports.getActivityReport = asyncHandler(async (req, res) => {
  const report = await reportService.getActivityReport(
    parseActivityReportQuery(req.query)
  );

  return ApiResponse.success(res, report);
});

exports.exportActivityReportPdf = asyncHandler(async (req, res) => {
  const options = parseActivityReportQuery(req.query);
  const { pdfBuffer, fileName } = await reportService.getActivityReportPdf(
    options
  );

  const safeFileName = `${fileName || "activity-report.pdf"}`.replace(
    /[^\w.\-]+/g,
    "_"
  );

  sendBufferResponse(res, pdfBuffer, {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${safeFileName.replace(/"/g, "")}"`,
  });
});
