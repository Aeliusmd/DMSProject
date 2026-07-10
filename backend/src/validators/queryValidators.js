const {
  trimToString,
  isBlank,
  isValidPositiveIntId,
  addOptionalIsoDateError,
} = require("./validationHelpers");
const { toSqlDateOnly } = require("../utils/dateUtils");

const MAX_NOTIFICATION_LIMIT = 100;
const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 200;

function addOptionalDateInputError(errors, field, value) {
  if (!isBlank(value) && !toSqlDateOnly(value)) {
    errors.push({ field, message: "Enter a valid date" });
  }
}

function validateNotificationQuery(query = {}) {
  const errors = [];

  if (!isBlank(query.limit)) {
    const limit = Number(query.limit);

    if (
      !Number.isFinite(limit) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_NOTIFICATION_LIMIT
    ) {
      errors.push({
        field: "limit",
        message: `limit must be between 1 and ${MAX_NOTIFICATION_LIMIT}`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateOrderNotesQuery(query = {}) {
  const errors = [];

  addOptionalDateInputError(errors, "fromDate", query.fromDate);
  addOptionalDateInputError(errors, "toDate", query.toDate);

  if (!isBlank(query.pageSize) || !isBlank(query.limit)) {
    const pageSize = Number(query.pageSize || query.limit);

    if (
      !Number.isFinite(pageSize) ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > MAX_PAGE_SIZE
    ) {
      errors.push({
        field: "pageSize",
        message: `pageSize must be between 1 and ${MAX_PAGE_SIZE}`,
      });
    }
  }

  if (!isBlank(query.noteId) && !isValidPositiveIntId(query.noteId)) {
    errors.push({ field: "noteId", message: "Invalid note id" });
  }

  return { valid: errors.length === 0, errors };
}

function validateMilestoneStatsQuery(query = {}) {
  const errors = [];

  addOptionalIsoDateError(errors, "from", query.from);
  addOptionalIsoDateError(errors, "to", query.to);

  return { valid: errors.length === 0, errors };
}

function validateSearchQuery(query = {}, fieldName = "q") {
  const errors = [];
  const value = trimToString(query[fieldName]);

  if (value.length > MAX_SEARCH_LENGTH) {
    errors.push({
      field: fieldName,
      message: `Search must be ${MAX_SEARCH_LENGTH} characters or less`,
    });
  }

  return { valid: errors.length === 0, errors };
}

function validateStripeCheckoutResult(query = {}) {
  const errors = [];
  const sessionId = trimToString(query.session_id || query.sessionId);

  if (!sessionId) {
    errors.push({ field: "session_id", message: "session_id is required" });
  }

  return { valid: errors.length === 0, errors };
}

function validatePaymentSearchQuery(query = {}) {
  const errors = [];
  const orderRef = trimToString(query.orderId || query.q);

  if (!orderRef) {
    errors.push({ field: "orderId", message: "Order ID is required" });
  } else if (orderRef.length > MAX_SEARCH_LENGTH) {
    errors.push({
      field: "orderId",
      message: `Search must be ${MAX_SEARCH_LENGTH} characters or less`,
    });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateNotificationQuery,
  validateOrderNotesQuery,
  validateMilestoneStatsQuery,
  validateSearchQuery,
  validateStripeCheckoutResult,
  validatePaymentSearchQuery,
};
