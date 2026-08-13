const CompanyPortalActivityLog = require("../models/CompanyPortalActivityLog");
const CompanyPortalUser = require("../models/CompanyPortalUser");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const { runNonCritical } = require("../utils/serviceErrorUtils");
const {
  assertEnum,
  parseOptionalIsoDate,
} = require("../utils/sqlSafety");
const {
  sanitizeSearchText,
  sanitizeText,
} = require("../utils/sanitize");
const { FIELD_LIMITS } = require("../utils/fieldLimits");
const { assertReportDateRange } = require("../lib/reportQueryParser");
const { getTodayInputDate } = require("../utils/dateUtils");

const MODULES = {
  SECURITY: "Security",
  EMPLOYEES: "Employees",
  ORDERS: "Orders",
  WALLET: "Wallet",
  BILLING: "Billing",
};

const ALLOWED_LOG_MODULES = new Set(Object.values(MODULES));

const CONTEXT_MODULE_MAP = {
  auth: MODULES.SECURITY,
  security: MODULES.SECURITY,
  employees: MODULES.EMPLOYEES,
  orders: MODULES.ORDERS,
  wallet: MODULES.WALLET,
  money: MODULES.WALLET,
  billing: MODULES.BILLING,
  invoices: MODULES.BILLING,
};

function getInitials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function resolveModule(context, explicitModule) {
  if (explicitModule) {
    return explicitModule;
  }

  if (!context) {
    return MODULES.ORDERS;
  }

  return CONTEXT_MODULE_MAP[String(context).toLowerCase()] || MODULES.ORDERS;
}

function formatActionLabel(action, context) {
  if (action && /[A-Z]/.test(action) && action.includes(" ")) {
    return action;
  }

  const labels = {
    login: "Login",
    logout: "Logout",
    create:
      context === "employees"
        ? "Employee Added"
        : context === "orders"
          ? "Order Created"
          : "Record Created",
    update: "Record Updated",
    upload: "Subpoena Uploaded",
    place_order: "Order Placed",
    pay_invoice: "Invoice Paid",
    confirm_invoice_payment: "Invoice Payment Confirmed",
    wallet_topup: "Wallet Top-up",
    wallet_allocate: "Funds Allocated",
    download_documents: "Documents Downloaded",
  };

  return labels[String(action || "").toLowerCase()] || String(action || "Action");
}

function stripInternalTags(details) {
  return String(details || "")
    .replace(/\s*\|\s*order_id:\d+/gi, "")
    .replace(/\s*\|\s*target_employee_id:\d+/gi, "")
    .replace(/\s*\|\s*portal_order_id:\d+/gi, "")
    .trim();
}

function formatDisplayDate(logDate, logTime) {
  if (!logDate) return "";

  const datePart =
    logDate instanceof Date
      ? logDate.toISOString().slice(0, 10)
      : String(logDate).slice(0, 10);
  const timePart =
    logTime instanceof Date
      ? logTime.toTimeString().slice(0, 8)
      : String(logTime || "").slice(0, 8);

  const [year, month, day] = datePart.split("-");
  if (!year || !month || !day) return datePart;

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthLabel = months[Number(month) - 1] || month;
  return timePart
    ? `${monthLabel} ${Number(day)}, ${year} ${timePart}`
    : `${monthLabel} ${Number(day)}, ${year}`;
}

function mapLogRow(row) {
  const details = stripInternalTags(row.details);
  const logDate =
    row.log_date instanceof Date
      ? row.log_date.toISOString().slice(0, 10)
      : String(row.log_date || "").slice(0, 10);
  const logTime =
    row.log_time instanceof Date
      ? row.log_time.toTimeString().slice(0, 8)
      : String(row.log_time || "").slice(0, 8);

  return {
    id: row.id,
    date: logDate,
    time: logTime,
    displayDate: formatDisplayDate(row.log_date, row.log_time),
    by: row.performer_name,
    performedBy: row.performer_name,
    initials: row.performer_initials || getInitials(row.performer_name),
    callback: row.action,
    action: row.action,
    note: details,
    details,
    module: row.module,
    company: row.company_name || "Company",
    companyName: row.company_name || "Company",
    performedByType: row.performed_by_type,
    performedByAdminId: row.performed_by_admin_id,
    performedByEmployeeId: row.performed_by_employee_id,
    portalOrderId: row.portal_order_id,
    createdAt: row.created_at,
  };
}

async function resolveCompanyName(companyUserId, fallbackName = null) {
  if (fallbackName) {
    return fallbackName;
  }

  const user = await CompanyPortalUser.findById(companyUserId);
  return user?.company_name || "Company";
}

async function recordActivity({
  companyUserId,
  performedByType,
  performedByAdminId = null,
  performedByEmployeeId = null,
  performerName = null,
  action,
  context = null,
  module = null,
  details,
  companyName = null,
  portalOrderId = null,
}) {
  if (!companyUserId || !details) {
    return null;
  }

  const type =
    performedByType === "employee" || performedByEmployeeId
      ? "employee"
      : "admin";

  const resolvedName =
    performerName ||
    (type === "employee" ? "Company Employee" : "Company Admin");
  const resolvedCompanyName = await resolveCompanyName(
    companyUserId,
    companyName
  );

  const now = new Date();
  const logDate = getTodayInputDate(now);
  const logTime = now.toTimeString().slice(0, 8);
  const resolvedModule = resolveModule(context, module);
  const resolvedAction = formatActionLabel(action, context);

  return CompanyPortalActivityLog.create({
    companyUserId,
    logDate,
    logTime,
    action: sanitizeText(resolvedAction, { maxLength: FIELD_LIMITS.ACTION }),
    module: resolvedModule,
    companyName:
      sanitizeText(resolvedCompanyName, {
        maxLength: FIELD_LIMITS.ACTIVITY_COMPANY_NAME,
        allowEmpty: true,
      }) || "Company",
    performedByType: type,
    performedByAdminId:
      type === "admin" ? performedByAdminId || companyUserId : null,
    performedByEmployeeId: type === "employee" ? performedByEmployeeId : null,
    performerName:
      sanitizeText(resolvedName, {
        maxLength: FIELD_LIMITS.PERFORMER_NAME,
        allowEmpty: true,
      }) || "Unknown",
    performerInitials: getInitials(resolvedName),
    details: sanitizeText(details, { maxLength: FIELD_LIMITS.TEXT }),
    portalOrderId: portalOrderId || null,
  });
}

async function recordFromRequest(req, data = {}) {
  return runNonCritical(
    "Failed to record company portal activity log",
    async () => {
      const companyUser = req.companyUser || {};
      const companyUserId = companyUser.id;
      const employeeId = companyUser.employeeId || null;
      const isEmployee = Boolean(employeeId);

      const companyName =
        companyUser.companyName ||
        req.companySession?.company_name ||
        data.companyName ||
        null;

      const performerName = isEmployee
        ? companyUser.employeeName || data.performerName
        : companyUser.companyName ||
          req.companySession?.company_name ||
          data.performerName ||
          "Company Admin";

      return recordActivity({
        companyUserId,
        performedByType: isEmployee ? "employee" : "admin",
        performedByAdminId: isEmployee ? null : companyUserId,
        performedByEmployeeId: employeeId,
        performerName,
        companyName,
        ...data,
        details:
          data.details ||
          data.description ||
          data.note ||
          formatActionLabel(data.action, data.context),
      });
    },
    logger
  );
}

async function recordSafe(payload = {}) {
  return runNonCritical(
    "Failed to record company portal activity log",
    () =>
      recordActivity({
        ...payload,
        details:
          payload.details ||
          payload.description ||
          payload.note ||
          formatActionLabel(payload.action, payload.context),
      }),
    logger
  );
}

async function queryLogs(companyUserId, query = {}) {
  if (!companyUserId) {
    throw new ApiError(401, "Authentication required");
  }

  const filters = { companyUserId };

  const module = `${query.module || ""}`.trim();
  if (module && module !== "All Modules") {
    assertEnum(module, ALLOWED_LOG_MODULES, "module");
    filters.module = module;
  }

  let fromDate = parseOptionalIsoDate(query.fromDate, "fromDate");
  let toDate = parseOptionalIsoDate(query.toDate, "toDate");

  const today = getTodayInputDate();
  if (!fromDate && !toDate) {
    fromDate = today;
    toDate = today;
  } else if (!fromDate) {
    fromDate = toDate;
  } else if (!toDate) {
    toDate = fromDate;
  }

  assertReportDateRange(fromDate, toDate);
  filters.fromDate = fromDate;
  filters.toDate = toDate;

  const employeeId = Number(query.employeeId);
  if (Number.isFinite(employeeId) && employeeId > 0) {
    filters.employeeId = employeeId;
  }

  const actorType = `${query.actorType || query.performedByType || ""}`
    .trim()
    .toLowerCase();
  if (actorType === "admin" || actorType === "employee") {
    filters.performedByType = actorType;
  }

  if (query.search && `${query.search}`.trim()) {
    filters.search = sanitizeSearchText(query.search);
  }

  const useKeysetPagination =
    String(query.pagination || "").toLowerCase() === "keyset";
  const pageSizeRaw = Number(query.pageSize || query.limit || 10);
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(Math.max(pageSizeRaw, 1), 100)
    : 10;
  const cursorRaw = Number(query.cursor);
  const cursorId = Number.isFinite(cursorRaw) && cursorRaw > 0 ? cursorRaw : null;

  if (!useKeysetPagination) {
    const logs = await CompanyPortalActivityLog.findAll({
      ...filters,
      limit: pageSizeRaw > 0 ? Math.min(pageSizeRaw, 500) : 200,
    });
    return logs.map(mapLogRow);
  }

  const keysetResult = await CompanyPortalActivityLog.findAllKeyset({
    ...filters,
    pageSize,
    cursorId,
  });

  return {
    logs: keysetResult.rows.map(mapLogRow),
    pagination: {
      type: "keyset",
      pageSize: keysetResult.pageSize,
      hasMore: keysetResult.hasMore,
      nextCursor: keysetResult.nextCursor,
    },
  };
}

module.exports = {
  MODULES,
  recordActivity,
  recordFromRequest,
  recordSafe,
  queryLogs,
  formatActionLabel,
};
