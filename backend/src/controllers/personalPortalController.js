const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const ApiError = require("../utils/ApiError");
const { throwIfInvalid } = require("../utils/validationUtils");
const { validateSearchQuery } = require("../validators/queryValidators");
const { sanitizeSearchText } = require("../utils/sanitize");
const personalPortalService = require("../services/personalPortalService");
const {
  validateEmailOtpRequest,
  validateEmailOtpConfirm,
  validatePersonalRequestSubmit,
  validateStatusLookup,
  validateRequestEmailUpdate,
  validatePersonalRequestsListQuery,
  validatePersonalCheckoutResultQuery,
} = require("../validators/personalPortalValidator");

exports.sendEmailOtp = asyncHandler(async (req, res) => {
  const validation = validateEmailOtpRequest(req.body);
  throwIfInvalid(validation);

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
  throwIfInvalid(validation);

  if (!req.file) {
    throw new ApiError(400, "Validation failed", [
      {
        field: "driverLicenseFile",
        message: "Driver's license image is required",
      },
    ]);
  }

  const data = await personalPortalService.createPendingRequest(
    validation.parsed,
    req.file
  );

  return ApiResponse.success(
    res,
    data,
    "Proceed to payment to submit your request"
  );
});

exports.submitAuthenticatedRequest = asyncHandler(async (req, res) => {
  const accountEmail = `${req.personalUser.email || ""}`.trim().toLowerCase();

  const validation = validatePersonalRequestSubmit(
    {
      ...req.body,
      email: accountEmail,
    },
    { authenticated: true }
  );
  throwIfInvalid(validation);

  if (!req.file) {
    throw new ApiError(400, "Validation failed", [
      {
        field: "driverLicenseFile",
        message: "Driver's license image is required",
      },
    ]);
  }

  const data = await personalPortalService.createPendingRequest(
    {
      ...validation.parsed,
      email: accountEmail,
    },
    req.file,
    { portalUserId: req.personalUser.id }
  );

  return ApiResponse.success(
    res,
    data,
    "Proceed to payment to submit your request"
  );
});

exports.getDashboard = asyncHandler(async (req, res) => {
  const data = await personalPortalService.getDashboardForUser(
    req.personalUser.id
  );
  return ApiResponse.success(res, data, "Dashboard loaded");
});

exports.listRequests = asyncHandler(async (req, res) => {
  const validation = validatePersonalRequestsListQuery(req.query);
  throwIfInvalid(validation);

  const data = await personalPortalService.listRequestsForUser(
    req.personalUser.id,
    {
      pageSize: validation.pageSize,
      cursor: validation.cursor,
      status: validation.status,
    }
  );

  return ApiResponse.success(res, data, "Requests loaded");
});

exports.createResearchFeeCheckout = asyncHandler(async (req, res) => {
  const requestId = Number(req.params.id);
  if (!Number.isFinite(requestId) || requestId <= 0) {
    throw new ApiError(400, "Invalid request id");
  }

  const data = await personalPortalService.createResearchFeeCheckout(
    requestId,
    req.personalUser.id
  );

  return ApiResponse.success(res, data, "Research fee checkout created");
});

exports.fulfillResearchFeeCheckout = asyncHandler(async (req, res) => {
  const sessionId = `${req.body?.sessionId || req.query?.session_id || ""}`.trim();
  if (!sessionId) {
    throw new ApiError(400, "session_id is required");
  }

  const stripePaymentService = require("../services/stripePaymentService");
  const config = require("../config");
  const Stripe = require("stripe");
  const stripe = new Stripe(config.stripe.secretKey);
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status === "paid") {
    await stripePaymentService.fulfillSuccessfulCheckoutSession(session);
  }

  return ApiResponse.success(
    res,
    {
      paid: session.payment_status === "paid",
      requestId: Number(session.metadata?.personal_request_id) || null,
    },
    "Research fee payment processed"
  );
});

exports.getCheckoutResult = asyncHandler(async (req, res) => {
  const validation = validatePersonalCheckoutResultQuery(req.query);
  throwIfInvalid(validation);

  const data = await personalPortalService.getCheckoutResult(
    validation.requestId,
    validation.sessionId
  );
  return ApiResponse.success(res, data, "Payment result retrieved");
});

exports.lookupStatus = asyncHandler(async (req, res) => {
  const validation = validateStatusLookup(req.body);
  throwIfInvalid(validation);

  const data = await personalPortalService.lookupRequestStatus({
    confirmationReference: validation.confirmationReference,
    dobIso: validation.dobIso,
  });

  return ApiResponse.success(res, data, "Request status retrieved");
});

exports.updateRequestEmail = asyncHandler(async (req, res) => {
  const validation = validateRequestEmailUpdate(req.body);
  throwIfInvalid(validation);

  const data = await personalPortalService.updateRequestNotificationEmail({
    confirmationReference: validation.confirmationReference,
    dobIso: validation.dobIso,
    email: validation.email,
  });

  return ApiResponse.success(res, data, data.message);
});

exports.getConfig = asyncHandler(async (_req, res) => {
  const config = require("../config");
  return ApiResponse.success(res, {
    processingFee: (
      (config.personalPortal?.processingFeeCents || 3500) / 100
    ).toFixed(2),
    lookupDays: config.personalPortal?.lookupDays || 7,
    stripePublishableKey: config.stripe?.publishableKey || "",
  });
});

exports.searchFacilities = asyncHandler(async (req, res) => {
  throwIfInvalid(validateSearchQuery(req.query));

  const q = sanitizeSearchText(req.query.q);
  if (q.length < 2) {
    return ApiResponse.success(res, { facilities: [] });
  }

  const facilityService = require("../services/facilityService");
  const facilities = await facilityService.searchFacilitiesForPublic(q);
  return ApiResponse.success(res, { facilities });
});
