/**
 * US ZIP limits from batch_scan extracts (5 or ZIP+4) and USPS rules.
 * Sanitize typed input; never cut a valid extracted ZIP+4 down to 5 digits.
 */
export const ZIP_MIN_DIGITS = 5;
export const ZIP_MAX_DIGITS = 9;
export const ZIP_MIN_CHARS = 5;
export const ZIP_MAX_CHARS = 10; // 12345-6789
export const ZIP_VALIDATION_MESSAGE = "ZIP must be 5 digits or ZIP+4";

export function getZipDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, ZIP_MAX_DIGITS);
}

export function sanitizeZip(value) {
  const digits = getZipDigits(value);
  if (!digits) return "";
  if (digits.length > ZIP_MIN_DIGITS) {
    return `${digits.slice(0, ZIP_MIN_DIGITS)}-${digits.slice(ZIP_MIN_DIGITS)}`;
  }
  return digits;
}

export function isValidZip(value, { required = false } = {}) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return !required;
  return digits.length === ZIP_MIN_DIGITS || digits.length === ZIP_MAX_DIGITS;
}

export function zipValidationError(value, { required = false } = {}) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) {
    return required ? "ZIP code is required" : "";
  }
  if (!isValidZip(value)) {
    return ZIP_VALIDATION_MESSAGE;
  }
  return "";
}
