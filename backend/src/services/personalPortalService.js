/**
 * Personal Request Portal — $35 prepayment, then staff invoice/payment via DMS.
 * Portal request lives in personal_request_*; a linked thin DMS order enables
 * existing Invoice / Payments UI for additional charges.
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
const PersonalPortalUser = require("../models/PersonalPortalUser");
const Order = require("../models/Order");
const OrderRecord = require("../models/OrderRecord");
const {
  areAllOrderInvoicesPaidFromRows,
  hasStandardInvoiceFields,
  hasXrayInvoiceFields,
} = require("../utils/orderInvoicePayment");
const Invoice = require("../models/Invoice");
const InvoiceXray = require("../models/InvoiceXray");
const RecordDownloadLink = require("../models/RecordDownloadLink");
const twoFactorStore = require("./twoFactorStore");
const tokenService = require("./tokenService");
const emailService = require("./emailService");
const orderService = require("./orderService");
const recordDownloadService = require("./recordDownloadService");
const {
  normalizeStoredDob,
} = require("../validators/personalPortalValidator");
const logger = require("../utils/logger");

let stripeClient = null;

const PORTAL_STATUS_LABELS = {
  pending_payment: "Pending Payment",
  in_process: "In Process",
  invoice: "Invoice",
  paid: "Paid",
  released: "Released",
};

const STATUS_RANK = {
  pending_payment: 0,
  in_process: 1,
  invoice: 2,
  paid: 3,
  released: 4,
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

function formatIsoToDisplay(iso) {
  if (!iso) return "";
  const [year, month, day] = `${iso}`.split("-");
  if (!year || !month || !day) return iso;
  return `${month}/${day}/${year}`;
}

function getProcessingFeeAmount() {
  return (config.personalPortal?.processingFeeCents || 3500) / 100;
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
    facilityName: primaryFacility?.facility_name || "Personal Request Facility",
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

async function loadRequestBundles(orders = []) {
  if (!orders.length) return [];

  const orderIds = orders.map((order) => order.id);
  const [facilities, recordRows] = await Promise.all([
    PersonalRequestFacility.findByOrderIds(orderIds),
    PersonalRequestOrderRecord.findByOrderIds(orderIds),
  ]);

  const facilitiesByOrderId = new Map();
  for (const facility of facilities) {
    const key = facility.personal_request_order_id;
    if (!facilitiesByOrderId.has(key)) facilitiesByOrderId.set(key, []);
    facilitiesByOrderId.get(key).push(facility);
  }

  const recordsByOrderId = new Map();
  for (const record of recordRows) {
    const key = record.personal_request_order_id;
    if (!recordsByOrderId.has(key)) recordsByOrderId.set(key, []);
    recordsByOrderId.get(key).push(record);
  }

  return orders.map((order) => {
    const orderFacilities = facilitiesByOrderId.get(order.id) || [];
    const orderRecords = recordsByOrderId.get(order.id) || [];
    return {
      order,
      facilities: orderFacilities,
      primaryFacility: orderFacilities[0] || null,
      recordRows: orderRecords,
      recordTypes: [
        ...new Set(orderRecords.map((row) => row.record_type).filter(Boolean)),
      ],
    };
  });
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

async function createPendingRequest(parsed, driverLicenseFile, options = {}) {
  const portalUserId = options.portalUserId || null;

  if (portalUserId) {
    // Authenticated account — email comes from the signed-in user
    if (!parsed.email) {
      throw new ApiError(400, "Account email is required.");
    }
  } else {
    const verifiedEmail = tokenService.verifyPersonalPortalEmailToken(
      parsed.emailVerificationToken
    );

    if (verifiedEmail !== parsed.email) {
      throw new ApiError(400, "Email verification does not match the submitted email.");
    }
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
        portalUserId,
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
        facilityName: parsed.treatingFacilityName || "",
        facilityAddress: parsed.treatingFacilityAddress,
        treatingDoctor: parsed.treatingDoctor || null,
        isManualLookup: Boolean(parsed.isManualLookup),
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
  const cancelUrl = `${baseClient}/personalrequest/new?canceled=1`;

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
    paymentKind: "processing_fee",
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

  // Already prepaid and linked for staff invoice/payment ops
  if (order.processing_fee_paid && order.order_id) {
    return;
  }

  const confirmationReference =
    order.confirmation_reference || generateConfirmationReference();
  const lookupExpiresAt = addLookupExpiry(new Date());
  const feeAmount = getProcessingFeeAmount();

  let dmsOrderId = order.order_id || null;

  if (!dmsOrderId) {
    const orderPayload = buildOrderPayloadFromBundle(bundle, confirmationReference);
    const dmsOrder = await orderService.createOrder(
      {
        ...orderPayload,
        prepaymentPaid: feeAmount,
        prepaymentDue: 0,
        prepaymentMemo: "Personal portal processing fee",
        prepaymentDate: new Date().toISOString().slice(0, 10),
        prepaymentCheck: "STRIPE-PORTAL",
      },
      null,
      {},
      {
        allowIncomplete: true,
        creationSource: "personal_portal",
      }
    );
    dmsOrderId = dmsOrder.id;
  }

  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (order.driver_license_storage_path) {
      await Order.createAdditionalDocument(connection, {
        orderId: dmsOrderId,
        documentName: "Driver's License",
        originalFileName: path.basename(order.driver_license_storage_path),
        mimeType: "image/jpeg",
        storagePath: order.driver_license_storage_path,
        fileSizeBytes: null,
        uploadedBy: null,
      });
    }

    await Order.upsertPayment(connection, {
      orderId: dmsOrderId,
      paymentType: "prepayment",
      checkNumber: "STRIPE-PORTAL",
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: feeAmount,
      dueAmount: 0,
      isPaid: 1,
      memo: "Personal portal processing fee ($35 prepayment)",
    });

    await PersonalRequestOrder.markPaid(connection, requestId, {
      confirmationReference,
      orderId: dmsOrderId,
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

  try {
    await emailService.sendPersonalPortalConfirmation({
      to: order.email,
      name: `${order.first_name} ${order.last_name}`.trim(),
      confirmationReference,
      lookupExpiresAt,
    });
  } catch (error) {
    // Payment is already committed — never fail checkout on email issues.
    logger.error("Personal portal confirmation email failed after payment", {
      requestId,
      to: order.email,
      message: error.message,
    });
  }

  // Facility search fee ($5) is added on the DMS invoice and the personal user
  // is only asked to pay when that invoice is created and sent (email/system).

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

/**
 * Keep personal portal_status in sync with DMS invoice / payment / release.
 * Called from write paths (invoice/payment/records), not from list reads.
 */
async function syncPortalStatusForDmsOrder(orderId, existingRequest = null) {
  const normalizedId = Number(orderId);
  if (!Number.isFinite(normalizedId)) return null;

  const request =
    existingRequest || (await PersonalRequestOrder.findByOrderId(normalizedId));
  if (!request?.processing_fee_paid) return null;

  const nextStatus = await computePortalStatusForLinkedOrder(
    normalizedId,
    request
  );
  if (!nextStatus) return request.portal_status;

  const currentRank = STATUS_RANK[request.portal_status] ?? 0;
  const nextRank = STATUS_RANK[nextStatus] ?? 0;
  // Allow moving back from released if records were removed
  if (nextRank < currentRank && request.portal_status !== "released") {
    return request.portal_status;
  }

  if (nextStatus === "released") {
    // Already released with a download token — skip reminting on every sync
    if (
      request.portal_status === "released" &&
      request.released_download_token
    ) {
      return "released";
    }

    try {
      const link = await recordDownloadService.createDownloadLinkForOrder(
        normalizedId
      );
      await PersonalRequestOrder.setReleasedDownloadToken(
        request.id,
        link.token
      );
    } catch (error) {
      logger.warn("Unable to create release download link for personal request", {
        requestId: request.id,
        orderId: normalizedId,
        message: error.message,
      });
      if (request.portal_status !== "released") {
        await PersonalRequestOrder.updatePortalStatus(request.id, "released");
      }
    }
  } else if (nextStatus !== request.portal_status) {
    await PersonalRequestOrder.updatePortalStatus(request.id, nextStatus);
  }

  return nextStatus;
}

async function computePortalStatusForLinkedOrder(orderId, requestOrder) {
  const dmsOrder = await Order.findById(orderId);
  if (!dmsOrder) {
    return requestOrder?.portal_status || "in_process";
  }

  const [invoice, xray, records] = await Promise.all([
    Invoice.findByOrderId(orderId),
    InvoiceXray.findByOrderId(orderId),
    OrderRecord.findByOrderId(orderId),
  ]);

  const hasInvoice =
    hasStandardInvoiceFields(invoice) || hasXrayInvoiceFields(xray);
  const allPaid = hasInvoice
    ? areAllOrderInvoicesPaidFromRows(invoice, xray)
    : false;
  const hasRecordFiles = (records || []).some((record) => record.storage_path);

  // Released only when records are ready AND any created invoice is fully paid.
  // Unpaid invoice must stay on Invoice (or Paid when paid) — never Released.
  if (hasRecordFiles && (!hasInvoice || allPaid)) {
    return "released";
  }
  if (hasInvoice && allPaid) {
    return "paid";
  }
  if (hasInvoice) {
    return "invoice";
  }
  return "in_process";
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
  return mapPublicRequestStatus(updated, {
    syncStatus: false,
    includePayment: true,
    resolveDownloadLink: true,
  });
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

async function lookupRequestStatus({ confirmationReference, dobIso }) {
  const requestOrder = await PersonalRequestOrder.findByConfirmationReference(
    confirmationReference
  );

  if (!requestOrder) {
    throw new ApiError(404, "No request found with the information provided.");
  }

  const storedDob = normalizeStoredDob(requestOrder.dob);

  if (!storedDob || storedDob !== dobIso) {
    throw new ApiError(404, "No request found with the information provided.");
  }

  if (!requestOrder.processing_fee_paid) {
    throw new ApiError(400, "This request has not been submitted and paid yet.");
  }

  assertLookupNotExpired(requestOrder);

  const bundle = await loadRequestBundle(requestOrder.id);
  return mapPublicRequestStatus(bundle, {
    syncStatus: true,
    includePayment: true,
    resolveDownloadLink: true,
  });
}

async function updateRequestNotificationEmail({
  confirmationReference,
  dobIso,
  email,
}) {
  const requestOrder = await PersonalRequestOrder.findByConfirmationReference(
    confirmationReference
  );

  if (!requestOrder) {
    throw new ApiError(404, "No request found with the information provided.");
  }

  const storedDob = normalizeStoredDob(requestOrder.dob);

  if (!storedDob || storedDob !== dobIso) {
    throw new ApiError(404, "No request found with the information provided.");
  }

  if (!requestOrder.processing_fee_paid) {
    throw new ApiError(400, "This request has not been submitted and paid yet.");
  }

  assertLookupNotExpired(requestOrder);

  await PersonalRequestOrder.updateEmail(requestOrder.id, email);

  if (requestOrder.portal_user_id) {
    const existing = await PersonalPortalUser.findByEmail(email);
    if (existing && existing.id !== requestOrder.portal_user_id) {
      // Keep account email as-is when another account already owns this address.
    } else {
      await PersonalPortalUser.updateEmail(requestOrder.portal_user_id, email);
    }
  }

  return {
    confirmationReference: requestOrder.confirmation_reference,
    email: tokenService.maskEmail(email),
    message: "Notification email updated. Future updates will go to this address.",
  };
}

async function mapPublicRequestStatus(bundle, options = {}) {
  const {
    syncStatus = false,
    includePayment = false,
    resolveDownloadLink = false,
  } = options;
  const order = bundle?.order;
  if (!order) {
    throw new ApiError(404, "Request not found");
  }

  const primaryFacility = bundle.primaryFacility;
  const recordTypes = bundle.recordTypes || [];

  let portalStatus = order.portal_status || "pending_payment";
  let refreshed = order;

  if (syncStatus && order.order_id && order.processing_fee_paid) {
    const synced =
      (await syncPortalStatusForDmsOrder(order.order_id, order)) || portalStatus;
    portalStatus = synced;
    // Re-read only when sync may have written token/status
    if (synced !== order.portal_status || synced === "released") {
      refreshed = (await PersonalRequestOrder.findById(order.id)) || order;
      portalStatus = refreshed.portal_status || portalStatus;
    }
  }

  const statusLabel = PORTAL_STATUS_LABELS[portalStatus] || portalStatus;

  let downloadUrl = null;
  let downloadToken = null;
  let downloadExpiresAt = null;

  if (portalStatus === "released") {
    downloadToken = refreshed.released_download_token || null;

    if (resolveDownloadLink && order.order_id) {
      try {
        if (downloadToken) {
          const linkRow = await RecordDownloadLink.findByToken(downloadToken);
          if (
            !linkRow ||
            (linkRow.expires_at && new Date(linkRow.expires_at) < new Date())
          ) {
            downloadToken = null;
          } else {
            downloadExpiresAt = linkRow.expires_at || null;
          }
        }

        if (!downloadToken) {
          const link = await recordDownloadService.createDownloadLinkForOrder(
            order.order_id
          );
          downloadToken = link.token;
          downloadExpiresAt = link.expiresAt || null;
          await PersonalRequestOrder.setReleasedDownloadToken(
            order.id,
            downloadToken
          );
        }

        downloadUrl = `${(config.clientUrl || "http://localhost:3000").replace(/\/$/, "")}/download/records/${downloadToken}`;
      } catch (error) {
        logger.warn("Unable to create download link for personal portal request", {
          requestId: order.id,
          message: error.message,
        });
        downloadToken = null;
      }
    } else if (downloadToken) {
      downloadUrl = `${(config.clientUrl || "http://localhost:3000").replace(/\/$/, "")}/download/records/${downloadToken}`;
    }
  }

  let payment = null;
  if (includePayment) {
    const stripePayments =
      await PersonalRequestStripePayment.findByPersonalRequestOrderId(order.id);
    const latestPayment = stripePayments[0] || null;
    payment = latestPayment
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
      : null;
  }

  return {
    id: order.id,
    confirmationReference: order.confirmation_reference,
    status: portalStatus,
    statusLabel,
    firstName: order.first_name,
    lastName: order.last_name,
    email: includePayment ? tokenService.maskEmail(order.email) : undefined,
    treatingFacilityName:
      primaryFacility?.facility_name || order.treating_facility_name || null,
    recordsDateBegin: formatIsoToDisplay(
      primaryFacility?.records_date_begin || order.records_date_begin
    ),
    recordsDateEnd: formatIsoToDisplay(
      primaryFacility?.records_date_end || order.records_date_end
    ),
    recordTypes: includePayment ? recordTypes : undefined,
    deliveryPreference: includePayment ? order.delivery_preference : undefined,
    lookupExpiresAt: includePayment ? order.lookup_expires_at : undefined,
    canDownload: portalStatus === "released" && Boolean(downloadToken),
    downloadUrl: downloadUrl || undefined,
    downloadToken: downloadToken || undefined,
    downloadExpiresAt: downloadExpiresAt || undefined,
    orderId: includePayment ? order.order_id || null : undefined,
    createdAt: order.created_at,
    payment,
    researchFee: mapResearchFee(refreshed || order),
  };
}

function mapListRequest(bundle) {
  const order = bundle?.order;
  if (!order) return null;

  const primaryFacility = bundle.primaryFacility;
  const portalStatus = order.portal_status || "pending_payment";
  const downloadToken =
    portalStatus === "released" ? order.released_download_token || null : null;

  return {
    id: order.id,
    confirmationReference: order.confirmation_reference,
    status: portalStatus,
    statusLabel: PORTAL_STATUS_LABELS[portalStatus] || portalStatus,
    treatingFacilityName:
      primaryFacility?.facility_name || order.treating_facility_name || null,
    recordsDateBegin: formatIsoToDisplay(
      primaryFacility?.records_date_begin || order.records_date_begin
    ),
    recordsDateEnd: formatIsoToDisplay(
      primaryFacility?.records_date_end || order.records_date_end
    ),
    canDownload: portalStatus === "released" && Boolean(downloadToken),
    downloadToken: downloadToken || undefined,
    downloadUrl: downloadToken
      ? `${(config.clientUrl || "http://localhost:3000").replace(/\/$/, "")}/download/records/${downloadToken}`
      : undefined,
    orderId: order.order_id || null,
    prepaymentReceiptUrl: null,
    invoiceReceiptUrl: null,
    invoiceSent: false,
    invoicePaid: false,
    canViewInvoice: false,
    canPayInvoice: false,
    paymentUrl: null,
    lookupExpiresAt: order.lookup_expires_at || null,
    createdAt: order.created_at,
    researchFee: mapResearchFee(order),
  };
}

async function syncPortalStatusesForPortalUser(portalUserId) {
  const rows = await PersonalRequestOrder.findLinkedForStatusSync(portalUserId);
  if (!rows.length) return;

  await Promise.all(
    rows.map((row) =>
      syncPortalStatusForDmsOrder(row.order_id, row).catch(() => null)
    )
  );
}

async function syncPortalStatusesForRequestRows(rows = []) {
  const linked = (rows || []).filter(
    (row) => row?.processing_fee_paid && Number(row.order_id) > 0
  );
  if (!linked.length) return rows;

  await Promise.all(
    linked.map((row) =>
      syncPortalStatusForDmsOrder(row.order_id, row).catch(() => null)
    )
  );

  const refreshed = await PersonalRequestOrder.findByIds(
    rows.map((row) => row.id)
  );
  const refreshedById = refreshed.reduce((acc, row) => {
    acc[row.id] = row;
    return acc;
  }, {});

  return rows.map((row) => refreshedById[row.id] || row);
}

function pickPrepaymentPayment(payments = []) {
  return (
    payments.find(
      (row) =>
        row.status === "succeeded" &&
        `${row.payment_kind || "processing_fee"}` !== "research_fee"
    ) ||
    payments.find(
      (row) =>
        row.status === "succeeded" &&
        `${row.payment_kind || ""}` !== "research_fee"
    ) ||
    null
  );
}

function pickFacilityFeePayment(payments = []) {
  return (
    payments.find(
      (row) =>
        row.status === "succeeded" &&
        `${row.payment_kind || ""}` === "research_fee"
    ) || null
  );
}

async function attachPaymentActionFields(requests) {
  const {
    hasStandardInvoiceFields,
  } = require("../utils/orderInvoicePayment");
  const stripePaymentService = require("./stripePaymentService");
  const pool = getPool();

  const validRequests = (requests || []).filter((request) => request?.id);
  if (!validRequests.length) return requests || [];

  const requestIds = validRequests.map((request) => request.id);
  const dmsOrderIds = [
    ...new Set(
      validRequests
        .map((request) => Number(request.orderId))
        .filter((orderId) => Number.isFinite(orderId) && orderId > 0)
    ),
  ];

  const [paymentsByRequestId, invoicesByOrderId] = await Promise.all([
    PersonalRequestStripePayment.findByPersonalRequestOrderIds(requestIds),
    dmsOrderIds.length ? Invoice.findByOrderIds(dmsOrderIds) : Promise.resolve({}),
  ]);

  const payableOrderIds = dmsOrderIds.filter((orderId) => {
    const invoice = invoicesByOrderId[orderId];
    if (!invoice || !hasStandardInvoiceFields(invoice)) return false;
    if (!invoice.sent_date) return false;
    const due = Number(invoice.amount_due) || 0;
    const paid = `${invoice.status || ""}`.toLowerCase() === "paid" || due <= 0;
    return !paid && due > 0;
  });

  const paidInvoiceOrderIds = dmsOrderIds.filter((orderId) => {
    const invoice = invoicesByOrderId[orderId];
    if (!invoice || !hasStandardInvoiceFields(invoice)) return false;
    const due = Number(invoice.amount_due) || 0;
    return (
      `${invoice.status || ""}`.toLowerCase() === "paid" || due <= 0
    );
  });

  const [paymentTokensByOrderId, stripeInvoicePaymentsByOrderId] = await Promise.all([
    payableOrderIds.length
      ? (async () => {
          const placeholders = payableOrderIds
            .map((_, index) => `:orderId${index}`)
            .join(", ");
          const params = payableOrderIds.reduce((acc, orderId, index) => {
            acc[`orderId${index}`] = orderId;
            return acc;
          }, {});
          const [rows] = await pool.execute(
            `SELECT order_id, token
             FROM invoice_payment_access_tokens
             WHERE order_id IN (${placeholders})`,
            params
          );
          return rows.reduce((acc, row) => {
            acc[row.order_id] = row.token;
            return acc;
          }, {});
        })()
      : Promise.resolve({}),
    paidInvoiceOrderIds.length
      ? (async () => {
          const placeholders = paidInvoiceOrderIds
            .map((_, index) => `:orderId${index}`)
            .join(", ");
          const params = paidInvoiceOrderIds.reduce((acc, orderId, index) => {
            acc[`orderId${index}`] = orderId;
            return acc;
          }, {});
          const [rows] = await pool.execute(
            `SELECT order_id, receipt_url
             FROM stripe_online_payments
             WHERE order_id IN (${placeholders})
               AND status = 'succeeded'
               AND invoice_type IN ('regular', 'personal_portal')
             ORDER BY paid_at DESC, id DESC`,
            params
          );
          return rows.reduce((acc, row) => {
            if (!acc[row.order_id]) {
              acc[row.order_id] = {
                receiptUrl: row.receipt_url || null,
              };
            }
            return acc;
          }, {});
        })()
      : Promise.resolve({}),
  ]);

  const missingTokenOrderIds = payableOrderIds.filter(
    (orderId) => !paymentTokensByOrderId[orderId]
  );
  if (missingTokenOrderIds.length) {
    await Promise.all(
      missingTokenOrderIds.map(async (orderId) => {
        try {
          paymentTokensByOrderId[orderId] =
            await stripePaymentService.ensurePaymentAccessToken(orderId);
        } catch {
          paymentTokensByOrderId[orderId] = null;
        }
      })
    );
  }

  const baseClient = (config.clientUrl || "http://localhost:3000").replace(
    /\/$/,
    ""
  );

  return (requests || []).map((request) => {
    if (!request?.id) return request;

    const prepayment = pickPrepaymentPayment(
      paymentsByRequestId[request.id] || []
    );
    const facilityFeePayment = pickFacilityFeePayment(
      paymentsByRequestId[request.id] || []
    );

    let invoiceSent = false;
    let invoicePaid = false;
    let canViewInvoice = false;
    let canPayInvoice = false;
    let invoiceReceiptUrl = null;
    let paymentUrl = null;

    const dmsOrderId = Number(request.orderId);
    if (Number.isFinite(dmsOrderId) && dmsOrderId > 0) {
      const invoice = invoicesByOrderId[dmsOrderId];
      if (invoice && hasStandardInvoiceFields(invoice)) {
        invoiceSent = Boolean(invoice.sent_date);
        const due = Number(invoice.amount_due) || 0;
        invoicePaid =
          `${invoice.status || ""}`.toLowerCase() === "paid" || due <= 0;
        canPayInvoice = invoiceSent && !invoicePaid && due > 0;

        if (canPayInvoice) {
          const token = paymentTokensByOrderId[dmsOrderId];
          paymentUrl = token ? `${baseClient}/pay/${token}` : null;
        }

        if (invoicePaid) {
          const stripePayment = stripeInvoicePaymentsByOrderId[dmsOrderId];
          if (stripePayment) {
            invoiceReceiptUrl = stripePayment.receiptUrl || null;
            // Stripe payment receipt is available after the invoice is paid online
            canViewInvoice = true;
          }
        }
      }
    }

    return {
      ...request,
      hasPrepaymentReceipt: Boolean(prepayment),
      prepaymentReceiptUrl: prepayment?.receipt_url || null,
      receiptUrl: prepayment?.receipt_url || null,
      hasFacilityFeeReceipt: Boolean(facilityFeePayment),
      facilityFeeReceiptUrl: facilityFeePayment?.receipt_url || null,
      // Facility fee Stripe receipt is shown as Invoice receipt in the portal UI
      hasInvoiceReceipt: Boolean(
        (invoicePaid && canViewInvoice) || facilityFeePayment
      ),
      invoiceReceiptUrl:
        invoiceReceiptUrl || facilityFeePayment?.receipt_url || null,
      invoiceSent,
      invoicePaid,
      canViewInvoice,
      canPayInvoice,
      paymentUrl,
    };
  });
}

async function assertOwnedPersonalRequest(requestId, portalUserId) {
  const requestOrder = await PersonalRequestOrder.findById(requestId);
  if (!requestOrder) {
    throw new ApiError(404, "Request not found");
  }

  const ownerId = Number(requestOrder.portal_user_id);
  const userId = Number(portalUserId);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new ApiError(401, "Authentication required");
  }
  if (!Number.isFinite(ownerId) || ownerId <= 0 || ownerId !== userId) {
    throw new ApiError(403, "You do not have access to this request");
  }

  return requestOrder;
}

/**
 * Stripe / portal receipt display for logged-in users — no email OTP or
 * emailed magic link required.
 */
async function getPrepaymentReceiptPdf(requestId, portalUserId) {
  const requestOrder = await assertOwnedPersonalRequest(requestId, portalUserId);
  const payments =
    await PersonalRequestStripePayment.findByPersonalRequestOrderId(
      requestOrder.id
    );
  const prepayment =
    payments.find(
      (row) =>
        row.status === "succeeded" &&
        `${row.payment_kind || "processing_fee"}` !== "research_fee"
    ) || null;

  if (!prepayment) {
    throw new ApiError(404, "Prepayment receipt not found");
  }

  if (prepayment.receipt_url) {
    return {
      kind: "redirect",
      url: prepayment.receipt_url,
      label: "Prepayment receipt",
    };
  }

  const { generatePaymentReceiptPdf: buildReceiptPdf } = require("../utils/paymentReceiptPdf");
  const pdfBuffer = await buildReceiptPdf({
    ...prepayment,
    invoice_type: "personal_portal",
    invoice_number:
      requestOrder.confirmation_reference || `PR-${requestOrder.id}`,
    amount: prepayment.amount,
  });

  return {
    kind: "pdf",
    buffer: pdfBuffer,
    fileName: `prepayment-receipt-${requestOrder.confirmation_reference || requestOrder.id}.pdf`,
    label: "Prepayment receipt",
  };
}

async function getFacilityFeeReceiptPdf(requestId, portalUserId) {
  const requestOrder = await assertOwnedPersonalRequest(requestId, portalUserId);
  const payments =
    await PersonalRequestStripePayment.findByPersonalRequestOrderId(
      requestOrder.id
    );
  let facilityFee = pickFacilityFeePayment(payments);

  if (!facilityFee) {
    throw new ApiError(404, "Facility fee receipt not found");
  }

  // Backfill Stripe receipt URL for fees paid before receipt capture was fixed
  if (!facilityFee.receipt_url && facilityFee.stripe_payment_intent_id) {
    try {
      const stripe = require("stripe")(config.stripe.secretKey);
      const paymentIntent = await stripe.paymentIntents.retrieve(
        facilityFee.stripe_payment_intent_id,
        { expand: ["latest_charge"] }
      );
      const charge =
        paymentIntent.latest_charge &&
        typeof paymentIntent.latest_charge === "object"
          ? paymentIntent.latest_charge
          : null;
      if (charge?.receipt_url) {
        const pool = getPool();
        await pool.execute(
          `UPDATE personal_request_stripe_payments
           SET receipt_url = :receiptUrl,
               stripe_charge_id = COALESCE(stripe_charge_id, :chargeId),
               card_brand = COALESCE(card_brand, :cardBrand),
               card_last4 = COALESCE(card_last4, :cardLast4)
           WHERE id = :id`,
          {
            receiptUrl: charge.receipt_url,
            chargeId: charge.id || null,
            cardBrand: charge.payment_method_details?.card?.brand || null,
            cardLast4: charge.payment_method_details?.card?.last4 || null,
            id: facilityFee.id,
          }
        );
        facilityFee = { ...facilityFee, receipt_url: charge.receipt_url };
      }
    } catch (error) {
      logger.warn("Unable to backfill facility fee Stripe receipt", {
        requestId,
        message: error.message,
      });
    }
  }

  if (facilityFee.receipt_url) {
    return {
      kind: "redirect",
      url: facilityFee.receipt_url,
      label: "Facility fee receipt",
    };
  }

  const { generatePaymentReceiptPdf: buildReceiptPdf } = require("../utils/paymentReceiptPdf");
  const pdfBuffer = await buildReceiptPdf({
    ...facilityFee,
    invoice_type: "personal_portal",
    invoice_number:
      requestOrder.confirmation_reference || `PR-${requestOrder.id}`,
    amount: facilityFee.amount,
  });

  return {
    kind: "pdf",
    buffer: pdfBuffer,
    fileName: `facility-fee-receipt-${requestOrder.confirmation_reference || requestOrder.id}.pdf`,
    label: "Facility fee receipt",
  };
}

async function getInvoiceReceiptPdf(requestId, portalUserId) {
  const requestOrder = await assertOwnedPersonalRequest(requestId, portalUserId);
  const dmsOrderId = Number(requestOrder.order_id);
  if (!Number.isFinite(dmsOrderId) || dmsOrderId <= 0) {
    throw new ApiError(404, "Invoice receipt not found for this request");
  }

  const {
    hasStandardInvoiceFields,
  } = require("../utils/orderInvoicePayment");
  const invoice = await Invoice.findByOrderId(dmsOrderId);
  if (!invoice || !hasStandardInvoiceFields(invoice)) {
    throw new ApiError(404, "Invoice not found");
  }

  const due = Number(invoice.amount_due) || 0;
  const invoicePaid =
    `${invoice.status || ""}`.toLowerCase() === "paid" || due <= 0;
  if (!invoicePaid) {
    throw new ApiError(400, "Invoice receipt is available after payment");
  }

  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT s.*, o.order_number, o.case_number,
            TRIM(CONCAT_WS(' ', o.applicant_first_name, o.applicant_middle_name, o.applicant_last_name)) AS applicant_name,
            COALESCE(p.company_name, o.serve_company_name, f.facility_name, '—') AS company_name
     FROM stripe_online_payments s
     INNER JOIN orders o ON o.id = s.order_id
     LEFT JOIN facilities f ON f.id = o.facility_id
     LEFT JOIN providers p ON p.id = o.provider_id
     WHERE s.order_id = :orderId
       AND s.status = 'succeeded'
       AND s.invoice_type IN ('regular', 'personal_portal')
     ORDER BY s.paid_at DESC, s.id DESC
     LIMIT 1`,
    { orderId: dmsOrderId }
  );

  const payment = rows[0] || null;
  if (!payment) {
    throw new ApiError(404, "Stripe payment receipt not found for this invoice");
  }

  if (payment.receipt_url) {
    return {
      kind: "redirect",
      url: payment.receipt_url,
      label: "Invoice receipt",
    };
  }

  const { generatePaymentReceiptPdf: buildReceiptPdf } = require("../utils/paymentReceiptPdf");
  const pdfBuffer = await buildReceiptPdf({
    ...payment,
    invoice_type: payment.invoice_type || "regular",
    invoice_number:
      payment.invoice_number ||
      invoice.invoice_number ||
      payment.order_number ||
      `INV-${dmsOrderId}`,
  });

  return {
    kind: "pdf",
    buffer: pdfBuffer,
    fileName: `invoice-receipt-${payment.order_number || requestOrder.id}.pdf`,
    label: "Invoice receipt",
  };
}

/**
 * Start Stripe Checkout for a sent unpaid invoice while logged into the
 * personal portal (no emailed OTP / pay link required).
 */
async function createInvoiceCheckoutForPortalUser(requestId, portalUserId) {
  const requestOrder = await assertOwnedPersonalRequest(requestId, portalUserId);
  const dmsOrderId = Number(requestOrder.order_id);
  if (!Number.isFinite(dmsOrderId) || dmsOrderId <= 0) {
    throw new ApiError(400, "This request is not linked to a DMS invoice yet");
  }

  const Invoice = require("../models/Invoice");
  const {
    hasStandardInvoiceFields,
  } = require("../utils/orderInvoicePayment");
  const invoice = await Invoice.findByOrderId(dmsOrderId);
  if (!invoice || !hasStandardInvoiceFields(invoice)) {
    throw new ApiError(404, "Invoice not found");
  }
  if (!invoice.sent_date) {
    throw new ApiError(400, "Invoice has not been sent yet");
  }

  const due = Number(invoice.amount_due) || 0;
  if (`${invoice.status || ""}`.toLowerCase() === "paid" || due <= 0) {
    throw new ApiError(400, "This invoice is already paid");
  }

  const stripePaymentService = require("./stripePaymentService");
  const token = await stripePaymentService.ensurePaymentAccessToken(dmsOrderId);
  const baseClient = (config.clientUrl || "http://localhost:3000").replace(
    /\/$/,
    ""
  );

  const checkout = await stripePaymentService.createCheckoutSession(
    token,
    "regular",
    {
      successUrl: `${baseClient}/personalrequest/dashboard?invoicePaid=1&request_id=${requestOrder.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${baseClient}/personalrequest/dashboard?invoiceCanceled=1`,
    }
  );

  return {
    checkoutUrl: checkout.checkoutUrl,
    sessionId: checkout.sessionId,
  };
}

async function getDashboardForUser(portalUserId) {
  const lookupDays = config.personalPortal?.lookupDays || 7;

  await syncPortalStatusesForPortalUser(portalUserId);

  const [counts, listResult] = await Promise.all([
    PersonalRequestOrder.countByPortalUserId(portalUserId, {
      withinLookupWindow: true,
    }),
    PersonalRequestOrder.findByPortalUserId(portalUserId, {
      pageSize: 5,
      paidOnly: true,
      withinLookupWindow: true,
    }),
  ]);

  const bundles = await loadRequestBundles(listResult.rows);
  const recentRequests = await attachPaymentActionFields(
    bundles.map(mapListRequest).filter(Boolean)
  );

  return {
    stats: {
      totalOrders: Number(counts.total || 0),
      inProcess: Number(counts.in_process || 0),
      invoice: Number(counts.invoice || 0),
      paid: Number(counts.paid || 0),
      released: Number(counts.released || 0),
    },
    recentRequests,
    lookupDays,
  };
}

async function listRequestsForUser(
  portalUserId,
  { pageSize = 10, cursor = null, status = null, search = null } = {}
) {
  const lookupDays = config.personalPortal?.lookupDays || 7;

  let { rows, pagination } = await PersonalRequestOrder.findByPortalUserId(
    portalUserId,
    {
      pageSize,
      cursor,
      paidOnly: true,
      status: status || null,
      search: search || null,
      withinLookupWindow: true,
    }
  );

  rows = await syncPortalStatusesForRequestRows(rows);

  const bundles = await loadRequestBundles(rows);
  const requests = await attachPaymentActionFields(
    bundles.map(mapListRequest).filter(Boolean)
  );

  return {
    requests,
    pagination,
    lookupDays,
  };
}

async function backfillMissingDmsOrderLinks() {
  const rows = await PersonalRequestOrder.findPaidWithoutOrderId({ limit: 25 });
  for (const row of rows) {
    const bundle = await loadRequestBundle(row.id);
    if (!bundle?.order || bundle.order.order_id) continue;

    const confirmationReference =
      bundle.order.confirmation_reference || generateConfirmationReference();
    const lookupExpiresAt =
      bundle.order.lookup_expires_at || addLookupExpiry(new Date());
    const feeAmount = getProcessingFeeAmount();

    try {
      const orderPayload = buildOrderPayloadFromBundle(
        bundle,
        confirmationReference
      );
      const dmsOrder = await orderService.createOrder(
        {
          ...orderPayload,
          prepaymentPaid: feeAmount,
          prepaymentDue: 0,
          prepaymentMemo: "Personal portal processing fee",
          prepaymentDate: new Date().toISOString().slice(0, 10),
          prepaymentCheck: "STRIPE-PORTAL",
        },
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
        if (bundle.order.driver_license_storage_path) {
          await Order.createAdditionalDocument(connection, {
            orderId: dmsOrder.id,
            documentName: "Driver's License",
            originalFileName: path.basename(
              bundle.order.driver_license_storage_path
            ),
            mimeType: "image/jpeg",
            storagePath: bundle.order.driver_license_storage_path,
            fileSizeBytes: null,
            uploadedBy: null,
          });
        }
        await Order.upsertPayment(connection, {
          orderId: dmsOrder.id,
          paymentType: "prepayment",
          checkNumber: "STRIPE-PORTAL",
          paymentDate: new Date().toISOString().slice(0, 10),
          amount: feeAmount,
          dueAmount: 0,
          isPaid: 1,
          memo: "Personal portal processing fee ($35 prepayment)",
        });
        await PersonalRequestOrder.markPaid(connection, row.id, {
          confirmationReference,
          orderId: dmsOrder.id,
          portalStatus: bundle.order.portal_status || "in_process",
          lookupExpiresAt,
        });
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.warn("Failed to backfill DMS order for personal request", {
        requestId: row.id,
        message: error.message,
      });
    }
  }
}

function getResearchFeeAmount() {
  return Number(
    ((config.personalPortal?.researchFeeCents || 500) / 100).toFixed(2)
  );
}

function mapResearchFee(order) {
  const status = order?.research_fee_status || "none";
  if (status === "none") return null;

  return {
    status,
    amount: getResearchFeeAmount(),
    amountDisplay: getResearchFeeAmount().toFixed(2),
    requestedAt: order.research_fee_requested_at || null,
    paidAt: order.research_fee_paid_at || null,
    canPay: status === "pending",
  };
}

/**
 * Arm / email the $5 facility search fee only when staff is ready to collect —
 * i.e. after the DMS invoice is created and sent to the personal user.
 * Do not call this on facility verify / payment fulfill.
 */
async function requestResearchFeeAfterFacilityVerification(
  dmsOrderId,
  { notify = true } = {}
) {
  const normalizedId = Number(dmsOrderId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) return null;

  const requestOrder = await PersonalRequestOrder.findByOrderId(normalizedId);
  if (!requestOrder || !requestOrder.processing_fee_paid) return null;

  const primaryFacility = await PersonalRequestFacility.findPrimaryByOrderId(
    requestOrder.id
  );
  const isManualLookup = Boolean(Number(primaryFacility?.is_manual_lookup));
  if (!isManualLookup) {
    return {
      skipped: true,
      reason: "matched_facility",
      requestId: requestOrder.id,
    };
  }

  const status = requestOrder.research_fee_status || "none";
  if (status === "paid" || status === "waived") {
    return {
      skipped: true,
      reason: status,
      requestId: requestOrder.id,
    };
  }

  if (status !== "pending") {
    await PersonalRequestOrder.markResearchFeeRequested(requestOrder.id);
  }

  const amount = getResearchFeeAmount();
  if (!notify) {
    return {
      requested: true,
      notified: false,
      requestId: requestOrder.id,
      amount,
    };
  }

  const baseClient = (config.clientUrl || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  const payUrl = `${baseClient}/personalrequest/dashboard?payResearchFee=${requestOrder.id}`;

  try {
    await emailService.sendPersonalPortalResearchFeeRequest({
      to: requestOrder.email,
      name: `${requestOrder.first_name || ""} ${requestOrder.last_name || ""}`.trim(),
      confirmationReference:
        requestOrder.confirmation_reference || `PR-${requestOrder.id}`,
      amount,
      payUrl,
    });
  } catch (error) {
    logger.error("Failed to email personal portal research fee request", {
      requestId: requestOrder.id,
      message: error.message,
    });
  }

  logger.info("Personal portal research fee requested after invoice send", {
    requestId: requestOrder.id,
    dmsOrderId: normalizedId,
    amount,
  });

  return {
    requested: true,
    notified: true,
    requestId: requestOrder.id,
    amount,
    payUrl,
  };
}

/**
 * Company-portal parity: $5 facility search fee still owed for the next
 * regular invoice when the personal request used an unmatched facility and
 * the fee has not yet been billed / paid.
 * Does not email the user — that happens only when the invoice is sent.
 */
async function getPendingPersonalFacilitySearchFee(dmsOrderId) {
  const normalizedId = Number(dmsOrderId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) return null;

  const requestOrder = await PersonalRequestOrder.findByOrderId(normalizedId);
  if (!requestOrder || !requestOrder.processing_fee_paid) return null;

  const primaryFacility = await PersonalRequestFacility.findPrimaryByOrderId(
    requestOrder.id
  );
  if (!Boolean(Number(primaryFacility?.is_manual_lookup))) {
    return null;
  }

  const status = requestOrder.research_fee_status || "none";
  if (status === "paid" || status === "waived") {
    return null;
  }

  const amount = getResearchFeeAmount();
  if (amount <= 0) return null;

  return {
    personalRequestId: requestOrder.id,
    amount,
  };
}

/**
 * After invoice email/system send: sync portal status and ask the personal
 * user to pay (invoice payment link already emailed; surface fee on dashboard
 * only when a facility-search fee applied and is still unpaid separately).
 */
async function notifyPersonalUserAfterInvoiceSent(dmsOrderId) {
  const normalizedId = Number(dmsOrderId);
  if (!Number.isFinite(normalizedId) || normalizedId <= 0) return null;

  await syncPortalStatusForDmsOrder(normalizedId);

  const requestOrder = await PersonalRequestOrder.findByOrderId(normalizedId);
  if (!requestOrder) return null;

  // Fee already folded into the invoice and marked billed → user pays via
  // the invoice email / payment link only (no separate research-fee ask).
  if ((requestOrder.research_fee_status || "none") === "paid") {
    return { synced: true, separateFeeAsk: false, requestId: requestOrder.id };
  }

  const pending = await getPendingPersonalFacilitySearchFee(normalizedId);
  if (!pending) {
    return { synced: true, separateFeeAsk: false, requestId: requestOrder.id };
  }

  // Edge case: fee due but not yet on an invoice — ask after send.
  return requestResearchFeeAfterFacilityVerification(normalizedId, {
    notify: true,
  });
}

async function markPersonalFacilitySearchFeeBilled(personalRequestId) {
  if (!personalRequestId) return;
  await PersonalRequestOrder.markResearchFeePaid(personalRequestId);
}

async function enrichOrdersWithPersonalFacilitySearchFees(mappedOrders = []) {
  const personalOrders = mappedOrders.filter(
    (order) =>
      order.creationSource === "personal_portal" &&
      !(Number(order.pendingFacilitySearchFee) > 0)
  );
  if (!personalOrders.length) return mappedOrders;

  await Promise.all(
    personalOrders.map(async (order) => {
      try {
        const dmsOrderId = Number(order.dbId || order.id);
        const pending = await getPendingPersonalFacilitySearchFee(dmsOrderId);
        if (pending?.amount > 0) {
          order.pendingFacilitySearchFee = pending.amount;
          order.newFacilityRequest = {
            id: pending.personalRequestId,
            status: "linked",
            searchFeeAmount: pending.amount,
            feePending: true,
            feeBilled: false,
            source: "personal_portal",
          };
        }
      } catch (_error) {
        // Non-blocking enrichment
      }
    })
  );

  return mappedOrders;
}

async function createResearchFeeCheckout(personalRequestId, portalUserId) {
  const requestOrder = await assertOwnedPersonalRequest(
    personalRequestId,
    portalUserId
  );

  if ((requestOrder.research_fee_status || "none") !== "pending") {
    throw new ApiError(400, "No research fee is currently due for this request");
  }

  const stripe = getStripe();
  const feeCents = config.personalPortal?.researchFeeCents || 500;
  const feeAmount = getResearchFeeAmount();
  const currency = config.stripe.currency || "usd";
  const baseClient = (config.clientUrl || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  const successUrl = `${baseClient}/personalrequest/dashboard?researchFeePaid=1&request_id=${requestOrder.id}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseClient}/personalrequest/dashboard?researchFeeCanceled=1`;

  const checkoutPayload = {
    mode: "payment",
    payment_method_types: ["card"],
    wallet_options: {
      link: { display: "never" },
    },
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: "Personal Records — Facility Search Fee",
            description:
              "$5 facility search fee after DMS located and confirmed a facility that was not in our list at request time",
          },
          unit_amount: feeCents,
        },
        quantity: 1,
      },
    ],
    customer_email: requestOrder.email,
    metadata: {
      payment_kind: "personal_portal_research_fee",
      personal_request_id: String(requestOrder.id),
      email: requestOrder.email || "",
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
    if (/wallet_options|unknown parameter/i.test(error?.message || "")) {
      const { wallet_options: _ignored, ...fallbackPayload } = checkoutPayload;
      session = await stripe.checkout.sessions.create(fallbackPayload);
    } else {
      throw error;
    }
  }

  await PersonalRequestOrder.setResearchFeeCheckoutSessionId(
    requestOrder.id,
    session.id
  );

  await PersonalRequestStripePayment.createPending({
    personalRequestOrderId: requestOrder.id,
    paymentKind: "research_fee",
    amount: feeAmount,
    currency,
    stripeCheckoutSessionId: session.id,
    customerEmail: requestOrder.email,
    customerName: `${requestOrder.first_name || ""} ${
      requestOrder.last_name || ""
    }`.trim(),
  });

  return {
    requestId: requestOrder.id,
    checkoutUrl: session.url,
    sessionId: session.id,
    amount: feeAmount.toFixed(2),
  };
}

async function fulfillPersonalPortalResearchFeePayment(session) {
  const requestId = Number(session.metadata?.personal_request_id);
  if (!requestId) {
    logger.warn("Research fee session missing request id", {
      sessionId: session.id,
    });
    return;
  }

  const requestOrder = await PersonalRequestOrder.findById(requestId);
  if (!requestOrder) {
    logger.warn("Research fee request not found", { requestId });
    return;
  }

  if (requestOrder.research_fee_status === "paid") {
    return;
  }

  const feeAmount = getResearchFeeAmount();
  const currency = config.stripe.currency || "usd";
  const stripePaymentService = require("./stripePaymentService");
  const stripeDetails =
    await stripePaymentService.extractStripePaymentDetails(session);
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const existingPayment =
      await PersonalRequestStripePayment.findByCheckoutSessionId(
        session.id,
        connection
      );

    if (existingPayment?.status === "succeeded") {
      await connection.commit();
      return;
    }

    const paymentPayload = {
      orderId: requestOrder.order_id || null,
      amount: feeAmount,
      currency,
      stripePaymentIntentId:
        stripeDetails.stripePaymentIntentId || session.payment_intent || null,
      stripeChargeId: stripeDetails.stripeChargeId || null,
      stripeCustomerId:
        stripeDetails.stripeCustomerId || session.customer || null,
      paymentMethodType: stripeDetails.paymentMethodType || "card",
      cardBrand: stripeDetails.cardBrand || null,
      cardLast4: stripeDetails.cardLast4 || null,
      customerEmail:
        stripeDetails.customerEmail || requestOrder.email || null,
      customerName:
        stripeDetails.customerName ||
        `${requestOrder.first_name || ""} ${requestOrder.last_name || ""}`.trim() ||
        null,
      receiptUrl: stripeDetails.receiptUrl || null,
      processingFee: stripeDetails.processingFee ?? null,
      netAmount: stripeDetails.netAmount ?? feeAmount,
      paidAt: new Date(),
    };

    if (existingPayment) {
      await PersonalRequestStripePayment.markSucceeded(
        connection,
        existingPayment.id,
        paymentPayload
      );
    } else {
      await PersonalRequestStripePayment.insertSucceeded(connection, {
        personalRequestOrderId: requestId,
        stripeCheckoutSessionId: session.id,
        ...paymentPayload,
      });
    }

    await PersonalRequestOrder.markResearchFeePaid(requestId, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    rethrowServiceError(error);
  } finally {
    connection.release();
  }

  try {
    const pool2 = getPool();
    await pool2.execute(
      `UPDATE personal_request_stripe_payments
       SET payment_kind = 'research_fee'
       WHERE stripe_checkout_session_id = :sessionId`,
      { sessionId: session.id }
    );
  } catch {
    // ignore if column missing
  }
}

module.exports = {
  sendEmailOtp,
  confirmEmailOtp,
  createPendingRequest,
  fulfillPersonalPortalPayment,
  fulfillPersonalPortalResearchFeePayment,
  requestResearchFeeAfterFacilityVerification,
  getPendingPersonalFacilitySearchFee,
  markPersonalFacilitySearchFeeBilled,
  enrichOrdersWithPersonalFacilitySearchFees,
  notifyPersonalUserAfterInvoiceSent,
  createResearchFeeCheckout,
  getCheckoutResult,
  lookupRequestStatus,
  updateRequestNotificationEmail,
  getDashboardForUser,
  listRequestsForUser,
  getPrepaymentReceiptPdf,
  getFacilityFeeReceiptPdf,
  getInvoiceReceiptPdf,
  createInvoiceCheckoutForPortalUser,
  syncPortalStatusForDmsOrder,
  backfillMissingDmsOrderLinks,
  PORTAL_STATUS_LABELS,
};
