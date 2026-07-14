const fs = require("fs");
const crypto = require("crypto");
const Stripe = require("stripe");
const config = require("../config");
const ApiError = require("../utils/ApiError");
const CompanyPortalOrder = require("../models/CompanyPortalOrder");
const CompanyPortalPendingCheckout = require("../models/CompanyPortalPendingCheckout");
const CompanyPortalUser = require("../models/CompanyPortalUser");
const fileStorage = require("../utils/fileStorage");
const subpoenaExtractionService = require("./subpoenaExtractionService");
const {
  mapSchemaToOrderHints,
  resolveExtractionSchema,
} = require("../utils/extractionMapper");
const {
  parseUsAddress,
  splitNameAndAddress,
  formatAddressLine,
} = require("../utils/addressParseUtils");
const {
  mapRecordTextToFlags,
  normalizeRecordTypeFlags,
  flagsFromDbRow,
  flagsToDbValues,
  formatRecordTypesLabel,
  hasAnyRecordType,
} = require("../utils/companyPortalRecordTypes");
const { toInputDate } = require("../utils/dateUtils");

const COMPANY_PORTAL_ORDER_FEE = 35;
const MIME_PDF = "application/pdf";

let stripeClient = null;

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

function toNumber(value) {
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
}

function formatMoney(value) {
  return `$${toNumber(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function generateOrderNumber() {
  const suffix = crypto.randomInt(100000, 999999);
  return `ORD-${suffix}`;
}

function resolveFacilityFromHints(hints = {}) {
  const fromCustomer = splitNameAndAddress(hints.customer || "");
  const addressSource =
    fromCustomer.address ||
    hints.doctorAddress ||
    "";
  const parsed = parseUsAddress(addressSource);

  return {
    facilityName: fromCustomer.name || hints.customer || "",
    facilityAddress: parsed.address || addressSource || "",
    facilityCity: parsed.city || "",
    facilityState: parsed.state || "",
    facilityZip: parsed.zip || "",
  };
}

function resolveCompanyFromHints(hints = {}, companyUser = {}) {
  const fromName = splitNameAndAddress(hints.companyName || "");
  const addressSource =
    fromName.address ||
    hints.companyAddress ||
    "";
  const parsed = parseUsAddress(addressSource);

  const hasParsedAddress =
    parsed.address || parsed.city || parsed.state || parsed.zip;

  return {
    companyName:
      fromName.name ||
      hints.companyName ||
      companyUser.company_name ||
      "",
    companyAddress: hasParsedAddress
      ? parsed.address || ""
      : companyUser.address_line1 || "",
    companyCity: hasParsedAddress
      ? parsed.city || ""
      : companyUser.city || "",
    companyState: hasParsedAddress
      ? parsed.state || ""
      : companyUser.state || "",
    companyZip: hasParsedAddress
      ? parsed.zip || ""
      : companyUser.zip || "",
  };
}

function mapHintsToDraftFields(hints = {}, companyUser = {}) {
  const facility = resolveFacilityFromHints(hints);
  const company = resolveCompanyFromHints(hints, companyUser);
  const recordFlags = mapRecordTextToFlags(
    hints.recordType,
    hints.requestedRecord
  );

  return {
    facilityName: facility.facilityName,
    facilityAddress: facility.facilityAddress,
    facilityCity: facility.facilityCity || null,
    facilityState: facility.facilityState || null,
    facilityZip: facility.facilityZip || null,
    treatingDoctor: hints.specificDoctor || null,
    applicantName: hints.applicantName || null,
    caseName: hints.caseName || null,
    caseNumber: hints.orderNumber || null,
    recNumber: hints.recNumber || null,
    ssn: hints.ssn || null,
    dateOfBirth: hints.dateOfBirth || null,
    dateOfInjury: hints.dateOfInjury || null,
    dateOfInjuryText: hints.dateOfInjuryText || null,
    companyName: company.companyName || null,
    companyAddress: company.companyAddress || null,
    companyCity: company.companyCity || null,
    companyState: company.companyState || null,
    companyZip: company.companyZip || null,
    doctorAddress: hints.doctorAddress || null,
    recordType: formatRecordTypesLabel(recordFlags) || hints.recordType || null,
    requestedRecord: hints.requestedRecord || null,
    ...recordFlags,
    subpoenaDate: hints.subpoenaDate || null,
    dateRequested: hints.dateRequested || null,
    depoDueDate: hints.depoDueDate || null,
    contactEmail: companyUser.email || null,
    contactPhone: companyUser.phone || null,
  };
}

function formatOrder(row) {
  if (!row) return null;

  const recordFlags = flagsFromDbRow(row);

  const facilityAddressDisplay = formatAddressLine({
    address: row.facility_address,
    city: row.facility_city,
    state: row.facility_state,
    zip: row.facility_zip,
  });

  const companyAddressDisplay = formatAddressLine({
    address: row.company_address,
    city: row.company_city,
    state: row.company_state,
    zip: row.company_zip,
  });

  return {
    id: row.id,
    companyUserId: row.company_user_id,
    orderNumber: row.order_number || null,
    status: row.status,
    facilityName: row.facility_name || "",
    facilityAddress: row.facility_address || "",
    facilityCity: row.facility_city || "",
    facilityState: row.facility_state || "",
    facilityZip: row.facility_zip || "",
    facilityAddressDisplay,
    treatingDoctor: row.treating_doctor || "",
    applicantName: row.applicant_name || "",
    caseName: row.case_name || "",
    caseNumber: row.case_number || "",
    recNumber: row.rec_number || "",
    ssn: row.ssn || "",
    dateOfBirth: row.date_of_birth ? toInputDate(row.date_of_birth) : "",
    dateOfInjury: row.date_of_injury ? toInputDate(row.date_of_injury) : "",
    dateOfInjuryText: row.date_of_injury_text || "",
    companyName: row.company_name || "",
    companyAddress: row.company_address || "",
    companyCity: row.company_city || "",
    companyState: row.company_state || "",
    companyZip: row.company_zip || "",
    companyAddressDisplay,
    doctorAddress: row.doctor_address || "",
    recordType: row.record_type || formatRecordTypesLabel(recordFlags) || "",
    requestedRecord: row.requested_record || "",
    ...recordFlags,
    recordTypesLabel: formatRecordTypesLabel(recordFlags),
    subpoenaDate: row.subpoena_date ? toInputDate(row.subpoena_date) : "",
    dateRequested: row.date_requested ? toInputDate(row.date_requested) : "",
    depoDueDate: row.depo_due_date ? toInputDate(row.depo_due_date) : "",
    contactEmail: row.contact_email || "",
    contactPhone: row.contact_phone || "",
    subpoenaFileName: row.subpoena_file_name || "",
    subpoenaFileSize: row.subpoena_file_size
      ? Number(row.subpoena_file_size)
      : 0,
    hasSubpoena: Boolean(row.subpoena_storage_path),
    canDownloadDocuments: row.status === "Released",
    paymentAmount: toNumber(row.payment_amount || COMPANY_PORTAL_ORDER_FEE),
    paymentAmountDisplay: formatMoney(
      row.payment_amount || COMPANY_PORTAL_ORDER_FEE
    ),
    paymentStatus: row.payment_status,
    paidAt: row.paid_at || null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id || null,
    stripePaymentIntentId: row.stripe_payment_intent_id || null,
    receiptUrl: row.stripe_receipt_url || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function extractStripePaymentDetails(session) {
  const stripe = getStripe();
  let paymentIntent = null;
  let charge = null;

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id || null;

  if (paymentIntentId) {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge", "payment_method"],
    });
    charge =
      paymentIntent.latest_charge &&
      typeof paymentIntent.latest_charge === "object"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge
          ? await stripe.charges.retrieve(paymentIntent.latest_charge)
          : null;
  }

  const card =
    paymentIntent?.payment_method?.card ||
    charge?.payment_method_details?.card ||
    null;

  return {
    paymentIntentId: paymentIntent?.id || paymentIntentId,
    receiptUrl: charge?.receipt_url || null,
    paymentMethodType:
      paymentIntent?.payment_method_types?.[0] ||
      charge?.payment_method_details?.type ||
      "card",
    cardBrand: card?.brand || null,
    cardLast4: card?.last4 || null,
    customerEmail:
      session.customer_details?.email ||
      charge?.billing_details?.email ||
      null,
    customerName:
      session.customer_details?.name ||
      charge?.billing_details?.name ||
      null,
  };
}

function parsePendingPayload(row) {
  if (!row?.payload) return {};
  if (typeof row.payload === "object") return row.payload;
  try {
    return JSON.parse(row.payload);
  } catch {
    return {};
  }
}

async function allocateOrderNumber() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = generateOrderNumber();
    const clash = await CompanyPortalOrder.findByOrderNumber(candidate);
    if (!clash) return candidate;
  }
  return `ORD-${Date.now().toString().slice(-6)}`;
}

function formatDraftForm(fields = {}) {
  const recordFlags = normalizeRecordTypeFlags(fields);
  return {
    facilityName: fields.facilityName || "",
    facilityAddress: fields.facilityAddress || "",
    facilityCity: fields.facilityCity || "",
    facilityState: fields.facilityState || "",
    facilityZip: fields.facilityZip || "",
    treatingDoctor: fields.treatingDoctor || "",
    applicantName: fields.applicantName || "",
    caseName: fields.caseName || "",
    caseNumber: fields.caseNumber || "",
    recNumber: fields.recNumber || "",
    ssn: fields.ssn || "",
    dateOfBirth: fields.dateOfBirth
      ? toInputDate(fields.dateOfBirth) || fields.dateOfBirth
      : "",
    dateOfInjury: fields.dateOfInjury
      ? toInputDate(fields.dateOfInjury) || fields.dateOfInjury
      : "",
    dateOfInjuryText: fields.dateOfInjuryText || "",
    companyName: fields.companyName || "",
    companyAddress: fields.companyAddress || "",
    companyCity: fields.companyCity || "",
    companyState: fields.companyState || "",
    companyZip: fields.companyZip || "",
    doctorAddress: fields.doctorAddress || "",
    recordType: formatRecordTypesLabel(recordFlags) || fields.recordType || "",
    requestedRecord: fields.requestedRecord || "",
    ...recordFlags,
    recordTypesLabel: formatRecordTypesLabel(recordFlags),
    subpoenaDate: fields.subpoenaDate
      ? toInputDate(fields.subpoenaDate) || fields.subpoenaDate
      : "",
    dateRequested: fields.dateRequested
      ? toInputDate(fields.dateRequested) || fields.dateRequested
      : "",
    depoDueDate: fields.depoDueDate
      ? toInputDate(fields.depoDueDate) || fields.depoDueDate
      : "",
    contactEmail: fields.contactEmail || "",
    contactPhone: fields.contactPhone || "",
  };
}

async function uploadAndExtract({ companyUserId, file }) {
  if (!file?.buffer?.length) {
    throw new ApiError(400, "Subpoena PDF is required");
  }

  const isPdf =
    file.mimetype === MIME_PDF ||
    String(file.originalname || "").toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    throw new ApiError(400, "Only PDF files are allowed");
  }

  const companyUser = await CompanyPortalUser.findById(companyUserId);
  if (!companyUser) {
    throw new ApiError(401, "Company account not found");
  }

  const saved = fileStorage.saveCompanyPortalSubpoena(
    companyUserId,
    file.originalname || "subpoena.pdf",
    file.buffer
  );

  const extraction = await subpoenaExtractionService.processDocument(
    file.buffer,
    file.originalname || "subpoena.pdf"
  );

  const results = Array.isArray(extraction.results) ? extraction.results : [];
  if (!results.length) {
    throw new ApiError(502, "Extraction service returned no subpoena results");
  }

  const schema = resolveExtractionSchema(results[0]);
  const orderHints = mapSchemaToOrderHints(schema);
  const draftFields = mapHintsToDraftFields(orderHints, companyUser);
  const uploadToken = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await CompanyPortalPendingCheckout.create({
    companyUserId,
    uploadToken,
    payload: draftFields,
    subpoenaFileName: file.originalname || saved.fileName,
    subpoenaStoragePath: saved.relativePath,
    subpoenaFileSize: file.size || file.buffer.length,
    extractionRaw: results[0] || {},
    paymentAmount: COMPANY_PORTAL_ORDER_FEE,
    expiresAt,
  });

  return {
    uploadToken,
    form: formatDraftForm(draftFields),
    fileMeta: {
      name: file.originalname || saved.fileName,
      size: file.size || file.buffer.length,
    },
    fee: COMPANY_PORTAL_ORDER_FEE,
    feeDisplay: formatMoney(COMPANY_PORTAL_ORDER_FEE),
  };
}

async function getOrder(orderId, companyUserId) {
  const order = await CompanyPortalOrder.findByIdForUser(orderId, companyUserId);
  if (!order || order.status === "Draft") {
    throw new ApiError(404, "Order not found");
  }
  return formatOrder(order);
}

async function trackOrderByNumber(orderNumber, companyUserId) {
  const cleaned = String(orderNumber || "").trim().toUpperCase();
  if (!cleaned) {
    throw new ApiError(400, "Order number is required");
  }

  const order = await CompanyPortalOrder.findByOrderNumberForUser(
    cleaned,
    companyUserId
  );
  if (!order) {
    throw new ApiError(404, "No order found with that order number");
  }

  const formatted = formatOrder(order);
  return {
    ...formatted,
    canDownloadDocuments: order.status === "Released",
  };
}

async function createCheckout(companyUserId, { uploadToken, details }) {
  if (!uploadToken) {
    throw new ApiError(400, "Upload token is required. Please re-upload the subpoena.");
  }

  const pending = await CompanyPortalPendingCheckout.findByUploadToken(
    uploadToken,
    companyUserId
  );
  if (!pending) {
    throw new ApiError(
      404,
      "Upload session expired. Please upload the subpoena again."
    );
  }

  if (new Date(pending.expires_at).getTime() < Date.now()) {
    throw new ApiError(
      400,
      "Upload session expired. Please upload the subpoena again."
    );
  }

  if (!pending.subpoena_storage_path) {
    throw new ApiError(400, "Please upload a subpoena before payment");
  }

  const recordFlags = normalizeRecordTypeFlags(details);
  if (!hasAnyRecordType(recordFlags)) {
    throw new ApiError(400, "Select at least one record type", [
      { field: "type", message: "Select at least one record type" },
    ]);
  }

  if (
    !`${details.facilityName || ""}`.trim() ||
    !`${details.facilityAddress || ""}`.trim() ||
    !`${details.facilityCity || ""}`.trim() ||
    !`${details.facilityState || ""}`.trim() ||
    !`${details.facilityZip || ""}`.trim()
  ) {
    throw new ApiError(
      400,
      "Treating facility name and full address (street, city, state, ZIP) are required before payment"
    );
  }

  const companyUser = await CompanyPortalUser.findById(companyUserId);
  const payload = {
    ...details,
    ...recordFlags,
    recordType: formatRecordTypesLabel(recordFlags) || details.recordType || null,
  };

  const stripe = getStripe();
  const amountCents = Math.round(COMPANY_PORTAL_ORDER_FEE * 100);
  const baseClient = (config.clientUrl || "http://localhost:3000").replace(
    /\/$/,
    ""
  );

  const successUrl = `${baseClient}/company-portal/orders/complete?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseClient}/company-portal/orders/new?step=payment&canceled=1`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: config.stripe.currency || "usd",
          product_data: {
            name: "Company Portal Subpoena Request",
            description: "Fixed processing fee for external company order",
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    customer_email: details.contactEmail || companyUser?.email || undefined,
    metadata: {
      portal: "company",
      pending_checkout_id: String(pending.id),
      upload_token: uploadToken,
      company_user_id: String(companyUserId),
      amount: String(COMPANY_PORTAL_ORDER_FEE),
      currency: config.stripe.currency || "usd",
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  await CompanyPortalPendingCheckout.updatePayloadAndSession(pending.id, {
    payload,
    sessionId: session.id,
    paymentAmount: COMPANY_PORTAL_ORDER_FEE,
  });

  return {
    checkoutUrl: session.url,
    sessionId: session.id,
    uploadToken,
    amount: COMPANY_PORTAL_ORDER_FEE,
    amountDisplay: formatMoney(COMPANY_PORTAL_ORDER_FEE),
  };
}

async function createOrderFromPending(pending, session, stripeDetails) {
  const payload = parsePendingPayload(pending);
  const recordFlags = normalizeRecordTypeFlags(payload);
  const orderNumber = await allocateOrderNumber();

  const order = await CompanyPortalOrder.createPaidOrder({
    companyUserId: pending.company_user_id,
    orderNumber,
    facilityName: payload.facilityName || "",
    facilityAddress: payload.facilityAddress || "",
    facilityCity: payload.facilityCity || null,
    facilityState: payload.facilityState || null,
    facilityZip: payload.facilityZip || null,
    treatingDoctor: payload.treatingDoctor || null,
    applicantName: payload.applicantName || null,
    caseName: payload.caseName || null,
    caseNumber: payload.caseNumber || null,
    recNumber: payload.recNumber || null,
    ssn: payload.ssn || null,
    dateOfBirth: payload.dateOfBirth || null,
    dateOfInjury: payload.dateOfInjury || null,
    dateOfInjuryText: payload.dateOfInjuryText || null,
    companyName: payload.companyName || null,
    companyAddress: payload.companyAddress || null,
    companyCity: payload.companyCity || null,
    companyState: payload.companyState || null,
    companyZip: payload.companyZip || null,
    doctorAddress: payload.doctorAddress || null,
    recordType:
      formatRecordTypesLabel(recordFlags) || payload.recordType || null,
    requestedRecord: payload.requestedRecord || null,
    ...flagsToDbValues(recordFlags),
    subpoenaDate: payload.subpoenaDate || null,
    dateRequested: payload.dateRequested || null,
    depoDueDate: payload.depoDueDate || null,
    contactEmail: payload.contactEmail || null,
    contactPhone: payload.contactPhone || null,
    subpoenaFileName: pending.subpoena_file_name,
    subpoenaStoragePath: pending.subpoena_storage_path,
    subpoenaFileSize: pending.subpoena_file_size,
    extractionRaw: pending.extraction_raw
      ? typeof pending.extraction_raw === "string"
        ? pending.extraction_raw
        : JSON.stringify(pending.extraction_raw)
      : null,
    paymentAmount: pending.payment_amount || COMPANY_PORTAL_ORDER_FEE,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId:
      stripeDetails?.paymentIntentId ||
      (typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null),
    stripeReceiptUrl: stripeDetails?.receiptUrl || null,
  });

  await CompanyPortalPendingCheckout.deleteById(pending.id);
  return formatOrder(order);
}

async function fulfillCompanyPortalCheckoutSession(session) {
  if (session?.metadata?.portal !== "company") {
    return null;
  }

  let stripeDetails = null;
  try {
    stripeDetails = await extractStripePaymentDetails(session);
  } catch (error) {
    console.warn(
      "[company-portal] Unable to extract Stripe payment details:",
      error.message
    );
  }

  const existingBySession = await CompanyPortalOrder.findByCheckoutSessionId(
    session.id
  );
  if (existingBySession?.payment_status === "paid") {
    if (!existingBySession.stripe_receipt_url && stripeDetails?.receiptUrl) {
      const refreshed = await CompanyPortalOrder.updateReceiptUrl(
        existingBySession.id,
        stripeDetails.receiptUrl
      );
      return formatOrder(refreshed);
    }
    return formatOrder(existingBySession);
  }

  // Legacy path: older checkouts that created draft rows before payment
  const legacyOrderId = Number(session.metadata?.company_order_id);
  if (legacyOrderId) {
    const existing = await CompanyPortalOrder.findById(legacyOrderId);
    if (existing) {
      if (existing.payment_status === "paid" && existing.order_number) {
        return formatOrder(existing);
      }

      const orderNumber =
        existing.order_number || (await allocateOrderNumber());
      const updated = await CompanyPortalOrder.markPaid(legacyOrderId, {
        orderNumber,
        paymentIntentId:
          stripeDetails?.paymentIntentId ||
          (typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || null),
        receiptUrl: stripeDetails?.receiptUrl || null,
      });
      return formatOrder(updated);
    }
  }

  const pendingId = Number(session.metadata?.pending_checkout_id);
  let pending = pendingId
    ? await CompanyPortalPendingCheckout.findById(pendingId)
    : null;

  if (!pending) {
    pending = await CompanyPortalPendingCheckout.findByCheckoutSessionId(
      session.id
    );
  }

  if (!pending) {
    return null;
  }

  return createOrderFromPending(pending, session, stripeDetails);
}

async function confirmCheckoutResult(companyUserId, sessionId) {
  if (!sessionId) {
    throw new ApiError(400, "session_id is required");
  }

  const existingBySession = await CompanyPortalOrder.findByCheckoutSessionId(
    sessionId
  );
  if (
    existingBySession &&
    Number(existingBySession.company_user_id) === Number(companyUserId) &&
    existingBySession.payment_status === "paid"
  ) {
    return formatOrder(existingBySession);
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.metadata?.portal !== "company") {
    throw new ApiError(400, "Checkout session does not match company portal");
  }

  if (
    String(session.metadata?.company_user_id || "") !== String(companyUserId)
  ) {
    throw new ApiError(403, "Checkout session does not belong to this account");
  }

  if (session.payment_status !== "paid") {
    throw new ApiError(400, "Payment has not been completed yet");
  }

  const order = await fulfillCompanyPortalCheckoutSession(session);
  if (!order) {
    throw new ApiError(500, "Unable to finalize order after payment");
  }

  if (Number(order.companyUserId) !== Number(companyUserId)) {
    throw new ApiError(403, "Order does not belong to this account");
  }

  return order;
}

async function listOrders(companyUserId, { limit = 20 } = {}) {
  const rows = await CompanyPortalOrder.listForUser(companyUserId, { limit });
  return rows.map(formatOrder);
}

async function getDashboard(companyUserId) {
  const [stats, recentOrders] = await Promise.all([
    CompanyPortalOrder.getStatsForUser(companyUserId),
    listOrders(companyUserId, { limit: 10 }),
  ]);

  return { stats, recentOrders };
}

function getSubpoenaFile(orderId, companyUserId) {
  return CompanyPortalOrder.findByIdForUser(orderId, companyUserId).then(
    (order) => {
      if (!order?.subpoena_storage_path || order.status === "Draft") {
        throw new ApiError(404, "Subpoena file not found");
      }

      const absolutePath = fileStorage.resolveAbsolutePath(
        order.subpoena_storage_path
      );

      if (!fs.existsSync(absolutePath)) {
        throw new ApiError(404, "Subpoena file not found on disk");
      }

      return {
        absolutePath,
        fileName: order.subpoena_file_name || "subpoena.pdf",
      };
    }
  );
}

async function getReleasedDocuments(orderId, companyUserId) {
  const order = await CompanyPortalOrder.findByIdForUser(orderId, companyUserId);
  if (!order || order.status === "Draft") {
    throw new ApiError(404, "Order not found");
  }

  if (order.status !== "Released") {
    throw new ApiError(
      403,
      "Documents are available for download only after the order is Released"
    );
  }

  return getSubpoenaFile(orderId, companyUserId);
}

async function generatePaymentReceiptPdf(orderId, companyUserId) {
  const order = await CompanyPortalOrder.findByIdForUser(orderId, companyUserId);
  if (!order || order.status === "Draft") {
    throw new ApiError(404, "Order not found");
  }

  if (order.payment_status !== "paid") {
    throw new ApiError(400, "Payment receipt is available only after payment");
  }

  let stripeDetails = {
    paymentMethodType: "card",
    cardBrand: null,
    cardLast4: null,
    customerEmail: order.contact_email || null,
    customerName: order.company_name || null,
    receiptUrl: order.stripe_receipt_url || null,
  };

  const sessionId = order.stripe_checkout_session_id;
  if (sessionId) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      stripeDetails = {
        ...stripeDetails,
        ...(await extractStripePaymentDetails(session)),
      };

      if (!order.stripe_receipt_url && stripeDetails.receiptUrl) {
        await CompanyPortalOrder.updateReceiptUrl(
          order.id,
          stripeDetails.receiptUrl
        );
      }
    } catch (error) {
      console.warn(
        "[company-portal] Unable to enrich receipt from Stripe:",
        error.message
      );
    }
  }

  const { generatePaymentReceiptPdf: buildReceiptPdf } = require("../utils/paymentReceiptPdf");

  return buildReceiptPdf({
    amount: order.payment_amount || COMPANY_PORTAL_ORDER_FEE,
    invoice_type: "regular",
    invoice_number: order.order_number || `CP-${order.id}`,
    order_number: order.order_number || `CP-${order.id}`,
    case_number: order.case_number || "",
    company_name: order.company_name || "",
    applicant_name: order.applicant_name || "",
    paid_at: order.paid_at,
    payment_method_type: stripeDetails.paymentMethodType || "card",
    card_brand: stripeDetails.cardBrand,
    card_last4: stripeDetails.cardLast4,
    customer_email: stripeDetails.customerEmail || order.contact_email || "",
    customer_name: stripeDetails.customerName || order.company_name || "",
    stripe_payment_intent_id:
      order.stripe_payment_intent_id || stripeDetails.paymentIntentId || "",
  });
}

module.exports = {
  COMPANY_PORTAL_ORDER_FEE,
  uploadAndExtract,
  getOrder,
  trackOrderByNumber,
  listOrders,
  getDashboard,
  createCheckout,
  fulfillCompanyPortalCheckoutSession,
  confirmCheckoutResult,
  getSubpoenaFile,
  getReleasedDocuments,
  generatePaymentReceiptPdf,
  formatOrder,
};
