const ApiError = require("./ApiError");

const DEFAULT_TEXT_MAX_LENGTH = 4000;
const DEFAULT_SEARCH_MAX_LENGTH = 200;

/**
 * Remove null bytes and dangerous control characters while keeping normal whitespace.
 */
function stripControlCharacters(value) {
  return `${value || ""}`.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

/**
 * Remove angle brackets so user text cannot become HTML/script when rendered in emails or rich views.
 */
function stripHtmlMarkup(value) {
  return `${value || ""}`.replace(/[<>]/g, "");
}

/**
 * Normalize and bound free-text input before storage or logging.
 */
function sanitizeText(value, { maxLength = DEFAULT_TEXT_MAX_LENGTH, allowEmpty = false } = {}) {
  const cleaned = stripHtmlMarkup(stripControlCharacters(value)).trim();

  if (!cleaned && !allowEmpty) {
    return "";
  }

  if (cleaned.length > maxLength) {
    return cleaned.slice(0, maxLength);
  }

  return cleaned;
}

/**
 * Normalize search/filter text from query strings.
 */
function sanitizeSearchText(value, { maxLength = DEFAULT_SEARCH_MAX_LENGTH } = {}) {
  return sanitizeText(value, { maxLength, allowEmpty: true });
}

/**
 * Escape HTML entities for email templates and other HTML output.
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function assertMaxLength(value, fieldName, maxLength) {
  const cleaned = sanitizeText(value, { maxLength, allowEmpty: true });
  if (`${value || ""}`.trim().length > maxLength) {
    throw new ApiError(400, `${fieldName} cannot exceed ${maxLength} characters`);
  }
  return cleaned;
}

/**
 * Trim, strip control characters, and return null for empty values.
 */
function sanitizeTrimOrNull(value, options = {}) {
  if (value === undefined || value === null) return null;
  const cleaned = sanitizeText(value, {
    maxLength: options.maxLength || DEFAULT_TEXT_MAX_LENGTH,
    allowEmpty: true,
  });
  return cleaned === "" ? null : cleaned;
}

module.exports = {
  DEFAULT_TEXT_MAX_LENGTH,
  DEFAULT_SEARCH_MAX_LENGTH,
  stripControlCharacters,
  stripHtmlMarkup,
  sanitizeText,
  sanitizeSearchText,
  sanitizeTrimOrNull,
  escapeHtml,
  assertMaxLength,
  TEXT_FIELD_MAX_LENGTH: require("./fieldLimits").TEXT_FIELD_MAX_LENGTH,
};
