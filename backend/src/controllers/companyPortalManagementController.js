const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const companyPortalEmployeeService = require("../services/companyPortalEmployeeService");
const companyPortalWalletService = require("../services/companyPortalWalletService");

exports.listEmployees = asyncHandler(async (req, res) => {
  const employees = await companyPortalEmployeeService.listEmployees(
    req.companyUser.id,
    { search: req.query.search || "" }
  );
  return ApiResponse.success(res, { employees });
});

exports.createEmployee = asyncHandler(async (req, res) => {
  const result = await companyPortalEmployeeService.createEmployee(
    req.companyUser.id,
    {
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
    }
  );
  return ApiResponse.created(res, result, result.message);
});

exports.getWalletSummary = asyncHandler(async (req, res) => {
  const summary = await companyPortalWalletService.getWalletSummary(
    req.companyUser.id
  );
  return ApiResponse.success(res, summary);
});

exports.createTopupCheckout = asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, "Enter a valid top-up amount", [
      { field: "amount", message: "Enter a valid top-up amount" },
    ]);
  }

  const result = await companyPortalWalletService.createTopupCheckout(
    req.companyUser.id,
    { amount }
  );
  return ApiResponse.success(res, result, "Redirect to Stripe to complete top-up");
});

exports.confirmTopup = asyncHandler(async (req, res) => {
  const summary = await companyPortalWalletService.confirmTopup(
    req.companyUser.id,
    req.body.sessionId
  );
  return ApiResponse.success(res, summary, "Wallet top-up confirmed");
});

exports.allocateToEmployee = asyncHandler(async (req, res) => {
  const summary = await companyPortalWalletService.allocateToEmployee(
    req.companyUser.id,
    {
      employeeId: Number(req.body.employeeId),
      amount: Number(req.body.amount),
    }
  );
  return ApiResponse.success(res, summary, "Funds allocated successfully");
});
