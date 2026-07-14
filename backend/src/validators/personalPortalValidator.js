const {
  trimToString,
  isBlank,
  isValidEmail,
  isValidIsoDate,
  isFutureDate,
  addMaxLengthError,
} = require("./validationHelpers");
const {
  addPersonNameFormatError,
  addNoHtmlMarkupError,
} = require("../utils/nameValidation");

const ALLOWED_RECORD_TYPES = new Set(["medical", "billing", "xrays"]);
const ALLOWED_DELIVERY = new Set(["download", "mail"]);
const DRIVER_LICENSE_PATTERN = /^[A-Za-z0-9-]{4,20}$/;

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
  const email = trimToString(body.email).toLowerCase();

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
  const sessionToken = trimToString(body.sessionToken);
  const code = trimToString(body.code);

  if (isBlank(sessionToken)) {
    errors.push({ field: "sessionToken", message: "Verification session expired. Request a new code." });
  }

  if (isBlank(code)) {
    errors.push({ field: "code", message: "Verification code is required" });
  } else if (!/^\d{6}$/.test(code)) {
    errors.push({ field: "code", message: "Enter the 6-digit verification code" });
  }

  return { valid: errors.length === 0, errors, sessionToken, code };
}

function validatePersonalRequestSubmit(body = {}) {
  const errors = [];

  if (isBlank(body.firstName)) {
    errors.push({ field: "firstName", message: "First name is required" });
  } else {
    addMaxLengthError(errors, "firstName", body.firstName, 100);
    addPersonNameFormatError(errors, "firstName", body.firstName);
  }

  if (isBlank(body.lastName)) {
    errors.push({ field: "lastName", message: "Last name is required" });
  } else {
    addMaxLengthError(errors, "lastName", body.lastName, 100);
    addPersonNameFormatError(errors, "lastName", body.lastName);
  }

  const dobIso = parseMmDdYyyy(body.dob);
  if (!dobIso) {
    errors.push({ field: "dob", message: "Enter date of birth as MM/DD/YYYY" });
  } else if (isFutureDate(dobIso)) {
    errors.push({ field: "dob", message: "Date of birth cannot be in the future" });
  }

  if (isBlank(body.treatingFacilityName)) {
    errors.push({ field: "treatingFacilityName", message: "Treating facility name is required" });
  } else {
    addMaxLengthError(errors, "treatingFacilityName", body.treatingFacilityName, 255);
    addNoHtmlMarkupError(errors, "treatingFacilityName", body.treatingFacilityName);
  }

  if (isBlank(body.treatingFacilityAddress)) {
    errors.push({
      field: "treatingFacilityAddress",
      message: "Treating facility address is required",
    });
  } else {
    addNoHtmlMarkupError(errors, "treatingFacilityAddress", body.treatingFacilityAddress);
  }

  let facilityId = null;
  const rawFacilityId = trimToString(body.facilityId);
  if (!isBlank(rawFacilityId)) {
    const parsedFacilityId = Number(rawFacilityId);
    if (!Number.isInteger(parsedFacilityId) || parsedFacilityId <= 0) {
      errors.push({ field: "facilityId", message: "Invalid treating facility selection" });
    } else {
      facilityId = parsedFacilityId;
    }
  }

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

  const normalizedTypes = recordTypes
    .map((value) => trimToString(value).toLowerCase())
    .filter((value) => ALLOWED_RECORD_TYPES.has(value));

  if (!normalizedTypes.length) {
    errors.push({
      field: "recordTypes",
      message: "Select at least one record type (Medical, Billing, or X-Ray)",
    });
  }

  const deliveryPreference = trimToString(body.deliveryPreference).toLowerCase();
  if (!ALLOWED_DELIVERY.has(deliveryPreference)) {
    errors.push({
      field: "deliveryPreference",
      message: "Select download or mail delivery",
    });
  }

  if (deliveryPreference === "mail" && isBlank(body.mailAddress)) {
    errors.push({
      field: "mailAddress",
      message: "Mailing address is required for mail delivery",
    });
  } else if (!isBlank(body.mailAddress)) {
    addNoHtmlMarkupError(errors, "mailAddress", body.mailAddress);
  }

  const driverLicenseNumber = trimToString(body.driverLicenseNumber);
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

  const email = trimToString(body.email).toLowerCase();
  if (isBlank(email) || !isValidEmail(email)) {
    errors.push({ field: "email", message: "A verified email is required" });
  }

  if (isBlank(body.emailVerificationToken)) {
    errors.push({
      field: "emailVerificationToken",
      message: "Email verification is required before submitting",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    parsed: {
      firstName: trimToString(body.firstName),
      lastName: trimToString(body.lastName),
      dobIso,
      facilityId,
      treatingFacilityName: trimToString(body.treatingFacilityName),
      treatingFacilityAddress: trimToString(body.treatingFacilityAddress),
      recordsDateBeginIso: recordsBeginIso,
      recordsDateEndIso: recordsEndIso,
      recordTypes: normalizedTypes,
      deliveryPreference,
      mailAddress: trimToString(body.mailAddress) || null,
      driverLicenseNumber,
      email,
      emailVerificationToken: trimToString(body.emailVerificationToken),
    },
  };
}

function validateStatusLookup(body = {}) {
  const errors = [];
  const confirmationReference = trimToString(body.confirmationReference);
  const driverLicenseNumber = trimToString(body.driverLicenseNumber);

  if (isBlank(confirmationReference) && isBlank(driverLicenseNumber)) {
    errors.push({
      field: "lookup",
      message: "Enter your confirmation reference or driver's license number",
    });
  }

  if (!isBlank(driverLicenseNumber) && !DRIVER_LICENSE_PATTERN.test(driverLicenseNumber)) {
    errors.push({
      field: "driverLicenseNumber",
      message: "Enter a valid driver's license number",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    confirmationReference: confirmationReference || null,
    driverLicenseNumber: driverLicenseNumber || null,
  };
}

module.exports = {
  validateEmailOtpRequest,
  validateEmailOtpConfirm,
  validatePersonalRequestSubmit,
  validateStatusLookup,
  parseMmDdYyyy,
};
