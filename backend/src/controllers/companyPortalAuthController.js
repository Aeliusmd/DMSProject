const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const companyPortalAuthService = require("../services/companyPortalAuthService");
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

  return ApiResponse.success(res, result, "Two-factor authentication required");
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

  return ApiResponse.success(res, result, "Authentication successful");
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
  const validation = validateCompanyRefresh(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await companyPortalAuthService.refreshTokens({
    refreshToken: req.body.refreshToken,
  });

  return ApiResponse.success(res, result, "Token refreshed");
});

exports.logout = asyncHandler(async (req, res) => {
  const validation = validateCompanyLogout(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await companyPortalAuthService.logout({
    refreshToken: req.body.refreshToken,
    sessionToken: req.body.sessionToken,
  });

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
  const email = `${req.body.email || ""}`.trim().toLowerCase();
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (!email) {
    throw new ApiError(400, "Email is required", [
      { field: "email", message: "Email is required" },
    ]);
  }

  if (!password) {
    throw new ApiError(400, "Password is required", [
      { field: "password", message: "Password is required" },
    ]);
  }

  const companyPortalEmployeeAuthService = require("../services/companyPortalEmployeeAuthService");
  const result = await companyPortalEmployeeAuthService.login({
    email,
    password,
    ...getRequestMeta(req),
    trustDevice: Boolean(req.body.trustDevice),
  });

  return ApiResponse.success(res, result, "Authentication successful");
});
