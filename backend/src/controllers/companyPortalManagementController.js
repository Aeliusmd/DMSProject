const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const companyPortalEmployeeService = require("../services/companyPortalEmployeeService");
const companyPortalWalletService = require("../services/companyPortalWalletService");

exports.listEmployees = asyncHandler(async (req, res) => {
  const useKeyset =
    String(req.query.pagination || "").trim().toLowerCase() === "keyset";

  if (useKeyset) {
    const pageSize = Math.min(
      Math.max(Number(req.query.pageSize) || 10, 1),
      50
    );
    const result = await companyPortalEmployeeService.listEmployeesPaginated(
      req.companyUser.id,
      {
        search: req.query.search || "",
        cursor: req.query.cursor || null,
        pageSize,
      }
    );
    return ApiResponse.success(res, result);
  }

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

  const companyPortalActivityLogService = require("../services/companyPortalActivityLogService");
  await companyPortalActivityLogService.recordFromRequest(req, {
    context: "employees",
    action: "create",
    details: `New employee ${result.employee?.name || req.body.name} (${result.employee?.email || req.body.email}) added`,
  });

  return ApiResponse.created(res, result, result.message);
});

exports.getWalletSummary = asyncHandler(async (req, res) => {
  const summary = await companyPortalWalletService.getWalletSummary(
    req.companyUser.id
  );
  return ApiResponse.success(res, summary);
});

exports.listWalletTransactions = asyncHandler(async (req, res) => {
  const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 10, 1), 50);
  const result = await companyPortalWalletService.listWalletTransactions(
    req.companyUser.id,
    {
      cursor: req.query.cursor || null,
      pageSize,
    }
  );
  return ApiResponse.success(res, result);
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

  const companyPortalActivityLogService = require("../services/companyPortalActivityLogService");
  const latestTopup = (summary?.transactions || []).find(
    (tx) => tx.transactionType === "topup" || tx.type === "topup"
  );
  const amount = Number(latestTopup?.amount || 0);
  await companyPortalActivityLogService.recordFromRequest(req, {
    context: "wallet",
    action: "wallet_topup",
    details: amount
      ? `Company wallet topped up by $${amount.toFixed(2)}`
      : "Company wallet top-up confirmed",
  });

  return ApiResponse.success(res, summary, "Wallet top-up confirmed");
});

exports.allocateToEmployee = asyncHandler(async (req, res) => {
  const employeeId = Number(req.body.employeeId);
  const amount = Number(req.body.amount);

  const summary = await companyPortalWalletService.allocateToEmployee(
    req.companyUser.id,
    {
      employeeId,
      amount,
    }
  );

  const companyPortalActivityLogService = require("../services/companyPortalActivityLogService");
  const latestAlloc = (summary?.transactions || []).find(
    (tx) =>
      tx.transactionType === "allocation" || tx.type === "allocation"
  );
  const employeeLabel =
    latestAlloc?.employeeName || `employee #${employeeId}`;
  await companyPortalActivityLogService.recordFromRequest(req, {
    context: "wallet",
    action: "wallet_allocate",
    details: `Allocated $${Number(amount || 0).toFixed(2)} to ${employeeLabel}`,
  });

  return ApiResponse.success(res, summary, "Funds allocated successfully");
});
