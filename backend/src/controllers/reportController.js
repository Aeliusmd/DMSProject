const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const reportService = require("../services/reportService");

exports.getOrdersReport = asyncHandler(async (req, res) => {
  const report = await reportService.getOrdersReport({
    orderNo: req.query.orderNo || "",
    caseNumber: req.query.caseNumber || "",
    doctor: req.query.doctor || "",
    dateFrom: req.query.dateFrom || req.query.fromDate || null,
    dateTo: req.query.dateTo || req.query.toDate || null,
    rushLevel: req.query.rushLevel || "",
    unpaidOnly:
      String(req.query.unpaidOnly || "").toLowerCase() === "true" ||
      String(req.query.unpaidOnly || "") === "1",
    showDuplicates:
      String(req.query.showDuplicates || "true").toLowerCase() !== "false" &&
      String(req.query.showDuplicates || "") !== "0",
  });

  return ApiResponse.success(res, report);
});

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

exports.exportActivityReportPdf = asyncHandler(async (req, res) => {
  const facilityId =
    req.query.facilityId && req.query.facilityId !== "all"
      ? req.query.facilityId
      : null;

  const { pdfBuffer, fileName } = await reportService.getActivityReportPdf({
    dateFrom: req.query.dateFrom || req.query.reportDate || null,
    dateTo: req.query.dateTo || req.query.throughDate || null,
    facilityId,
    facilityLabel: req.query.facilityLabel || "All Facilities",
    activity: req.query.activity || "All",
    search: req.query.search || "",
  });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${fileName.replace(/"/g, "")}"`
  );

  return res.send(pdfBuffer);
});
