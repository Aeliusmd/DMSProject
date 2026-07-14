const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const personalPortalAuthService = require("../services/personalPortalAuthService");
const {
  validatePersonalRegister,
  validatePersonalLogin,
  validatePersonalTwoFactor,
  validatePersonalResendTwoFactor,
  validatePersonalRefresh,
  validatePersonalLogout,
} = require("../validators/personalPortalAuthValidator");

function getRequestMeta(req) {
  return {
    ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
    userAgent: req.headers["user-agent"] || null,
  };
}

exports.register = asyncHandler(async (req, res) => {
  const validation = validatePersonalRegister(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await personalPortalAuthService.register(validation.data);
  return ApiResponse.created(res, result, result.message);
});

exports.login = asyncHandler(async (req, res) => {
  const validation = validatePersonalLogin(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await personalPortalAuthService.login({
    email: validation.data.email,
    password: validation.data.password,
    ...getRequestMeta(req),
  });

  return ApiResponse.success(res, result, "Two-factor authentication required");
});

exports.verifyTwoFactor = asyncHandler(async (req, res) => {
  const validation = validatePersonalTwoFactor(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await personalPortalAuthService.verifyTwoFactor({
    sessionToken: validation.sessionToken,
    code: validation.code,
    trustDevice: Boolean(req.body.trustDevice),
  });

  return ApiResponse.success(res, result, "Authentication successful");
});

exports.resendTwoFactor = asyncHandler(async (req, res) => {
  const validation = validatePersonalResendTwoFactor(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await personalPortalAuthService.resendTwoFactor({
    sessionToken: validation.sessionToken,
  });

  return ApiResponse.success(res, result, result.message);
});

exports.refresh = asyncHandler(async (req, res) => {
  const validation = validatePersonalRefresh(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await personalPortalAuthService.refreshTokens({
    refreshToken: req.body.refreshToken,
  });

  return ApiResponse.success(res, result, "Token refreshed");
});

exports.logout = asyncHandler(async (req, res) => {
  validatePersonalLogout(req.body);

  const result = await personalPortalAuthService.logout({
    refreshToken: req.body.refreshToken,
    sessionToken: req.body.sessionToken,
  });

  return ApiResponse.success(res, result, result.message);
});

exports.me = asyncHandler(async (req, res) => {
  const user = await personalPortalAuthService.getCurrentUser(req.personalUser.id);
  return ApiResponse.success(res, { user });
});
