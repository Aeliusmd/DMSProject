const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const invoiceService = require("../services/invoiceService");

exports.getAll = asyncHandler(async (req, res) => {
  const data = await invoiceService.getInvoices(req.query);
  return ApiResponse.success(res, data, "Invoices retrieved");
});

exports.getCompanyWise = asyncHandler(async (_req, res) => {
  const data = await invoiceService.getCompanyWise();
  return ApiResponse.success(res, data, "Company-wise invoices retrieved");
});

exports.getByCompany = asyncHandler(async (req, res) => {
  const data = await invoiceService.getByCompany(req.params.companyId, req.query);
  return ApiResponse.success(res, data, "Company invoices retrieved");
});

exports.getById = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.getInvoiceById(req.params.id);
  return ApiResponse.success(res, { invoice }, "Invoice retrieved");
});

exports.create = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.createInvoice(req.body, req.user?.id);
  return ApiResponse.created(res, { invoice }, "Invoice created successfully");
});

exports.update = asyncHandler(async (req, res) => {
  const invoice = await invoiceService.updateInvoice(req.params.id, req.body);
  return ApiResponse.success(res, { invoice }, "Invoice updated successfully");
});

exports.send = asyncHandler(async (req, res) => {
  const result = await invoiceService.sendInvoices(req.body.invoiceIds);
  return ApiResponse.success(res, result, "Invoices sent successfully");
});

exports.resend = asyncHandler(async (req, res) => {
  const result = await invoiceService.resendInvoices(req.body.invoiceIds);
  return ApiResponse.success(res, result, "Invoices resent successfully");
});

exports.createXray = asyncHandler(async (req, res) => {
  const xray = await invoiceService.createOrUpdateXrayInvoice(req.body, req.user?.id);
  return ApiResponse.success(res, xray, "X-Ray invoice saved successfully");
});

exports.getXrayByOrder = asyncHandler(async (req, res) => {
  const xray = await invoiceService.getXrayInvoiceByOrderId(req.params.orderId);
  return ApiResponse.success(res, xray, "X-Ray invoice retrieved");
});

exports.writeOff = asyncHandler(async (req, res) => {
  const result = await invoiceService.writeOffInvoices(req.body, req.user?.id);
  return ApiResponse.success(res, result, "Invoice(s) written off successfully");
});
