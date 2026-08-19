const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const authService = require("../services/authService");
const activityLogService = require("../services/activityLogService");
const {
  buildAuthPayload,
  clearPortalAuthCookies,
  getRefreshTokenFromRequest,
  setPortalAuthCookies,
} = require("../utils/authCookies");
const {
  validateLogin,
  validateTwoFactor,
  validateResendTwoFactor,
  validateRefresh,
  validateLogout,
  validateImpersonate,
  validateImpersonateExchange,
  validateForgotPassword,
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

  const meta = getRequestMeta(req);
  const result = await authService.verifyTwoFactor({
    sessionToken: req.body.sessionToken,
    code: String(req.body.code).replace(/\D/g, ""),
    trustDevice: Boolean(req.body.trustDevice),
    ...meta,
  });

  await activityLogService.recordSafe({
    performedBy: result.user.id,
    performerName: result.user.name,
    context: "auth",
    action: "login",
    details: "Logged in successfully",
    targetEmployeeId: result.user.id,
    companyName: "System",
  });

  setPortalAuthCookies(res, "internal", result);

  return ApiResponse.success(res, buildAuthPayload(result), "Authentication successful");
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
  const validation = validateRefresh({
    refreshToken: getRefreshTokenFromRequest(req, "internal"),
  });

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await authService.refreshTokens({
    refreshToken: validation.refreshToken,
  });

  if (!result.impersonated) {
    setPortalAuthCookies(res, "internal", result);
  }

  return ApiResponse.success(res, buildAuthPayload(result), "Token refreshed");
});

exports.logout = asyncHandler(async (req, res) => {
  const validation = validateLogout({
    refreshToken: getRefreshTokenFromRequest(req, "internal"),
    sessionToken: req.body.sessionToken,
  });

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const meta = getRequestMeta(req);
  const result = await authService.logout({
    refreshToken: validation.refreshToken,
    sessionToken: validation.sessionToken,
  });

  if (result.employeeId && !result.impersonated) {
    await activityLogService.recordSafe({
      performedBy: result.employeeId,
      context: "auth",
      action: "logout",
      details: "Logged out successfully",
      targetEmployeeId: result.employeeId,
      companyName: "System",
    });
  }

  if (!result.impersonated) {
    clearPortalAuthCookies(res, "internal");
  }

  return ApiResponse.success(res, result, result.message);
});

exports.me = asyncHandler(async (req, res) => {
  const user = await authService.getCurrentUser(req.user.id, {
    impersonatorId: req.user.impersonatorId,
  });
  return ApiResponse.success(res, { user });
});

exports.impersonate = asyncHandler(async (req, res) => {
  const validation = validateImpersonate({
    employeeId: req.body?.employeeId || req.params.id,
  });

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await authService.startImpersonation({
    adminId: req.user.id,
    adminRole: req.user.role,
    alreadyImpersonating: Boolean(req.user.impersonated),
    employeeId: validation.employeeId,
  });

  return ApiResponse.success(
    res,
    result,
    "Open the new window to continue as this user"
  );
});

exports.exchangeImpersonation = asyncHandler(async (req, res) => {
  const validation = validateImpersonateExchange(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const meta = getRequestMeta(req);
  const result = await authService.exchangeImpersonation({
    exchangeToken: validation.exchangeToken,
    ...meta,
  });

  await activityLogService.recordSafe({
    performedBy: result.impersonator.id,
    performerName: result.impersonator.name,
    context: "auth",
    action: "impersonate",
    details: `Started a support session as ${result.user.name}`,
    targetEmployeeId: result.user.id,
    companyName: "System",
  });

  return ApiResponse.success(
    res,
    buildAuthPayload(result),
    "Signed in as employee"
  );
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const validation = validateForgotPassword(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await authService.requestPasswordReset({
    email: validation.email,
    password: validation.password,
  });

  return ApiResponse.success(
    res,
    result,
    "Verification code sent to your email"
  );
});

exports.verifyForgotPassword = asyncHandler(async (req, res) => {
  const validation = validateTwoFactor(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await authService.verifyPasswordReset({
    sessionToken: req.body.sessionToken,
    code: String(req.body.code).replace(/\D/g, ""),
  });

  if (result.employeeId) {
    await activityLogService.recordSafe({
      performedBy: result.employeeId,
      performerName: result.employeeName,
      context: "auth",
      action: "change_password",
      details: "Password reset via forgot password",
      targetEmployeeId: result.employeeId,
      companyName: "System",
    });
  }

  return ApiResponse.success(res, { message: result.message }, result.message);
});

exports.resendForgotPassword = asyncHandler(async (req, res) => {
  const validation = validateResendTwoFactor(req.body);

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const result = await authService.resendPasswordReset({
    sessionToken: req.body.sessionToken,
  });

  return ApiResponse.success(res, result, result.message);
});
