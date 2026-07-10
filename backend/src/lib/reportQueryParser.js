const ApiError = require("../utils/ApiError");
const { sanitizeSearchText, sanitizeText } = require("../utils/sanitize");
const {
  parseOptionalIsoDate,
  assertPositiveInt,
} = require("../utils/sqlSafety");

const MAX_CURSOR_LENGTH = 512;
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 10;

const ACTIVITY_FILTER_VALUES = new Set([
  "All",
  "Invoiced",
  "Paid",
  "Unpaid",
  "Written Off",
  "Produced",
]);

const RUSH_LEVEL_VALUES = new Set(["Rush 1", "Rush 2", "Rush 3"]);
const INVOICE_REPORT_TYPES = new Set(["invoice", "xray"]);
const INVOICE_REPORT_TABS = new Set(["outstanding", "resend"]);

function assertReportDateRange(dateFrom, dateTo) {
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new ApiError(400, "Start date must be on or before end date");
  }
}

function parseReportDateFilters(
  query = {},
  { fromKey = "dateFrom", toKey = "dateTo" } = {}
) {
  const dateFrom = parseOptionalIsoDate(query[fromKey], fromKey);
  const dateTo = parseOptionalIsoDate(query[toKey], toKey);
  assertReportDateRange(dateFrom, dateTo);

  return { dateFrom, dateTo };
}

function parseReportPageSize(value, defaultSize = DEFAULT_PAGE_SIZE) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return defaultSize;
  return Math.min(Math.max(Math.floor(raw), 1), MAX_PAGE_SIZE);
}

function parseOptionalCursor(value) {
  const trimmed = `${value || ""}`.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_CURSOR_LENGTH) {
    throw new ApiError(400, "Invalid cursor");
  }
  return trimmed;
}

function hasCompanyGroupKey(query = {}) {
  const raw = query.companyGroupKey;
  return raw !== undefined && raw !== null && `${raw}`.trim() !== "";
}

function parseOptionalCompanyGroupKey(raw) {
  if (raw === undefined || raw === null || `${raw}`.trim() === "") {
    return undefined;
  }

  const key = Number(raw);
  if (!Number.isFinite(key) || key === 0) {
    throw new ApiError(400, "Invalid companyGroupKey");
  }

  return key;
}

function parseOptionalReportType(value) {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return null;
  if (!INVOICE_REPORT_TYPES.has(normalized)) return null;
  return normalized;
}

function parseOptionalReportTab(value) {
  const normalized = `${value || ""}`.trim().toLowerCase();
  if (!normalized) return null;
  if (!INVOICE_REPORT_TABS.has(normalized)) return null;
  return normalized;
}

function parseBooleanFlag(value, defaultValue = false) {
  if (value === undefined || value === null || `${value}`.trim() === "") {
    return defaultValue;
  }

  const normalized = String(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function parseInvoiceListFilters(query = {}) {
  const dates = parseReportDateFilters(query);

  return {
    ...dates,
    search: sanitizeSearchText(query.search, { maxLength: 100 }) || null,
  };
}

function parseInvoiceReportQuery(query = {}) {
  const filters = {
    ...parseInvoiceListFilters(query),
    cursor: parseOptionalCursor(query.cursor),
    pageSize: parseReportPageSize(query.pageSize),
  };

  if (hasCompanyGroupKey(query)) {
    filters.companyGroupKey = parseOptionalCompanyGroupKey(query.companyGroupKey);
  }

  return filters;
}

function parseActivityReportQuery(query = {}) {
  const dateFrom = parseOptionalIsoDate(
    query.dateFrom || query.reportDate,
    "dateFrom"
  );
  const dateTo = parseOptionalIsoDate(
    query.dateTo || query.throughDate,
    "dateTo"
  );
  assertReportDateRange(dateFrom, dateTo);

  let facilityId = null;
  const rawFacilityId = query.facilityId;

  if (rawFacilityId && `${rawFacilityId}`.trim() !== "all") {
    facilityId = assertPositiveInt(rawFacilityId, "facilityId");
  }

  const activityRaw = `${query.activity || "All"}`.trim();
  const activity = ACTIVITY_FILTER_VALUES.has(activityRaw) ? activityRaw : "All";
  const search = sanitizeSearchText(query.search, { maxLength: 150 }) || "";

  const facilityLabel =
    sanitizeText(query.facilityLabel || "All Facilities", {
      maxLength: 150,
      allowEmpty: false,
    }) || "All Facilities";

  return {
    dateFrom,
    dateTo,
    facilityId,
    activity,
    search,
    facilityLabel,
  };
}

function parseOrdersReportQuery(query = {}) {
  const dateFrom = parseOptionalIsoDate(
    query.dateFrom || query.fromDate,
    "dateFrom"
  );
  const dateTo = parseOptionalIsoDate(query.dateTo || query.toDate, "dateTo");
  assertReportDateRange(dateFrom, dateTo);

  const rushRaw = `${query.rushLevel || ""}`.trim();
  const rushLevel =
    rushRaw && RUSH_LEVEL_VALUES.has(rushRaw) ? rushRaw : "";

  return {
    orderNo: sanitizeSearchText(query.orderNo, { maxLength: 100 }),
    caseNumber: sanitizeSearchText(query.caseNumber, { maxLength: 100 }),
    doctor: sanitizeSearchText(query.doctor, { maxLength: 150 }),
    dateFrom,
    dateTo,
    rushLevel,
    unpaidOnly: parseBooleanFlag(query.unpaidOnly, false),
    showDuplicates: parseBooleanFlag(query.showDuplicates, true),
  };
}

function parseCompanyInvoiceQuery(query = {}) {
  return {
    ...parseInvoiceListFilters(query),
    cursor: parseOptionalCursor(query.cursor),
    pageSize: parseReportPageSize(query.pageSize),
  };
}

function parseCompanyIdParam(value) {
  return assertPositiveInt(value, "companyId");
}

module.exports = {
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  ACTIVITY_FILTER_VALUES,
  RUSH_LEVEL_VALUES,
  assertReportDateRange,
  parseReportDateFilters,
  parseReportPageSize,
  parseOptionalCursor,
  hasCompanyGroupKey,
  parseOptionalCompanyGroupKey,
  parseOptionalReportType,
  parseOptionalReportTab,
  parseInvoiceListFilters,
  parseInvoiceReportQuery,
  parseActivityReportQuery,
  parseOrdersReportQuery,
  parseCompanyInvoiceQuery,
  parseCompanyIdParam,
};
