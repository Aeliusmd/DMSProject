const Employee = require("../models/Employee");
const Facility = require("../models/Facility");
const ActivityLog = require("../models/ActivityLog");
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
  documents: MODULES.PROCESSING,
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
            : "Record Deleted",
    update: context === "facilities" ? "Facility Updated" : "Record Updated",
    update_profile: "Profile Updated",
    update_notifications: "Notifications Updated",
    change_password: "Password Changed",
    upload: "Document Uploaded",
    create_doctors: "Doctor Added",
    deactivate_doctor: "Doctor Deactivated",
    reactivate_doctor: "Doctor Reactivated",
    set_default_doctor: "Default Doctor Updated",
    create_note: "Note Added",
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

function formatDisplayDate(logDate, logTime) {
  if (!logDate) return "";

  const datePart = String(logDate).slice(0, 10);
  const timePart = logTime ? String(logTime).slice(0, 5) : "00:00";
  const date = new Date(`${datePart}T${timePart}:00`);

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
  const details = stripTargetTag(row.details);
  const logDate = row.log_date ? String(row.log_date).slice(0, 10) : "";
  const logTime = row.log_time ? String(row.log_time).slice(0, 5) : "";

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

  return ActivityLog.create({
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

async function getEmployeeLogs(employeeId) {
  const employee = await Employee.findByIdPublic(employeeId);

  if (!employee) {
    throw new ApiError(404, "Employee not found");
  }

  const logs = await ActivityLog.findByEmployeeId(employeeId);
  return logs.map(mapLogRow);
}

async function getAllLogs({ limit = 500 } = {}) {
  const logs = await ActivityLog.findAll({ limit });
  return logs.map(mapLogRow);
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
  getEmployeeLogs,
  getAllLogs,
  getLogById,
  mapLogRow,
};
