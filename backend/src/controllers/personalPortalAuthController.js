const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const { throwIfInvalid } = require("../utils/validationUtils");
const personalPortalAuthService = require("../services/personalPortalAuthService");
const {
  validatePersonalRegister,
  validatePersonalLogin,
  validatePersonalTwoFactor,
  validatePersonalResendTwoFactor,
  validatePersonalRefresh,
  validatePersonalLogout,
} = require("../validators/personalPortalAuthValidator");
const {
  validatePersonalAccountEmailUpdate,
} = require("../validators/personalPortalValidator");

function getRequestMeta(req) {
  return {
    ipAddress: req.ip || req.headers["x-forwarded-for"] || null,
    userAgent: req.headers["user-agent"] || null,
  };
}

exports.register = asyncHandler(async (req, res) => {
  const validation = validatePersonalRegister(req.body);
  throwIfInvalid(validation);

  const result = await personalPortalAuthService.register(validation.data);
  return ApiResponse.created(res, result, result.message);
});

exports.login = asyncHandler(async (req, res) => {
  const validation = validatePersonalLogin(req.body);
  throwIfInvalid(validation);

  const result = await personalPortalAuthService.login({
    email: validation.data.email,
    ...getRequestMeta(req),
  });

  return ApiResponse.success(res, result, "Verification code sent");
});

exports.verifyTwoFactor = asyncHandler(async (req, res) => {
  const validation = validatePersonalTwoFactor(req.body);
  throwIfInvalid(validation);

  const result = await personalPortalAuthService.verifyTwoFactor({
    sessionToken: validation.sessionToken,
    code: validation.code,
    trustDevice: Boolean(req.body.trustDevice),
  });

  return ApiResponse.success(res, result, "Authentication successful");
});

exports.resendTwoFactor = asyncHandler(async (req, res) => {
  const validation = validatePersonalResendTwoFactor(req.body);
  throwIfInvalid(validation);

  const result = await personalPortalAuthService.resendTwoFactor({
    sessionToken: validation.sessionToken,
  });

  return ApiResponse.success(res, result, result.message);
});

exports.refresh = asyncHandler(async (req, res) => {
  const validation = validatePersonalRefresh(req.body);
  throwIfInvalid(validation);

  const result = await personalPortalAuthService.refreshTokens({
    refreshToken: validation.refreshToken,
  });

  return ApiResponse.success(res, result, "Token refreshed");
});

exports.logout = asyncHandler(async (req, res) => {
  const validation = validatePersonalLogout(req.body);
  throwIfInvalid(validation);

  const result = await personalPortalAuthService.logout({
    refreshToken: validation.refreshToken,
    sessionToken: validation.sessionToken,
  });

  return ApiResponse.success(res, result, result.message);
});

exports.me = asyncHandler(async (req, res) => {
  const user = await personalPortalAuthService.getCurrentUser(req.personalUser.id);
  return ApiResponse.success(res, { user });
});

exports.updateEmail = asyncHandler(async (req, res) => {
  const validation = validatePersonalAccountEmailUpdate(req.body);
  throwIfInvalid(validation);

  const result = await personalPortalAuthService.updateAccountEmail(
    req.personalUser.id,
    validation.email
  );

  return ApiResponse.success(res, result, result.message);
});
