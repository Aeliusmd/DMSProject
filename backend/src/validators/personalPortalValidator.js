const {
  trimToString,
  isBlank,
  isValidEmail,
  isValidIsoDate,
  isFutureDate,
  addMaxLengthError,
  isValidPositiveIntId,
} = require("./validationHelpers");
const { sanitizeText } = require("../utils/sanitize");
const {
  addPersonNameFormatError,
  addNoHtmlMarkupError,
  hasHtmlMarkup,
  htmlMarkupMessage,
} = require("../utils/nameValidation");

const ALLOWED_RECORD_TYPES = new Set(["medical", "billing", "xrays"]);
const ALLOWED_DELIVERY = new Set(["download", "mail"]);
const DRIVER_LICENSE_PATTERN = /^[A-Za-z0-9-]{4,20}$/;
const MAX_LIST_PAGE_SIZE = 100;
const MAX_CONFIRMATION_REF_LENGTH = 64;
const MAX_FACILITY_ADDRESS_LENGTH = 500;
const MAX_MAIL_ADDRESS_LENGTH = 500;

function sanitizeField(value, maxLength) {
  return sanitizeText(value, { maxLength, allowEmpty: true });
}

function parseMmDdYyyy(value) {
  const trimmed = trimToString(value);
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  if (!isValidIsoDate(iso)) return null;
  return iso;
}

function validateEmailOtpRequest(body = {}) {
  const errors = [];
  const email = sanitizeField(body.email, 255).toLowerCase();

  if (isBlank(email)) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!isValidEmail(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  } else {
    addMaxLengthError(errors, "email", email, 255);
  }

  return { valid: errors.length === 0, errors, email };
}

function validateEmailOtpConfirm(body = {}) {
  const errors = [];
  const sessionToken = sanitizeField(body.sessionToken, 255);
  const code = trimToString(body.code);

  if (isBlank(sessionToken)) {
    errors.push({
      field: "sessionToken",
      message: "Verification session expired. Request a new code.",
    });
  }

  if (isBlank(code)) {
    errors.push({ field: "code", message: "Verification code is required" });
  } else if (!/^\d{6}$/.test(code)) {
    errors.push({
      field: "code",
      message: "Enter the 6-digit verification code",
    });
  }

  return { valid: errors.length === 0, errors, sessionToken, code };
}

function validatePersonalRequestSubmit(body = {}, options = {}) {
  const errors = [];
  const firstName = sanitizeField(body.firstName, 100);
  const lastName = sanitizeField(body.lastName, 100);
  const treatingFacilityName = sanitizeField(body.treatingFacilityName, 255);
  const treatingFacilityAddress = sanitizeField(
    body.treatingFacilityAddress,
    MAX_FACILITY_ADDRESS_LENGTH
  );
  const mailAddress = sanitizeField(body.mailAddress, MAX_MAIL_ADDRESS_LENGTH);
  const driverLicenseNumber = sanitizeField(body.driverLicenseNumber, 20);
  const email = sanitizeField(body.email, 255).toLowerCase();
  const emailVerificationToken = sanitizeField(
    body.emailVerificationToken,
    512
  );

  if (isBlank(firstName)) {
    errors.push({ field: "firstName", message: "First name is required" });
  } else {
    addMaxLengthError(errors, "firstName", firstName, 100);
    addPersonNameFormatError(errors, "firstName", firstName);
  }

  if (isBlank(lastName)) {
    errors.push({ field: "lastName", message: "Last name is required" });
  } else {
    addMaxLengthError(errors, "lastName", lastName, 100);
    addPersonNameFormatError(errors, "lastName", lastName);
  }

  const dobIso = parseMmDdYyyy(body.dob);
  if (!dobIso) {
    errors.push({ field: "dob", message: "Enter date of birth as MM/DD/YYYY" });
  } else if (isFutureDate(dobIso)) {
    errors.push({
      field: "dob",
      message: "Date of birth cannot be in the future",
    });
  }

  if (isBlank(treatingFacilityAddress)) {
    errors.push({
      field: "treatingFacilityAddress",
      message: "Treating facility address is required",
    });
  } else {
    addMaxLengthError(
      errors,
      "treatingFacilityAddress",
      treatingFacilityAddress,
      MAX_FACILITY_ADDRESS_LENGTH
    );
    addNoHtmlMarkupError(
      errors,
      "treatingFacilityAddress",
      treatingFacilityAddress
    );
  }

  // Address is the gate. Facility name is optional and does not block submission.
  if (!isBlank(treatingFacilityName)) {
    addMaxLengthError(errors, "treatingFacilityName", treatingFacilityName, 255);
    addNoHtmlMarkupError(errors, "treatingFacilityName", treatingFacilityName);
  }

  const treatingDoctor = sanitizeField(
    body.treatingDoctor || body.treatingDoctorName || "",
    255
  );
  if (!isBlank(treatingDoctor)) {
    addMaxLengthError(errors, "treatingDoctor", treatingDoctor, 255);
    addNoHtmlMarkupError(errors, "treatingDoctor", treatingDoctor);
  }

  let facilityId = null;
  const rawFacilityId = trimToString(body.facilityId);
  if (!isBlank(rawFacilityId)) {
    const parsedFacilityId = Number(rawFacilityId);
    if (!Number.isInteger(parsedFacilityId) || parsedFacilityId <= 0) {
      errors.push({
        field: "facilityId",
        message: "Invalid treating facility selection",
      });
    } else {
      facilityId = parsedFacilityId;
    }
  }

  // Manual lookup when not linked to a known facilities.id row.
  // External users never create facilities; unmatched entries are flagged.
  const isManualLookup = !facilityId;

  const recordsBeginIso = parseMmDdYyyy(body.recordsDateBegin);
  const recordsEndIso = parseMmDdYyyy(body.recordsDateEnd);

  if (!recordsBeginIso) {
    errors.push({
      field: "recordsDateBegin",
      message: "Enter records start date as MM/DD/YYYY",
    });
  }

  if (!recordsEndIso) {
    errors.push({
      field: "recordsDateEnd",
      message: "Enter records end date as MM/DD/YYYY",
    });
  }

  if (recordsBeginIso && recordsEndIso && recordsEndIso < recordsBeginIso) {
    errors.push({
      field: "recordsDateEnd",
      message: "Records end date must be on or after start date",
    });
  }

  let recordTypes = [];
  try {
    const raw = body.recordTypes;
    recordTypes = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? JSON.parse(raw)
        : [];
  } catch {
    recordTypes = [];
  }

  const normalizedTypes = [
    ...new Set(
      recordTypes
        .map((value) => sanitizeField(value, 40).toLowerCase())
        .filter((value) => ALLOWED_RECORD_TYPES.has(value))
    ),
  ];

  if (!normalizedTypes.length) {
    errors.push({
      field: "recordTypes",
      message: "Select at least one record type (Medical, Billing, or X-Ray)",
    });
  }

  const deliveryPreference = sanitizeField(
    body.deliveryPreference,
    20
  ).toLowerCase();
  if (!ALLOWED_DELIVERY.has(deliveryPreference)) {
    errors.push({
      field: "deliveryPreference",
      message: "Select download or mail delivery",
    });
  }

  if (deliveryPreference === "mail" && isBlank(mailAddress)) {
    errors.push({
      field: "mailAddress",
      message: "Mailing address is required for mail delivery",
    });
  } else if (!isBlank(mailAddress)) {
    addMaxLengthError(errors, "mailAddress", mailAddress, MAX_MAIL_ADDRESS_LENGTH);
    addNoHtmlMarkupError(errors, "mailAddress", mailAddress);
  }

  if (isBlank(driverLicenseNumber)) {
    errors.push({
      field: "driverLicenseNumber",
      message: "Driver's license number is required",
    });
  } else if (!DRIVER_LICENSE_PATTERN.test(driverLicenseNumber)) {
    errors.push({
      field: "driverLicenseNumber",
      message: "Enter a valid driver's license number (4–20 letters or numbers)",
    });
  }

  if (isBlank(email) || !isValidEmail(email)) {
    errors.push({ field: "email", message: "A verified email is required" });
  }

  const skipEmailToken = Boolean(options.authenticated);
  if (!skipEmailToken && isBlank(emailVerificationToken)) {
    errors.push({
      field: "emailVerificationToken",
      message: "Email verification is required before submitting",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed: {
      firstName,
      lastName,
      dobIso,
      facilityId,
      treatingFacilityName,
      treatingFacilityAddress,
      treatingDoctor: treatingDoctor || null,
      isManualLookup,
      recordsDateBeginIso: recordsBeginIso,
      recordsDateEndIso: recordsEndIso,
      recordTypes: normalizedTypes,
      deliveryPreference,
      mailAddress: mailAddress || null,
      driverLicenseNumber,
      email,
      emailVerificationToken,
    },
  };
}

function parseDobInput(value) {
  const trimmed = trimToString(value);
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && isValidIsoDate(trimmed)) {
    return trimmed;
  }

  return parseMmDdYyyy(trimmed);
}

function normalizeStoredDob(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const asString = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(asString)) {
    return asString.slice(0, 10);
  }

  return parseDobInput(asString);
}

function validateStatusLookup(body = {}) {
  const errors = [];
  const confirmationReference = sanitizeField(
    body.confirmationReference,
    MAX_CONFIRMATION_REF_LENGTH
  ).toUpperCase();
  const dobIso = parseDobInput(body.dob);

  if (isBlank(confirmationReference)) {
    errors.push({
      field: "confirmationReference",
      message: "Enter your order / confirmation number",
    });
  } else {
    addMaxLengthError(
      errors,
      "confirmationReference",
      confirmationReference,
      MAX_CONFIRMATION_REF_LENGTH
    );
    if (hasHtmlMarkup(confirmationReference)) {
      errors.push({
        field: "confirmationReference",
        message: htmlMarkupMessage("confirmationReference"),
      });
    }
  }

  if (!dobIso) {
    errors.push({
      field: "dob",
      message: "Enter date of birth as MM/DD/YYYY",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    confirmationReference: confirmationReference || null,
    dobIso,
  };
}

function validateRequestEmailUpdate(body = {}) {
  const lookup = validateStatusLookup(body);
  const errors = [...lookup.errors];
  const email = sanitizeField(body.email, 255).toLowerCase();

  if (!email || !isValidEmail(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  } else {
    addMaxLengthError(errors, "email", email, 255);
  }

  return {
    valid: errors.length === 0,
    errors,
    confirmationReference: lookup.confirmationReference,
    dobIso: lookup.dobIso,
    email,
  };
}

function validatePersonalAccountEmailUpdate(body = {}) {
  const errors = [];
  const email = sanitizeField(body.email, 255).toLowerCase();

  if (!email || !isValidEmail(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  } else {
    addMaxLengthError(errors, "email", email, 255);
  }

  return {
    valid: errors.length === 0,
    errors,
    email,
  };
}

function validatePersonalRequestsListQuery(query = {}) {
  const errors = [];
  let pageSize = 10;

  if (!isBlank(query.pageSize) || !isBlank(query.limit)) {
    const parsed = Number(query.pageSize || query.limit);
    if (
      !Number.isFinite(parsed) ||
      !Number.isInteger(parsed) ||
      parsed < 1 ||
      parsed > MAX_LIST_PAGE_SIZE
    ) {
      errors.push({
        field: "pageSize",
        message: `pageSize must be between 1 and ${MAX_LIST_PAGE_SIZE}`,
      });
    } else {
      pageSize = parsed;
    }
  }

  const cursor = trimToString(query.cursor);
  if (cursor && cursor.length > 500) {
    errors.push({ field: "cursor", message: "Invalid cursor" });
  } else if (cursor && hasHtmlMarkup(cursor)) {
    errors.push({ field: "cursor", message: htmlMarkupMessage("cursor") });
  }

  const status = sanitizeField(query.status, 40).toLowerCase();
  const allowedStatuses = new Set([
    "",
    "in_process",
    "invoice",
    "paid",
    "released",
  ]);
  if (status && !allowedStatuses.has(status)) {
    errors.push({ field: "status", message: "Invalid status filter" });
  }

  return {
    valid: errors.length === 0,
    errors,
    pageSize,
    cursor: cursor || null,
    status: status || null,
  };
}

function validatePersonalCheckoutResultQuery(query = {}) {
  const errors = [];
  const requestIdRaw = trimToString(query.request_id || query.requestId);
  const sessionId = sanitizeField(
    query.session_id || query.sessionId,
    255
  );

  if (!requestIdRaw) {
    errors.push({ field: "request_id", message: "request_id is required" });
  } else if (!isValidPositiveIntId(requestIdRaw)) {
    errors.push({ field: "request_id", message: "Invalid request id" });
  }

  if (!sessionId) {
    errors.push({ field: "session_id", message: "session_id is required" });
  } else if (hasHtmlMarkup(sessionId)) {
    errors.push({ field: "session_id", message: htmlMarkupMessage("session_id") });
  }

  return {
    valid: errors.length === 0,
    errors,
    requestId: Number(requestIdRaw),
    sessionId,
  };
}

module.exports = {
  validateEmailOtpRequest,
  validateEmailOtpConfirm,
  validatePersonalRequestSubmit,
  validateStatusLookup,
  validateRequestEmailUpdate,
  validatePersonalAccountEmailUpdate,
  validatePersonalRequestsListQuery,
  validatePersonalCheckoutResultQuery,
  parseMmDdYyyy,
  parseDobInput,
  normalizeStoredDob,
  MAX_LIST_PAGE_SIZE,
};
