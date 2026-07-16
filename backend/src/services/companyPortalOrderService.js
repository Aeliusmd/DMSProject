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

const COMPANY_PORTAL_ORDER_FEE = 15;
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
    canDownloadDocuments: false,
    downloadExpired: false,
    downloadExpiresAt: null,
    downloadUnavailableReason: null,
    paymentAmount: toNumber(row.payment_amount || COMPANY_PORTAL_ORDER_FEE),
    paymentAmountDisplay: formatMoney(
      row.payment_amount || COMPANY_PORTAL_ORDER_FEE
    ),
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method || "stripe",
    placedByName: row.placed_by_name || null,
    placedByEmployeeId: row.company_portal_employee_id || null,
    paidAt: row.paid_at || null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id || null,
    stripePaymentIntentId: row.stripe_payment_intent_id || null,
    receiptUrl: row.stripe_receipt_url || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function resolvePortalDownloadAvailability(portalOrder) {
  if (!portalOrder || portalOrder.status !== "Released") {
    return {
      canDownloadDocuments: false,
      downloadExpired: false,
      downloadExpiresAt: null,
      downloadUnavailableReason: portalOrder?.status
        ? "Download is disabled until this order reaches Released status."
        : null,
    };
  }

  if (!portalOrder.internal_order_id) {
    return {
      canDownloadDocuments: false,
      downloadExpired: false,
      downloadExpiresAt: null,
      downloadUnavailableReason:
        "Download records is not available yet. Records become available after they are emailed.",
    };
  }

  const {
    getRecordsDownloadWindow,
  } = require("./recordDownloadService");
  const window = await getRecordsDownloadWindow(portalOrder.internal_order_id);

  return {
    canDownloadDocuments: Boolean(window.canDownload),
    downloadExpired: Boolean(window.expired),
    downloadExpiresAt: window.expiresAt
      ? window.expiresAt.toISOString()
      : null,
    downloadUnavailableReason: window.reason,
  };
}

async function withPortalDownloadAvailability(formatted, portalOrder) {
  const availability = await resolvePortalDownloadAvailability(portalOrder);
  return {
    ...formatted,
    ...availability,
  };
}

async function buildPortalOrderPaymentSummary(portalOrder) {
  const feePaid =
    portalOrder?.payment_status === "paid"
      ? toNumber(portalOrder.payment_amount || COMPANY_PORTAL_ORDER_FEE)
      : 0;

  const summary = {
    processingFeePaid: feePaid,
    processingFeePaidDisplay: formatMoney(feePaid),
    invoicePaid: 0,
    invoicePaidDisplay: formatMoney(0),
    totalPaid: feePaid,
    totalPaidDisplay: formatMoney(feePaid),
    paymentLines: [],
    outstandingDue: 0,
    outstandingDueDisplay: formatMoney(0),
  };

  if (feePaid > 0) {
    summary.paymentLines.push({
      label: "Processing fee (prepayment)",
      amount: feePaid,
      amountDisplay: formatMoney(feePaid),
    });
  }

  const internalOrderId = Number(portalOrder?.internal_order_id);
  if (!Number.isFinite(internalOrderId) || internalOrderId <= 0) {
    return summary;
  }

  try {
    const { getPool } = require("../config/database");
    const Invoice = require("../models/Invoice");
    const InvoiceXray = require("../models/InvoiceXray");
    const {
      hasStandardInvoiceFields,
      hasXrayInvoiceFields,
    } = require("../utils/orderInvoicePayment");

    const pool = getPool();
    const [onlineRows] = await pool.execute(
      `SELECT amount, invoice_type, payment_method_type, stripe_payment_intent_id, invoice_number
       FROM stripe_online_payments
       WHERE order_id = :orderId
         AND status = 'succeeded'
       ORDER BY id ASC`,
      { orderId: internalOrderId }
    );

    let invoicePaidFromLedger = 0;
    for (const row of onlineRows) {
      const amount = toNumber(row.amount);
      if (amount <= 0) continue;

      const intentId = String(row.stripe_payment_intent_id || "");
      const isProcessingFee =
        row.payment_method_type === "wallet" && intentId.startsWith("wallet_tx_");

      // Processing fee already counted from portal order payment_amount.
      if (isProcessingFee) continue;

      invoicePaidFromLedger += amount;
      const typeLabel =
        row.invoice_type === "xray" ? "X-Ray invoice" : "Regular invoice";
      summary.paymentLines.push({
        label: row.invoice_number
          ? `${typeLabel} (${row.invoice_number})`
          : typeLabel,
        amount,
        amountDisplay: formatMoney(amount),
      });
    }

    // Fallback if invoice was marked paid without a ledger row yet.
    if (invoicePaidFromLedger <= 0) {
      const [invoice, xray] = await Promise.all([
        Invoice.findByOrderId(internalOrderId),
        InvoiceXray.findByOrderId(internalOrderId),
      ]);

      if (invoice && hasStandardInvoiceFields(invoice)) {
        const paid = toNumber(invoice.amount_paid);
        if (paid > 0) {
          // Invoice amount_paid is the full invoice total; subtract fee already shown.
          const invoicePortion = Math.max(0, paid - feePaid);
          if (invoicePortion > 0) {
            invoicePaidFromLedger += invoicePortion;
            summary.paymentLines.push({
              label: invoice.invoice_number
                ? `Regular invoice (${invoice.invoice_number})`
                : "Regular invoice",
              amount: invoicePortion,
              amountDisplay: formatMoney(invoicePortion),
            });
          }
        }
      }

      if (xray && hasXrayInvoiceFields(xray)) {
        const paid = toNumber(xray.amount_paid);
        if (paid > 0) {
          invoicePaidFromLedger += paid;
          summary.paymentLines.push({
            label: xray.invoice_number
              ? `X-Ray invoice (${xray.invoice_number})`
              : "X-Ray invoice",
            amount: paid,
            amountDisplay: formatMoney(paid),
          });
        }
      }
    }

    summary.invoicePaid = Number(invoicePaidFromLedger.toFixed(2));
    summary.invoicePaidDisplay = formatMoney(summary.invoicePaid);
    summary.totalPaid = Number((feePaid + summary.invoicePaid).toFixed(2));
    summary.totalPaidDisplay = formatMoney(summary.totalPaid);

    // Outstanding unpaid invoice balances for display context.
    const {
      buildCompanyPortalInvoicePaymentLinks,
    } = require("./companyPortalStageHooks");
    const unpaidLinks = await buildCompanyPortalInvoicePaymentLinks(
      internalOrderId
    );
    summary.outstandingDue = Number(
      unpaidLinks
        .reduce((sum, link) => sum + toNumber(link.due), 0)
        .toFixed(2)
    );
    summary.outstandingDueDisplay = formatMoney(summary.outstandingDue);
  } catch (error) {
    console.warn(
      "[company-portal] Unable to build payment summary:",
      error.message || error
    );
  }

  return summary;
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
  return withPortalDownloadAvailability(formatOrder(order), order);
}

async function trackOrderByNumber(orderNumber, companyUserId, { employeeId = null } = {}) {
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
  let paymentLinks = [];

  if (order.internal_order_id) {
    try {
      const {
        buildCompanyPortalInvoicePaymentLinks,
      } = require("./companyPortalStageHooks");
      paymentLinks = await buildCompanyPortalInvoicePaymentLinks(
        order.internal_order_id
      );
    } catch (error) {
      console.warn(
        "[company-portal] Unable to build track payment links:",
        error.message || error
      );
    }
  }

  let walletBalance = null;
  try {
    const companyPortalWalletService = require("./companyPortalWalletService");
    walletBalance = await companyPortalWalletService.getAvailableOrderBalance(
      companyUserId,
      employeeId
    );
  } catch (error) {
    console.warn(
      "[company-portal] Unable to load wallet balance for track page:",
      error.message || error
    );
  }

  const paymentSummary = await buildPortalOrderPaymentSummary(order);

  return {
    ...(await withPortalDownloadAvailability(formatted, order)),
    paymentLinks,
    hasUnpaidInvoices: paymentLinks.length > 0,
    walletBalance: walletBalance?.amount ?? null,
    walletBalanceDisplay:
      walletBalance != null ? formatMoney(walletBalance.amount) : null,
    walletBalanceSource: walletBalance?.source || null,
    // Track/details page should show total collected, not only the $15 fee.
    paymentAmount: paymentSummary.totalPaid,
    paymentAmountDisplay: paymentSummary.totalPaidDisplay,
    paymentSummary,
  };
}

async function createCheckout(
  companyUserId,
  { uploadToken, details, paymentMethod = "wallet", employeeId = null, placedByName = null }
) {
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

  const resolvedPlacedByName =
    placedByName ||
    (employeeId ? null : companyUser?.company_name || "Company Account");

  if (paymentMethod !== "wallet") {
    throw new ApiError(400, "Company portal orders must be paid from wallet balance");
  }

  return payWithWallet(companyUserId, {
    pending,
    payload,
    uploadToken,
    employeeId,
    placedByName: resolvedPlacedByName,
  });
}

async function formatPaidPortalOrder(orderRow) {
  if (!orderRow) return null;

  if (orderRow.payment_status === "paid" && !orderRow.internal_order_id) {
    try {
      const companyPortalInternalSyncService = require("./companyPortalInternalSyncService");
      await companyPortalInternalSyncService.ensureInternalOrderForPortalOrder(
        orderRow
      );
      const refreshed = await CompanyPortalOrder.findById(orderRow.id);
      return formatOrder(refreshed || orderRow);
    } catch (error) {
      console.warn(
        "[company-portal] Lazy internal sync failed:",
        error.message || error
      );
    }
  }

  return formatOrder(orderRow);
}

async function createOrderFromPending(
  pending,
  session,
  stripeDetails,
  {
    employeeId = null,
    placedByName = null,
    paymentMethod = "stripe",
  } = {}
) {
  const payload = parsePendingPayload(pending);
  const recordFlags = normalizeRecordTypeFlags(payload);
  const orderNumber = await allocateOrderNumber();

  const order = await CompanyPortalOrder.createPaidOrder({
    companyUserId: pending.company_user_id,
    companyPortalEmployeeId: employeeId || null,
    placedByName: placedByName || null,
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
    paymentMethod,
    stripeCheckoutSessionId: session?.id || null,
    stripePaymentIntentId:
      stripeDetails?.paymentIntentId ||
      (typeof session?.payment_intent === "string"
        ? session.payment_intent
        : session?.payment_intent?.id || null),
    stripeReceiptUrl: stripeDetails?.receiptUrl || null,
  });

  if (paymentMethod === "wallet") {
    const companyPortalWalletService = require("./companyPortalWalletService");
    await companyPortalWalletService.debitForOrder({
      companyUserId: pending.company_user_id,
      employeeId,
      amount: pending.payment_amount || COMPANY_PORTAL_ORDER_FEE,
      orderId: order.id,
      description: `Order ${orderNumber} payment`,
    });
  }

  await CompanyPortalPendingCheckout.deleteById(pending.id);

  const refreshedOrder = await CompanyPortalOrder.findById(order.id);

  try {
    const companyPortalInternalSyncService = require("./companyPortalInternalSyncService");
    await companyPortalInternalSyncService.ensureInternalOrderForPortalOrder(
      refreshedOrder || order
    );
  } catch (error) {
    console.warn(
      "[company-portal] Failed to sync internal order:",
      error.message || error
    );
  }

  const refreshed = await CompanyPortalOrder.findById(order.id);
  return formatOrder(refreshed || order);
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
      return formatPaidPortalOrder(refreshed);
    }
    return formatPaidPortalOrder(existingBySession);
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

  return createOrderFromPending(pending, session, stripeDetails, {
    paymentMethod: "stripe",
  });
}

async function payWithWallet(
  companyUserId,
  { pending, payload, uploadToken, employeeId, placedByName }
) {
  const companyPortalWalletService = require("./companyPortalWalletService");
  const fee = COMPANY_PORTAL_ORDER_FEE;

  if (employeeId) {
    const CompanyPortalEmployee = require("../models/CompanyPortalEmployee");
    const employee = await CompanyPortalEmployee.findByIdForCompany(
      employeeId,
      companyUserId
    );
    if (companyPortalWalletService.toMoney(employee?.wallet_balance) < fee) {
      throw new ApiError(400, "Insufficient employee wallet balance", [
        {
          field: "paymentMethod",
          message: "Your allocated balance is too low for this order",
        },
      ]);
    }
  } else {
    const CompanyPortalWallet = require("../models/CompanyPortalWallet");
    const wallet = await CompanyPortalWallet.ensureForCompany(companyUserId);
    if (companyPortalWalletService.toMoney(wallet?.unallocated_balance) < fee) {
      throw new ApiError(400, "Insufficient company wallet balance", [
        {
          field: "paymentMethod",
          message:
            "Company wallet balance is too low. Top up funds or pay by card.",
        },
      ]);
    }
  }

  await CompanyPortalPendingCheckout.updatePayloadAndSession(pending.id, {
    payload,
    sessionId: null,
    paymentAmount: fee,
  });

  const refreshedPending = await CompanyPortalPendingCheckout.findById(pending.id);
  const order = await createOrderFromPending(
    refreshedPending || pending,
    { id: null },
    null,
    {
      employeeId,
      placedByName,
      paymentMethod: "wallet",
    }
  );

  return {
    paymentMethod: "wallet",
    order,
    uploadToken,
    amount: fee,
    amountDisplay: formatMoney(fee),
  };
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

async function listOrders(
  companyUserId,
  {
    limit = 20,
    pagination = null,
    cursor = null,
    pageSize = 10,
    employeeId = null,
  } = {}
) {
  const useKeyset = String(pagination || "").toLowerCase() === "keyset";

  if (useKeyset) {
    const keyset = await CompanyPortalOrder.listForUserKeyset(companyUserId, {
      cursor,
      pageSize,
      employeeId,
    });

    return {
      orders: keyset.rows.map(formatOrder),
      pagination: {
        type: "keyset",
        pageSize: keyset.pageSize,
        hasMore: keyset.hasMore,
        nextCursor: keyset.nextCursor,
      },
    };
  }

  const rows = await CompanyPortalOrder.listForUser(companyUserId, {
    limit,
    employeeId,
  });
  return {
    orders: rows.map(formatOrder),
  };
}

async function getDashboard(companyUserId, { employeeId = null } = {}) {
  const stats = await CompanyPortalOrder.getStatsForUser(companyUserId, {
    employeeId,
  });
  return { stats };
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

  const availability = await resolvePortalDownloadAvailability(order);
  if (!availability.canDownloadDocuments) {
    throw new ApiError(
      availability.downloadExpired ? 410 : 403,
      availability.downloadUnavailableReason ||
        "Download records is not available because 7 days have passed since the records were sent."
    );
  }

  // Prefer scanned medical/other records from the linked internal order.
  if (order.internal_order_id) {
    const Order = require("../models/Order");
    const {
      resolveOrderRecordFiles,
    } = require("./recordDownloadService");
    const internalOrder = await Order.findById(order.internal_order_id);
    if (internalOrder) {
      const { files } = await resolveOrderRecordFiles(internalOrder);
      if (files.length) {
        return {
          kind: "records",
          files,
          orderNumber: order.order_number || String(order.id),
        };
      }
    }
  }

  const subpoena = await getSubpoenaFile(orderId, companyUserId);
  return {
    kind: "subpoena",
    absolutePath: subpoena.absolutePath,
    fileName: subpoena.fileName,
  };
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
    paymentMethodType:
      order.payment_method === "wallet" ? "wallet" : "card",
    cardBrand: null,
    cardLast4: null,
    customerEmail: order.contact_email || null,
    customerName: order.company_name || null,
    receiptUrl: order.stripe_receipt_url || null,
    paymentIntentId: null,
  };

  if (order.payment_method === "wallet") {
    const CompanyPortalWalletTransaction = require("../models/CompanyPortalWalletTransaction");
    const walletTx =
      await CompanyPortalWalletTransaction.findOrderPaymentByPortalOrderId(
        order.id
      );
    if (walletTx) {
      stripeDetails.paymentIntentId = `wallet_tx_${walletTx.id}`;
    }
  } else {
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
