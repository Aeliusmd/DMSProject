const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const personalPortalService = require("../services/personalPortalService");
const {
  validateEmailOtpRequest,
  validateEmailOtpConfirm,
  validatePersonalRequestSubmit,
  validateStatusLookup,
} = require("../validators/personalPortalValidator");

exports.sendEmailOtp = asyncHandler(async (req, res) => {
  const validation = validateEmailOtpRequest(req.body);
  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const data = await personalPortalService.sendEmailOtp(validation.email);
  return ApiResponse.success(res, data, "Verification code sent");
});

exports.confirmEmailOtp = asyncHandler(async (req, res) => {
  const emailValidation = validateEmailOtpRequest(req.body);
  const otpValidation = validateEmailOtpConfirm(req.body);

  const errors = [...emailValidation.errors, ...otpValidation.errors];
  if (errors.length) {
    throw new ApiError(400, "Validation failed", errors);
  }

  const data = await personalPortalService.confirmEmailOtp(
    otpValidation.sessionToken,
    otpValidation.code,
    emailValidation.email
  );

  return ApiResponse.success(res, data, "Email verified");
});

exports.submitRequest = asyncHandler(async (req, res) => {
  const validation = validatePersonalRequestSubmit({
    ...req.body,
    emailVerificationToken: req.body.emailVerificationToken,
  });

  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  if (!req.file) {
    throw new ApiError(400, "Validation failed", [
      { field: "driverLicenseFile", message: "Driver's license image is required" },
    ]);
  }

  const data = await personalPortalService.createPendingRequest(
    validation.parsed,
    req.file
  );

  return ApiResponse.success(res, data, "Proceed to payment to submit your request");
});

exports.getCheckoutResult = asyncHandler(async (req, res) => {
  const requestId = req.query.request_id;
  const sessionId = req.query.session_id;
  const data = await personalPortalService.getCheckoutResult(requestId, sessionId);
  return ApiResponse.success(res, data, "Payment result retrieved");
});

exports.lookupStatus = asyncHandler(async (req, res) => {
  const validation = validateStatusLookup(req.body);
  if (!validation.valid) {
    throw new ApiError(400, "Validation failed", validation.errors);
  }

  const data = await personalPortalService.lookupRequestStatus({
    confirmationReference: validation.confirmationReference,
    driverLicenseNumber: validation.driverLicenseNumber,
  });

  return ApiResponse.success(res, data, "Request status retrieved");
});

exports.getConfig = asyncHandler(async (_req, res) => {
  const config = require("../config");
  return ApiResponse.success(res, {
    processingFee: ((config.personalPortal?.processingFeeCents || 3500) / 100).toFixed(2),
    lookupDays: config.personalPortal?.lookupDays || 7,
    stripePublishableKey: config.stripe?.publishableKey || "",
  });
});

exports.searchFacilities = asyncHandler(async (req, res) => {
  const q = `${req.query.q || ""}`.trim();
  if (q.length < 2) {
    return ApiResponse.success(res, { facilities: [] });
  }

  const facilityService = require("../services/facilityService");
  const facilities = await facilityService.searchFacilitiesForPublic(q);
  return ApiResponse.success(res, { facilities });
});
