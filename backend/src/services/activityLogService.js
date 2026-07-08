const Employee = require("../models/Employee");
const Facility = require("../models/Facility");
const ActivityLog = require("../models/ActivityLog");
const milestoneRollupService = require("./milestoneRollupService");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

const MODULES = {
  SECURITY: "Security",
  EMPLOYEES: "Employees",
  FACILITIES: "Facilities",
  BILLING: "Billing",
  ORDERS: "Orders",
  PROCESSING: "Processing",
  REPORTS: "Reports",
};

const CONTEXT_MODULE_MAP = {
  auth: MODULES.SECURITY,
  security: MODULES.SECURITY,
  employees: MODULES.EMPLOYEES,
  facilities: MODULES.FACILITIES,
  documents: MODULES.FACILITIES,
  notes: MODULES.FACILITIES,
  settings: MODULES.SECURITY,
  billing: MODULES.BILLING,
  invoices: MODULES.BILLING,
  orders: MODULES.ORDERS,
  reports: MODULES.REPORTS,
  processing: MODULES.PROCESSING,
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
    return MODULES.REPORTS;
  }

  return CONTEXT_MODULE_MAP[String(context).toLowerCase()] || MODULES.REPORTS;
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
        : context === "facilities"
          ? "Facility Created"
          : context === "orders"
            ? "Order Created"
            : "Record Created",
    terminate: "Employee Terminated",
    activate: "Employee Activated",
    delete:
      context === "employees"
        ? "Employee Deleted"
        : context === "documents"
          ? "Document Deleted"
          : context === "facilities"
            ? "Facility Deleted"
            : context === "orders"
              ? "Order Deleted"
              : "Record Deleted",
    update:
      context === "facilities"
        ? "Facility Updated"
        : context === "orders"
          ? "Order Updated"
          : "Record Updated",
    update_profile: "Profile Updated",
    update_notifications: "Notifications Updated",
    change_password: "Password Changed",
    upload: "Document Uploaded",
    upload_document: "Document Uploaded",
    delete_document: "Document Deleted",
    create_doctors: "Doctor Added",
    deactivate_doctor: "Doctor Deactivated",
    reactivate_doctor: "Doctor Reactivated",
    set_default_doctor: "Default Doctor Updated",
    add_office_manager: "Office Manager Added",
    remove_office_manager: "Office Manager Removed",
    create_note:
      context === "orders"
        ? "Order Note Added"
        : context === "facilities" || context === "notes"
          ? "Facility Note Added"
          : "Note Added",
    update_note: "Order Note Callback",
    workflow_update: "Order Workflow Updated",
    cancel: "Order Cancelled",
    order_pickup: "Order Pickup Recorded",
    order_mail: "Records Ready Email Sent",
    copy_service_letter: "Copy Service Letter Sent",
    print_invoice: "Print Invoice",
    print_xray_invoice: "Print X-Ray Invoice",
    create_invoice: "Invoice Created",
    update_invoice: "Invoice Updated",
    send_invoices: "Invoice Sent",
    resend_invoices: "Invoice Resent",
    email_invoice: "Invoice Emailed",
    email_xray_invoice: "X-Ray Invoice Emailed",
    save_xray_invoice: "X-Ray Invoice Saved",
    write_off: "Invoice Written Off",
    record_payment: "Payment Recorded",
    sync_payment: "Invoice Payment Updated",
  };

  return labels[action] || String(action || "Activity");
}

function stripTargetTag(details) {
  return String(details || "")
    .replace(/\s*\|\s*target_employee_id:\d+\s*$/i, "")
    .trim();
}

function appendTargetEmployee(details, targetEmployeeId) {
  const base = stripTargetTag(details);

  if (!targetEmployeeId) {
    return base;
  }

  return `${base} | target_employee_id:${targetEmployeeId}`;
}

function stripOrderIdTag(details) {
  return String(details || "")
    .replace(/\s*\|\s*order_id:\d+\s*$/i, "")
    .trim();
}

function appendOrderId(details, orderId) {
  const base = stripOrderIdTag(details);

  if (!orderId) {
    return base;
  }

  return `${base} | order_id:${orderId}`;
}

function normalizeDateValue(value) {
  if (!value) return "";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const str = String(value).trim();
  const isoMatch = str.match(/^(\d{4}-\d{2}-\d{2})/);

  if (isoMatch) {
    return isoMatch[1];
  }

  const parsed = new Date(str);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTimeValue(value) {
  if (!value) return "";

  const str = String(value).trim();
  const timeMatch = str.match(/(\d{2}:\d{2})/);

  if (timeMatch) {
    return timeMatch[1];
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toTimeString().slice(0, 5);
  }

  return "";
}

function formatDisplayDate(logDate, logTime) {
  const datePart = normalizeDateValue(logDate);
  const timePart = normalizeTimeValue(logTime);

  if (!datePart) return "";

  const date = new Date(`${datePart}T${timePart || "00:00"}:00`);

  if (Number.isNaN(date.getTime())) {
    return `${datePart} ${timePart}`;
  }

  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function mapLogRow(row) {
  const details = stripOrderIdTag(stripTargetTag(row.details));
  const logDate = normalizeDateValue(row.log_date);
  const logTime = normalizeTimeValue(row.log_time);

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
    company: row.company_name || "System",
    companyName: row.company_name || "System",
    facilityId: row.facility_id,
    performedById: row.performed_by,
    createdAt: row.created_at,
  };
}

async function resolveActor(actorId) {
  const employee = await Employee.findByIdPublic(actorId);

  return {
    performerName: employee?.name || "Unknown User",
    performerRole: employee?.role || null,
  };
}

async function resolveCompanyName({ companyName, facilityId }) {
  if (companyName) {
    return companyName;
  }

  if (!facilityId) {
    return "System";
  }

  const facility = await Facility.findById(facilityId);
  return facility?.facility_name || "System";
}

async function recordActivity({
  performedBy,
  performerName = null,
  action,
  context = null,
  module = null,
  details,
  companyName = null,
  facilityId = null,
  targetEmployeeId = null,
}) {
  if (!performedBy || !details) {
    return null;
  }

  let resolvedName = performerName;

  if (!resolvedName) {
    const actor = await resolveActor(performedBy);
    resolvedName = actor.performerName;
  }

  const now = new Date();
  const logDate = now.toISOString().slice(0, 10);
  const logTime = now.toTimeString().slice(0, 8);
  const resolvedModule = resolveModule(context, module);
  const resolvedAction = formatActionLabel(action, context);
  const resolvedCompanyName = await resolveCompanyName({ companyName, facilityId });
  const resolvedDetails = appendTargetEmployee(details, targetEmployeeId);

  const logId = await ActivityLog.create({
    logDate,
    logTime,
    action: resolvedAction,
    module: resolvedModule,
    companyName: resolvedCompanyName,
    facilityId: facilityId || null,
    performedBy,
    performerName: resolvedName,
    performerInitials: getInitials(resolvedName),
    details: resolvedDetails,
  });

  await milestoneRollupService.recordFromActivityLogSafe({
    employeeId: performedBy,
    action: resolvedAction,
    module: resolvedModule,
    details: resolvedDetails,
    eventDate: logDate,
  });

  return logId;
}

async function recordFromRequest(req, data) {
  try {
    return await recordActivity({
      performedBy: req.user?.id,
      ...data,
      details:
        data.details ||
        data.description ||
        data.note ||
        formatActionLabel(data.action, data.context),
    });
  } catch (error) {
    logger.warn("Failed to record activity log", { error: error.message });
    return null;
  }
}

async function recordSafe(payload) {
  try {
    return await recordActivity({
      ...payload,
      performedBy: payload.performedBy || payload.actorId,
      performerName: payload.performerName || payload.actorName,
      details:
        payload.details ||
        payload.description ||
        payload.note ||
        formatActionLabel(payload.action, payload.context),
    });
  } catch (error) {
    logger.warn("Failed to record activity log", { error: error.message });
    return null;
  }
}

async function queryLogs(query = {}) {
  const filters = {};

  if (query.performedBy) {
    const performedBy = Number(query.performedBy);
    if (Number.isFinite(performedBy) && performedBy > 0) {
      filters.performedBy = performedBy;
    }
  }

  const module = `${query.module || ""}`.trim();
  if (module && module !== "All Modules") {
    filters.module = module;
  }

  if (query.fromDate && `${query.fromDate}`.trim()) {
    filters.fromDate = `${query.fromDate}`.trim();
  }

  if (query.toDate && `${query.toDate}`.trim()) {
    filters.toDate = `${query.toDate}`.trim();
  }

  if (query.search && `${query.search}`.trim()) {
    filters.search = `${query.search}`.trim();
  }

  if (query.limit) {
    const limit = Number(query.limit);
    if (Number.isFinite(limit) && limit > 0) {
      filters.limit = limit;
    }
  }

  const useKeysetPagination =
    String(query.pagination || "").toLowerCase() === "keyset";
  const pageSizeRaw = Number(query.pageSize || filters.limit || 10);
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(Math.max(pageSizeRaw, 1), 100)
    : 10;
  const cursorRaw = Number(query.cursor);
  const cursorId = Number.isFinite(cursorRaw) && cursorRaw > 0 ? cursorRaw : null;

  if (!useKeysetPagination) {
    const logs = await ActivityLog.findAll(filters);
    return logs.map(mapLogRow);
  }

  const keysetResult = await ActivityLog.findAllKeyset({
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

async function getMyLogs(employeeId, query = {}) {
  return queryLogs({
    ...query,
    performedBy: employeeId,
  });
}

async function getEmployeeLogs(employeeId, query = {}) {
  const employee = await Employee.findByIdPublic(employeeId);

  if (!employee) {
    throw new ApiError(404, "Employee not found");
  }

  const useKeysetPagination =
    String(query.pagination || "").toLowerCase() === "keyset";
  const pageSizeRaw = Number(query.pageSize || query.limit || 10);
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(Math.max(pageSizeRaw, 1), 100)
    : 10;
  const cursorRaw = Number(query.cursor);
  const cursorId = Number.isFinite(cursorRaw) && cursorRaw > 0 ? cursorRaw : null;
  const search = `${query.search || ""}`.trim() || null;

  if (!useKeysetPagination) {
    const logs = await ActivityLog.findByEmployeeId(employeeId, {
      limit: pageSizeRaw > 0 ? Math.min(pageSizeRaw, 500) : 200,
    });
    return logs.map(mapLogRow);
  }

  const keysetResult = await ActivityLog.findByEmployeeIdKeyset(employeeId, {
    pageSize,
    cursorId,
    search,
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

async function getAllLogs(query = {}) {
  return queryLogs(query);
}

async function getLogById(id) {
  const log = await ActivityLog.findById(id);

  if (!log) {
    throw new ApiError(404, "Activity log not found");
  }

  return mapLogRow(log);
}

module.exports = {
  MODULES,
  recordActivity,
  recordFromRequest,
  recordSafe,
  getMyLogs,
  getEmployeeLogs,
  getAllLogs,
  queryLogs,
  getLogById,
  mapLogRow,
  appendOrderId,
  stripOrderIdTag,
};
