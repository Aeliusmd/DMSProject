const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const companyPortalAuthService = require("../services/companyPortalAuthService");
const {
  buildAuthPayload,
  clearPortalAuthCookies,
  getRefreshTokenFromRequest,
  setPortalAuthCookies,
} = require("../utils/authCookies");
const {
  validateCompanyRegister,
  validateCompanyLogin,
  validateCompanyTwoFactor,
  validateCompanyResendTwoFactor,
  validateCompanyRefresh,
  validateCompanyLogout,
} = require("../validators/companyPortalAuthValidator");

function getRequestMeta(req) {
  return {
    ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
    userAgent: req.headers["user-agent"] || null,
  };
}

exports.register = asyncHandler(async (req, res) => {
  const validation = validateCompanyRegister(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await companyPortalAuthService.register(validation.data);

  return ApiResponse.created(res, result, result.message);
});

exports.login = asyncHandler(async (req, res) => {
  const validation = validateCompanyLogin(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await companyPortalAuthService.login({
    email: validation.data.email,
    password: validation.data.password,
    ...getRequestMeta(req),
  });

  const companyPortalActivityLogService = require("../services/companyPortalActivityLogService");
  await companyPortalActivityLogService.recordSafe({
    companyUserId: result.user?.id,
    performedByType: "admin",
    performedByAdminId: result.user?.id,
    performerName: result.user?.companyName || "Company Admin",
    companyName: result.user?.companyName || null,
    context: "auth",
    action: "login",
    details: "Company admin logged in successfully",
  });

  setPortalAuthCookies(res, "company", result);

  return ApiResponse.success(res, buildAuthPayload(result), "Authentication successful");
});

exports.verifyTwoFactor = asyncHandler(async (req, res) => {
  const validation = validateCompanyTwoFactor(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await companyPortalAuthService.verifyTwoFactor({
    sessionToken: req.body.sessionToken,
    code: String(req.body.code).replace(/\D/g, ""),
    trustDevice: Boolean(req.body.trustDevice),
  });

  setPortalAuthCookies(res, "company", result);

  return ApiResponse.success(res, buildAuthPayload(result), "Authentication successful");
});

exports.resendTwoFactor = asyncHandler(async (req, res) => {
  const validation = validateCompanyResendTwoFactor(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await companyPortalAuthService.resendTwoFactor({
    sessionToken: req.body.sessionToken,
  });

  return ApiResponse.success(res, result, result.message);
});

exports.refresh = asyncHandler(async (req, res) => {
  const validation = validateCompanyRefresh({
    refreshToken: getRefreshTokenFromRequest(req, "company"),
  });

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await companyPortalAuthService.refreshTokens({
    refreshToken: validation.refreshToken,
  });

  setPortalAuthCookies(res, "company", result);

  return ApiResponse.success(res, buildAuthPayload(result), "Token refreshed");
});

exports.logout = asyncHandler(async (req, res) => {
  const validation = validateCompanyLogout({
    refreshToken: getRefreshTokenFromRequest(req, "company"),
    sessionToken: req.body.sessionToken,
  });

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await companyPortalAuthService.logout({
    refreshToken: validation.refreshToken,
    sessionToken: validation.sessionToken,
  });

  if (result.companyUserId) {
    const companyPortalActivityLogService = require("../services/companyPortalActivityLogService");
    await companyPortalActivityLogService.recordSafe({
      companyUserId: result.companyUserId,
      performedByType: result.employeeId ? "employee" : "admin",
      performedByAdminId: result.employeeId ? null : result.companyUserId,
      performedByEmployeeId: result.employeeId || null,
      performerName: result.performerName || null,
      companyName: result.companyName || null,
      context: "auth",
      action: "logout",
      details: result.employeeId
        ? "Company employee logged out"
        : "Company admin logged out",
    });
  }

  clearPortalAuthCookies(res, "company");

  return ApiResponse.success(res, result, result.message);
});

exports.me = asyncHandler(async (req, res) => {
  if (req.companyUser.employeeId) {
    const companyPortalEmployeeAuthService = require("../services/companyPortalEmployeeAuthService");
    const user = await companyPortalEmployeeAuthService.getCurrentUser(
      req.companyUser.employeeId
    );
    return ApiResponse.success(res, { user });
  }

  const user = await companyPortalAuthService.getCurrentUser(req.companyUser.id);
  return ApiResponse.success(res, { user });
});

exports.employeeLogin = asyncHandler(async (req, res) => {
  const validation = validateCompanyLogin(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const companyPortalEmployeeAuthService = require("../services/companyPortalEmployeeAuthService");
  const result = await companyPortalEmployeeAuthService.login({
    email: validation.data.email,
    password: validation.data.password,
    ...getRequestMeta(req),
    trustDevice: Boolean(req.body.trustDevice),
  });

  const companyPortalActivityLogService = require("../services/companyPortalActivityLogService");
  await companyPortalActivityLogService.recordSafe({
    companyUserId: result.user?.companyUserId,
    performedByType: "employee",
    performedByEmployeeId: result.user?.id,
    performerName: result.user?.name || "Company Employee",
    companyName: result.user?.companyName || null,
    context: "auth",
    action: "login",
    details: `Employee ${result.user?.name || validation.data.email} logged in successfully`,
  });

  setPortalAuthCookies(res, "company", result);

  return ApiResponse.success(res, buildAuthPayload(result), "Authentication successful");
});
