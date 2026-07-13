/**
 * Personal Request Portal — email OTP, request submission, Stripe $35 fee, order creation.
 */

const crypto = require("crypto");
const path = require("path");
const Stripe = require("stripe");

const config = require("../config");
const ApiError = require("../utils/ApiError");
const { rethrowServiceError } = require("../utils/serviceErrorUtils");
const { getPool } = require("../config/database");
const PersonalPortalRequest = require("../models/PersonalPortalRequest");
const Order = require("../models/Order");
const OrderRecord = require("../models/OrderRecord");
const twoFactorStore = require("./twoFactorStore");
const tokenService = require("./tokenService");
const emailService = require("./emailService");
const orderService = require("./orderService");
const recordDownloadService = require("./recordDownloadService");
const logger = require("../utils/logger");

let stripeClient = null;

const PORTAL_STATUS_LABELS = {
  pending_payment: "Pending Payment",
  in_process: "In Process",
  invoice: "Invoice",
  paid: "Paid",
  released: "Released",
};

function getStripe() {
  if (!stripeClient) {
    const secretKey = config.stripe?.secretKey;
    if (!secretKey) {
      throw new ApiError(500, "Stripe is not configured");
    }
    stripeClient = new Stripe(secretKey);
  }
  return stripeClient;
}

function trimOrNull(value) {
  if (value === undefined || value === null) return null;
  const trimmed = `${value}`.trim();
  return trimmed === "" ? null : trimmed;
}

function otpSessionKey(sessionToken) {
  return `personal-portal:${sessionToken}`;
}

function generateConfirmationReference() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `PR-${datePart}-${suffix}`;
}

function addLookupExpiry(fromDate = new Date()) {
  const days = config.personalPortal?.lookupDays || 7;
  const expires = new Date(fromDate);
  expires.setDate(expires.getDate() + days);
  return expires;
}

function toRelativeLicensePath(file) {
  if (!file?.path) return null;
  const uploadsRoot = path.join(__dirname, "..", "..", "uploads");
  const relative = path.relative(uploadsRoot, file.path).replace(/\\/g, "/");
  return relative || null;
}

function mapRecordTypeFlags(recordTypes = []) {
  return {
    medicalRecords: recordTypes.includes("medical"),
    billingRecords: recordTypes.includes("billing"),
    xrays: recordTypes.includes("xrays"),
    employmentRecords: false,
    otherRecord: false,
    type: recordTypes[0] || "medical",
  };
}

function formatIsoToDisplay(iso) {
  if (!iso) return "";
  const [year, month, day] = `${iso}`.split("-");
  if (!year || !month || !day) return iso;
  return `${month}/${day}/${year}`;
}

async function sendEmailOtp(email) {
  const sessionToken = tokenService.generateSessionToken();
  const code = tokenService.generateOtpCode();
  const expiresMinutes = config.twoFactor?.expiresMinutes || 10;
  const expiresAt = Date.now() + expiresMinutes * 60 * 1000;

  const lastSentAt = twoFactorStore.getLastSentAt(otpSessionKey(sessionToken));
  const cooldownMs = (config.twoFactor?.resendCooldownSeconds || 60) * 1000;

  if (lastSentAt && Date.now() - lastSentAt < cooldownMs) {
    throw new ApiError(429, "Please wait before requesting another code.");
  }

  twoFactorStore.set(otpSessionKey(sessionToken), code, expiresAt);

  await emailService.sendTwoFactorCode({
    to: email,
    name: "Patient",
    code,
    subtitle: "Personal Request Portal",
  });

  if (config.twoFactor?.devLogCode) {
    logger.info("Personal portal OTP (dev)", { email, code });
  }

  return {
    sessionToken,
    maskedEmail: tokenService.maskEmail(email),
    expiresInMinutes: expiresMinutes,
  };
}

async function confirmEmailOtp(sessionToken, code, email) {
  const isValid = twoFactorStore.verify(otpSessionKey(sessionToken), code);

  if (!isValid) {
    throw new ApiError(400, "Invalid or expired verification code.");
  }

  const normalizedEmail = `${email || ""}`.trim().toLowerCase();
  const emailVerificationToken =
    tokenService.generatePersonalPortalEmailToken(normalizedEmail);

  return {
    email: normalizedEmail,
    emailVerificationToken,
    maskedEmail: tokenService.maskEmail(normalizedEmail),
  };
}

async function createPendingRequest(parsed, driverLicenseFile) {
  const verifiedEmail = tokenService.verifyPersonalPortalEmailToken(
    parsed.emailVerificationToken
  );

  if (verifiedEmail !== parsed.email) {
    throw new ApiError(400, "Email verification does not match the submitted email.");
  }

  const licensePath = toRelativeLicensePath(driverLicenseFile);
  if (!licensePath) {
    throw new ApiError(400, "A valid driver's license image is required.");
  }

  const requestId = await PersonalPortalRequest.create({
    email: parsed.email,
    driverLicenseNumber: parsed.driverLicenseNumber,
    driverLicenseStoragePath: licensePath,
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    dob: parsed.dobIso,
    treatingFacilityName: parsed.treatingFacilityName,
    treatingFacilityAddress: parsed.treatingFacilityAddress,
    recordsDateBegin: parsed.recordsDateBeginIso,
    recordsDateEnd: parsed.recordsDateEndIso,
    recordTypesJson: JSON.stringify(parsed.recordTypes),
    deliveryPreference: parsed.deliveryPreference,
    mailAddress: parsed.mailAddress,
    portalStatus: "pending_payment",
    stripeCheckoutSessionId: null,
  });

  const stripe = getStripe();
  const feeCents = config.personalPortal?.processingFeeCents || 3500;
  const baseClient = (config.clientUrl || "http://localhost:3000").replace(/\/$/, "");
  const successUrl = `${baseClient}/personalrequest/result?request_id=${requestId}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseClient}/personalrequest?canceled=1`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: config.stripe.currency || "usd",
          product_data: {
            name: "Personal Records Request — Processing Fee",
            description: "Non-refundable processing fee for personal record request",
          },
          unit_amount: feeCents,
        },
        quantity: 1,
      },
    ],
    customer_email: parsed.email,
    metadata: {
      payment_kind: "personal_portal",
      personal_request_id: String(requestId),
      email: parsed.email,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  const pool = getPool();
  await pool.execute(
    `UPDATE personal_portal_requests
     SET stripe_checkout_session_id = :sessionId, updated_at = NOW()
     WHERE id = :id`,
    { id: requestId, sessionId: session.id }
  );

  return {
    requestId,
    checkoutUrl: session.url,
    sessionId: session.id,
    processingFee: (feeCents / 100).toFixed(2),
  };
}

function parseRecordTypesJson(value) {
  if (Array.isArray(value)) {
    return value.map((item) => `${item || ""}`.trim().toLowerCase()).filter(Boolean);
  }

  if (value && typeof value === "object") {
    return Object.values(value)
      .map((item) => `${item || ""}`.trim().toLowerCase())
      .filter(Boolean);
  }

  const raw = `${value || ""}`.trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => `${item || ""}`.trim().toLowerCase()).filter(Boolean);
    }
    if (typeof parsed === "string" && parsed) {
      return [parsed.toLowerCase()];
    }
  } catch {
    // Stored as a plain type name (e.g. medical) instead of JSON
  }

  if (raw.includes(",")) {
    return raw.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  }

  return [raw.toLowerCase()];
}

async function buildOrderPayloadFromRequest(request, confirmationReference) {
  const recordTypes = parseRecordTypesJson(request.record_types_json);
  const flags = mapRecordTypeFlags(recordTypes);

  return {
    orderNumber: confirmationReference,
    firstName: request.first_name,
    lastName: request.last_name,
    dob: request.dob,
    facilityName: request.treating_facility_name,
    fullAddress: request.treating_facility_address,
    address: request.treating_facility_address,
    email: request.email,
    serveCompanyName: "Personal Request Portal",
    specificDoctor: "Records Department",
    specificRecord: `Records ${formatIsoToDisplay(request.records_date_begin)} to ${formatIsoToDisplay(request.records_date_end)}`,
    injuryType: "cumulative",
    injuryDateBegin: request.records_date_begin,
    injuryDateEnd: request.records_date_end,
    dateRequested: new Date().toISOString().slice(0, 10),
    creationSource: "personal_portal",
    deliveryPreference: request.delivery_preference,
    mailAddress: request.mail_address,
    ...flags,
  };
}

async function fulfillPersonalPortalPayment(session) {
  const requestId = Number(session.metadata?.personal_request_id);
  if (!requestId) {
    logger.warn("Personal portal session missing request id", { sessionId: session.id });
    return;
  }

  const request = await PersonalPortalRequest.findById(requestId);
  if (!request) {
    logger.warn("Personal portal request not found", { requestId });
    return;
  }

  if (request.processing_fee_paid && request.order_id) {
    return;
  }

  const confirmationReference =
    request.confirmation_reference || generateConfirmationReference();
  const lookupExpiresAt = addLookupExpiry(new Date());

  const orderPayload = await buildOrderPayloadFromRequest(request, confirmationReference);
  const order = await orderService.createOrder(
    orderPayload,
    null,
    {},
    {
      allowIncomplete: true,
      creationSource: "personal_portal",
    }
  );

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await Order.createAdditionalDocument(connection, {
      orderId: order.id,
      documentName: "Driver's License",
      originalFileName: path.basename(request.driver_license_storage_path),
      mimeType: "image/jpeg",
      storagePath: request.driver_license_storage_path,
      fileSizeBytes: null,
      uploadedBy: null,
    });

    await PersonalPortalRequest.markPaid(connection, requestId, {
      confirmationReference,
      orderId: order.id,
      portalStatus: "in_process",
      lookupExpiresAt,
    });

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    rethrowServiceError(error);
  } finally {
    connection.release();
  }

  await emailService.sendPersonalPortalConfirmation({
    to: request.email,
    name: `${request.first_name} ${request.last_name}`.trim(),
    confirmationReference,
    lookupExpiresAt,
  });
}

async function getCheckoutResult(requestId, sessionId) {
  const normalizedId = Number(requestId);
  if (!Number.isFinite(normalizedId)) {
    throw new ApiError(400, "Invalid request id");
  }

  const request = await PersonalPortalRequest.findById(normalizedId);
  if (!request) {
    throw new ApiError(404, "Request not found");
  }

  if (!trimOrNull(sessionId)) {
    throw new ApiError(400, "session_id is required");
  }

  if (request.stripe_checkout_session_id !== sessionId) {
    throw new ApiError(400, "Payment session does not match this request");
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status === "paid") {
    await fulfillPersonalPortalPayment(session);
  }

  const updated = await PersonalPortalRequest.findById(normalizedId);

  return mapPublicRequestStatus(updated);
}

async function derivePortalStatus(request, order) {
  if (!request || !order) {
    return request?.portal_status || "pending_payment";
  }

  const records = await OrderRecord.findByOrderId(order.id);
  const hasRecordFiles = records.some((record) => record.storage_path);

  if (
    hasRecordFiles &&
    ["Ready", "Completed", "Ready to Pickup"].includes(order.status)
  ) {
    return "released";
  }

  return request.portal_status || "in_process";
}

function assertLookupNotExpired(request) {
  if (!request?.lookup_expires_at) {
    throw new ApiError(410, "Status lookup is no longer available for this request.");
  }

  if (new Date(request.lookup_expires_at) < new Date()) {
    throw new ApiError(
      410,
      "Status lookup has expired. Please contact support if you need assistance."
    );
  }
}

async function lookupRequestStatus({ confirmationReference, driverLicenseNumber }) {
  let request = null;

  if (confirmationReference) {
    request = await PersonalPortalRequest.findByConfirmationReference(
      confirmationReference
    );
  } else if (driverLicenseNumber) {
    request = await PersonalPortalRequest.findByDriverLicenseNumber(driverLicenseNumber);
  }

  if (!request) {
    throw new ApiError(404, "No request found with the information provided.");
  }

  if (!request.processing_fee_paid) {
    throw new ApiError(400, "This request has not been submitted and paid yet.");
  }

  assertLookupNotExpired(request);

  return mapPublicRequestStatus(request);
}

async function mapPublicRequestStatus(request) {
  let order = null;
  if (request.order_id) {
    order = await Order.findById(request.order_id);
  }

  const portalStatus = await derivePortalStatus(request, order);
  const statusLabel = PORTAL_STATUS_LABELS[portalStatus] || portalStatus;

  let downloadUrl = null;
  if (portalStatus === "released" && request.order_id) {
    try {
      const link = await recordDownloadService.createDownloadLinkForOrder(
        request.order_id
      );
      downloadUrl = `${(config.clientUrl || "http://localhost:3000").replace(/\/$/, "")}/download/records/${link.token}`;
    } catch (error) {
      logger.warn("Unable to create download link for personal portal request", {
        requestId: request.id,
        message: error.message,
      });
    }
  }

  return {
    confirmationReference: request.confirmation_reference,
    status: portalStatus,
    statusLabel,
    firstName: request.first_name,
    lastName: request.last_name,
    email: tokenService.maskEmail(request.email),
    treatingFacilityName: request.treating_facility_name,
    recordsDateBegin: formatIsoToDisplay(request.records_date_begin),
    recordsDateEnd: formatIsoToDisplay(request.records_date_end),
    recordTypes: parseRecordTypesJson(request.record_types_json),
    deliveryPreference: request.delivery_preference,
    lookupExpiresAt: request.lookup_expires_at,
    canDownload: portalStatus === "released" && Boolean(downloadUrl),
    downloadUrl,
    orderId: request.order_id,
  };
}

module.exports = {
  sendEmailOtp,
  confirmEmailOtp,
  createPendingRequest,
  fulfillPersonalPortalPayment,
  getCheckoutResult,
  lookupRequestStatus,
  PORTAL_STATUS_LABELS,
};
