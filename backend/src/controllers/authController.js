const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const authService = require("../services/authService");
const {
  validateLogin,
  validateTwoFactor,
  validateResendTwoFactor,
  validateRefresh,
  validateLogout,
} = require("../validators/authValidator");

function getRequestMeta(req) {
  return {
    ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
    userAgent: req.headers["user-agent"] || null,
  };
}

exports.login = asyncHandler(async (req, res) => {
  const validation = validateLogin(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await authService.login({
    identifier: validation.identifier,
    password: req.body.password,
    ...getRequestMeta(req),
  });

  return ApiResponse.success(res, result, "Two-factor authentication required");
});

exports.verifyTwoFactor = asyncHandler(async (req, res) => {
  const validation = validateTwoFactor(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await authService.verifyTwoFactor({
    sessionToken: req.body.sessionToken,
    code: String(req.body.code).replace(/\D/g, ""),
    trustDevice: Boolean(req.body.trustDevice),
    ...getRequestMeta(req),
  });

  return ApiResponse.success(res, result, "Authentication successful");
});

exports.resendTwoFactor = asyncHandler(async (req, res) => {
  const validation = validateResendTwoFactor(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await authService.resendTwoFactor({
    sessionToken: req.body.sessionToken,
  });

  return ApiResponse.success(res, result, result.message);
});

exports.refresh = asyncHandler(async (req, res) => {
  const validation = validateRefresh(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await authService.refreshTokens({
    refreshToken: req.body.refreshToken,
  });

  return ApiResponse.success(res, result, "Token refreshed");
});

exports.logout = asyncHandler(async (req, res) => {
  const validation = validateLogout(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await authService.logout({
    refreshToken: req.body.refreshToken,
    sessionToken: req.body.sessionToken,
  });

  return ApiResponse.success(res, result, result.message);
});

exports.me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id);
  return ApiResponse.success(res, { user });
});
