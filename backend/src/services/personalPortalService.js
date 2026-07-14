/**
 * Personal Request Portal — email OTP, request submission, Stripe $35 fee, order creation.
 * Persists to personal_request_orders + facilities + order_records tables.
 */

const crypto = require("crypto");
const path = require("path");
const Stripe = require("stripe");

const config = require("../config");
const ApiError = require("../utils/ApiError");
const { rethrowServiceError } = require("../utils/serviceErrorUtils");
const { getPool } = require("../config/database");
const PersonalRequestOrder = require("../models/PersonalRequestOrder");
const PersonalRequestFacility = require("../models/PersonalRequestFacility");
const PersonalRequestOrderRecord = require("../models/PersonalRequestOrderRecord");
const PersonalRequestStripePayment = require("../models/PersonalRequestStripePayment");
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

async function loadRequestBundle(orderId) {
  const order = await PersonalRequestOrder.findById(orderId);
  if (!order) return null;

  const facilities = await PersonalRequestFacility.findByOrderId(orderId);
  const recordRows = await PersonalRequestOrderRecord.findByOrderId(orderId);
  const primaryFacility = facilities[0] || null;
  const recordTypes = [
    ...new Set(recordRows.map((row) => row.record_type).filter(Boolean)),
  ];

  return {
    order,
    facilities,
    primaryFacility,
    recordRows,
    recordTypes,
  };
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

  const pool = getPool();
  const connection = await pool.getConnection();
  let requestId;

  try {
    await connection.beginTransaction();

    requestId = await PersonalRequestOrder.create(
      {
        email: parsed.email,
        driverLicenseNumber: parsed.driverLicenseNumber,
        driverLicenseStoragePath: licensePath,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        dob: parsed.dobIso,
        deliveryPreference: parsed.deliveryPreference,
        mailAddress: parsed.mailAddress,
        portalStatus: "pending_payment",
        stripeCheckoutSessionId: null,
      },
      connection
    );

    const facilityRowId = await PersonalRequestFacility.create(
      {
        personalRequestOrderId: requestId,
        facilityId: parsed.facilityId || null,
        facilityName: parsed.treatingFacilityName,
        facilityAddress: parsed.treatingFacilityAddress,
        recordsDateBegin: parsed.recordsDateBeginIso,
        recordsDateEnd: parsed.recordsDateEndIso,
        sortOrder: 0,
      },
      connection
    );

    await PersonalRequestOrderRecord.createMany(
      (parsed.recordTypes || []).map((recordType) => ({
        personalRequestOrderId: requestId,
        personalRequestFacilityId: facilityRowId,
        recordType,
      })),
      connection
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    rethrowServiceError(error);
  } finally {
    connection.release();
  }

  const stripe = getStripe();
  const feeCents = config.personalPortal?.processingFeeCents || 3500;
  const feeAmount = Number((feeCents / 100).toFixed(2));
  const currency = config.stripe.currency || "usd";
  const baseClient = (config.clientUrl || "http://localhost:3000").replace(/\/$/, "");
  const successUrl = `${baseClient}/personalrequest/result?request_id=${requestId}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseClient}/personalrequest?canceled=1`;

  const checkoutPayload = {
    mode: "payment",
    payment_method_types: ["card"],
    // Skip Link (email OTP / Continue with Link) — card form only
    wallet_options: {
      link: {
        display: "never",
      },
    },
    line_items: [
      {
        price_data: {
          currency,
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
      amount: String(feeAmount),
      currency,
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  let session;
  try {
    session = await stripe.checkout.sessions.create(checkoutPayload);
  } catch (error) {
    // Older Stripe API versions may not support wallet_options — retry without it
    if (/wallet_options|unknown parameter/i.test(error?.message || "")) {
      const { wallet_options: _ignored, ...fallbackPayload } = checkoutPayload;
      session = await stripe.checkout.sessions.create(fallbackPayload);
      logger.warn(
        "Stripe wallet_options not supported; checkout created without Link disable"
      );
    } else {
      throw error;
    }
  }

  await PersonalRequestOrder.setStripeCheckoutSessionId(requestId, session.id);

  await PersonalRequestStripePayment.createPending({
    personalRequestOrderId: requestId,
    amount: feeAmount,
    currency,
    stripeCheckoutSessionId: session.id,
    customerEmail: parsed.email,
    customerName: `${parsed.firstName} ${parsed.lastName}`.trim(),
  });

  return {
    requestId,
    checkoutUrl: session.url,
    sessionId: session.id,
    processingFee: feeAmount.toFixed(2),
  };
}

function buildOrderPayloadFromBundle(bundle, confirmationReference) {
  const { order, primaryFacility, recordTypes } = bundle;
  const flags = mapRecordTypeFlags(recordTypes);

  return {
    orderNumber: confirmationReference,
    firstName: order.first_name,
    lastName: order.last_name,
    dob: order.dob,
    facility: primaryFacility?.facility_id
      ? String(primaryFacility.facility_id)
      : undefined,
    facilityName: primaryFacility?.facility_name,
    facilityAddress: primaryFacility?.facility_address,
    fullAddress: primaryFacility?.facility_address,
    address: primaryFacility?.facility_address,
    email: order.email,
    serveCompanyName: "Personal Request Portal",
    specificDoctor: "Records Department",
    specificRecord: `Records ${formatIsoToDisplay(primaryFacility?.records_date_begin)} to ${formatIsoToDisplay(primaryFacility?.records_date_end)}`,
    injuryType: "cumulative",
    injuryDateBegin: primaryFacility?.records_date_begin,
    injuryDateEnd: primaryFacility?.records_date_end,
    dateRequested: new Date().toISOString().slice(0, 10),
    creationSource: "personal_portal",
    deliveryPreference: order.delivery_preference,
    mailAddress: order.mail_address,
    ...flags,
  };
}

async function fulfillPersonalPortalPayment(session) {
  const requestId = Number(session.metadata?.personal_request_id);
  if (!requestId) {
    logger.warn("Personal portal session missing request id", { sessionId: session.id });
    return;
  }

  const bundle = await loadRequestBundle(requestId);
  if (!bundle?.order) {
    logger.warn("Personal portal request not found", { requestId });
    return;
  }

  const { order } = bundle;

  if (order.processing_fee_paid && order.order_id) {
    return;
  }

  const confirmationReference =
    order.confirmation_reference || generateConfirmationReference();
  const lookupExpiresAt = addLookupExpiry(new Date());

  const orderPayload = buildOrderPayloadFromBundle(bundle, confirmationReference);
  const dmsOrder = await orderService.createOrder(
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
      orderId: dmsOrder.id,
      documentName: "Driver's License",
      originalFileName: path.basename(order.driver_license_storage_path),
      mimeType: "image/jpeg",
      storagePath: order.driver_license_storage_path,
      fileSizeBytes: null,
      uploadedBy: null,
    });

    await PersonalRequestOrder.markPaid(connection, requestId, {
      confirmationReference,
      orderId: dmsOrder.id,
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
    to: order.email,
    name: `${order.first_name} ${order.last_name}`.trim(),
    confirmationReference,
    lookupExpiresAt,
  });

  // Persist Stripe payment details (idempotent; also called from webhook path)
  try {
    const stripePaymentService = require("./stripePaymentService");
    await stripePaymentService.recordPersonalPortalStripePayment(session);
  } catch (error) {
    logger.warn("Failed to record personal portal Stripe payment", {
      requestId,
      sessionId: session.id,
      message: error.message,
    });
  }
}

async function getCheckoutResult(requestId, sessionId) {
  const normalizedId = Number(requestId);
  if (!Number.isFinite(normalizedId)) {
    throw new ApiError(400, "Invalid request id");
  }

  const bundle = await loadRequestBundle(normalizedId);
  if (!bundle?.order) {
    throw new ApiError(404, "Request not found");
  }

  if (!trimOrNull(sessionId)) {
    throw new ApiError(400, "session_id is required");
  }

  if (bundle.order.stripe_checkout_session_id !== sessionId) {
    throw new ApiError(400, "Payment session does not match this request");
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.payment_status === "paid") {
    await fulfillPersonalPortalPayment(session);
  }

  const updated = await loadRequestBundle(normalizedId);
  return mapPublicRequestStatus(updated);
}

async function derivePortalStatus(requestOrder, dmsOrder) {
  if (!requestOrder || !dmsOrder) {
    return requestOrder?.portal_status || "pending_payment";
  }

  const records = await OrderRecord.findByOrderId(dmsOrder.id);
  const hasRecordFiles = records.some((record) => record.storage_path);

  if (
    hasRecordFiles &&
    ["Ready", "Completed", "Ready to Pickup"].includes(dmsOrder.status)
  ) {
    return "released";
  }

  return requestOrder.portal_status || "in_process";
}

function assertLookupNotExpired(requestOrder) {
  if (!requestOrder?.lookup_expires_at) {
    throw new ApiError(410, "Status lookup is no longer available for this request.");
  }

  if (new Date(requestOrder.lookup_expires_at) < new Date()) {
    throw new ApiError(
      410,
      "Status lookup has expired. Please contact support if you need assistance."
    );
  }
}

async function lookupRequestStatus({ confirmationReference, driverLicenseNumber }) {
  let requestOrder = null;

  if (confirmationReference) {
    requestOrder = await PersonalRequestOrder.findByConfirmationReference(
      confirmationReference
    );
  } else if (driverLicenseNumber) {
    requestOrder = await PersonalRequestOrder.findByDriverLicenseNumber(
      driverLicenseNumber
    );
  }

  if (!requestOrder) {
    throw new ApiError(404, "No request found with the information provided.");
  }

  if (!requestOrder.processing_fee_paid) {
    throw new ApiError(400, "This request has not been submitted and paid yet.");
  }

  assertLookupNotExpired(requestOrder);

  const bundle = await loadRequestBundle(requestOrder.id);
  return mapPublicRequestStatus(bundle);
}

async function mapPublicRequestStatus(bundle) {
  const order = bundle?.order;
  if (!order) {
    throw new ApiError(404, "Request not found");
  }

  const primaryFacility = bundle.primaryFacility;
  const recordTypes = bundle.recordTypes || [];

  let dmsOrder = null;
  if (order.order_id) {
    dmsOrder = await Order.findById(order.order_id);
  }

  const portalStatus = await derivePortalStatus(order, dmsOrder);
  const statusLabel = PORTAL_STATUS_LABELS[portalStatus] || portalStatus;

  let downloadUrl = null;
  if (portalStatus === "released" && order.order_id) {
    try {
      const link = await recordDownloadService.createDownloadLinkForOrder(
        order.order_id
      );
      downloadUrl = `${(config.clientUrl || "http://localhost:3000").replace(/\/$/, "")}/download/records/${link.token}`;
    } catch (error) {
      logger.warn("Unable to create download link for personal portal request", {
        requestId: order.id,
        message: error.message,
      });
    }
  }

  const stripePayments = await PersonalRequestStripePayment.findByPersonalRequestOrderId(
    order.id
  );
  const latestPayment = stripePayments[0] || null;

  return {
    confirmationReference: order.confirmation_reference,
    status: portalStatus,
    statusLabel,
    firstName: order.first_name,
    lastName: order.last_name,
    email: tokenService.maskEmail(order.email),
    treatingFacilityName: primaryFacility?.facility_name || null,
    recordsDateBegin: formatIsoToDisplay(primaryFacility?.records_date_begin),
    recordsDateEnd: formatIsoToDisplay(primaryFacility?.records_date_end),
    recordTypes,
    deliveryPreference: order.delivery_preference,
    lookupExpiresAt: order.lookup_expires_at,
    canDownload: portalStatus === "released" && Boolean(downloadUrl),
    downloadUrl,
    orderId: order.order_id,
    payment: latestPayment
      ? {
          status: latestPayment.status,
          amount: Number(latestPayment.amount),
          currency: latestPayment.currency,
          paidAt: latestPayment.paid_at,
          cardBrand: latestPayment.card_brand,
          cardLast4: latestPayment.card_last4,
          receiptUrl: latestPayment.receipt_url,
          stripePaymentIntentId: latestPayment.stripe_payment_intent_id,
        }
      : null,
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
