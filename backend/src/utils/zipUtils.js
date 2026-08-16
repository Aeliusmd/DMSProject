/**
 * US ZIP limits from batch_scan extracts (5 or ZIP+4) and USPS rules.
 * Sanitize typed input; never cut a valid extracted ZIP+4 down to 5 digits.
 */
const ZIP_MIN_DIGITS = 5;
const ZIP_MAX_DIGITS = 9;
const ZIP_MIN_CHARS = 5;
const ZIP_MAX_CHARS = 10; // 12345-6789
const ZIP_VALIDATION_MESSAGE = "ZIP must be 5 digits or ZIP+4";

function getZipDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, ZIP_MAX_DIGITS);
}

function sanitizeZip(value) {
  const digits = getZipDigits(value);
  if (!digits) return "";
  if (digits.length > ZIP_MIN_DIGITS) {
    return `${digits.slice(0, ZIP_MIN_DIGITS)}-${digits.slice(ZIP_MIN_DIGITS)}`;
  }
  return digits;
}

function sanitizeZipOrNull(value) {
  return sanitizeZip(value) || null;
}

function isValidZip(value, { required = false } = {}) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return !required;
  return digits.length === ZIP_MIN_DIGITS || digits.length === ZIP_MAX_DIGITS;
}

function zipValidationError(value, { required = false } = {}) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) {
    return required ? "ZIP code is required" : "";
  }
  if (!isValidZip(value)) {
    return ZIP_VALIDATION_MESSAGE;
  }
  return "";
}

module.exports = {
  ZIP_MIN_DIGITS,
  ZIP_MAX_DIGITS,
  ZIP_MIN_CHARS,
  ZIP_MAX_CHARS,
  ZIP_VALIDATION_MESSAGE,
  getZipDigits,
  sanitizeZip,
  sanitizeZipOrNull,
  isValidZip,
  zipValidationError,
};
