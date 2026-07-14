const {
  trimToString,
  isBlank,
  isValidPositiveIntId,
  addOptionalIsoDateError,
  addMaxLengthError,
} = require("./validationHelpers");
const { hasHtmlMarkup, htmlMarkupMessage } = require("../utils/nameValidation");
const { toSqlDateOnly } = require("../utils/dateUtils");

const MAX_NOTIFICATION_LIMIT = 100;
const MAX_PAGE_SIZE = 100;
const MAX_PAYMENT_LIST_LIMIT = 500;
const DEFAULT_PAYMENT_LIST_LIMIT = 100;
const MAX_SEARCH_LENGTH = 200;
const MAX_ROUTE_ID = Number.MAX_SAFE_INTEGER;

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
  } else if (hasHtmlMarkup(value)) {
    errors.push({ field: fieldName, message: htmlMarkupMessage(fieldName) });
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
  } else if (hasHtmlMarkup(orderRef)) {
    errors.push({ field: "orderId", message: htmlMarkupMessage("orderId") });
  }

  return { valid: errors.length === 0, errors };
}

function validatePaymentListQuery(query = {}) {
  const errors = [];
  const orderSearch = trimToString(
    query.orderSearch ||
      (!isValidPositiveIntId(query.orderId) ? query.orderId : "") ||
      ""
  );
  const invoiceSearch = trimToString(query.invoiceSearch || "");

  if (
    !isBlank(query.orderId) &&
    !isValidPositiveIntId(query.orderId) &&
    isBlank(query.orderSearch)
  ) {
    // Non-numeric orderId is treated as orderSearch text; accept printable refs.
    if (!orderSearch) {
      errors.push({ field: "orderId", message: "Invalid order id" });
    }
  }

  addMaxLengthError(errors, "orderSearch", orderSearch, MAX_SEARCH_LENGTH);
  addMaxLengthError(errors, "invoiceSearch", invoiceSearch, MAX_SEARCH_LENGTH);

  if (orderSearch && hasHtmlMarkup(orderSearch)) {
    errors.push({ field: "orderSearch", message: htmlMarkupMessage("orderSearch") });
  }
  if (invoiceSearch && hasHtmlMarkup(invoiceSearch)) {
    errors.push({
      field: "invoiceSearch",
      message: htmlMarkupMessage("invoiceSearch"),
    });
  }

  addOptionalIsoDateError(errors, "dateFrom", query.dateFrom);
  addOptionalIsoDateError(errors, "dateTo", query.dateTo);

  if (!isBlank(query.limit)) {
    const limit = Number(query.limit);

    if (
      !Number.isFinite(limit) ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_PAYMENT_LIST_LIMIT
    ) {
      errors.push({
        field: "limit",
        message: `limit must be between 1 and ${MAX_PAYMENT_LIST_LIMIT}`,
      });
    }
  }

  if (!isBlank(query.pageSize)) {
    const pageSize = Number(query.pageSize);

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

  if (!isBlank(query.cursor) && String(query.cursor).length > 500) {
    errors.push({ field: "cursor", message: "Invalid cursor" });
  }

  return { valid: errors.length === 0, errors };
}

function validatePositiveIntRouteParam(value, fieldName = "id") {
  const errors = [];

  if (!isValidPositiveIntId(value)) {
    errors.push({ field: fieldName, message: `Invalid ${fieldName}` });
  } else if (Number(value) > MAX_ROUTE_ID) {
    errors.push({ field: fieldName, message: `Invalid ${fieldName}` });
  }

  return { valid: errors.length === 0, errors };
}

function parsePaymentListLimit(query = {}) {
  if (isBlank(query.limit)) {
    return DEFAULT_PAYMENT_LIST_LIMIT;
  }

  const limit = Number(query.limit);
  if (
    !Number.isFinite(limit) ||
    !Number.isInteger(limit) ||
    limit < 1
  ) {
    return DEFAULT_PAYMENT_LIST_LIMIT;
  }

  return Math.min(limit, MAX_PAYMENT_LIST_LIMIT);
}

function parsePaymentPageSize(query = {}) {
  const pageSize = Number(query.pageSize);
  if (
    !Number.isFinite(pageSize) ||
    !Number.isInteger(pageSize) ||
    pageSize < 1
  ) {
    return 10;
  }

  return Math.min(pageSize, MAX_PAGE_SIZE);
}

function wantsPaymentKeyset(query = {}) {
  return (
    String(query.pagination || "").toLowerCase() === "keyset" ||
    !isBlank(query.pageSize) ||
    !isBlank(query.cursor)
  );
}

module.exports = {
  validateNotificationQuery,
  validateOrderNotesQuery,
  validateMilestoneStatsQuery,
  validateSearchQuery,
  validateStripeCheckoutResult,
  validatePaymentSearchQuery,
  validatePaymentListQuery,
  validatePositiveIntRouteParam,
  parsePaymentListLimit,
  parsePaymentPageSize,
  wantsPaymentKeyset,
  MAX_PAYMENT_LIST_LIMIT,
  DEFAULT_PAYMENT_LIST_LIMIT,
};
