const bcrypt = require("bcryptjs");
const ApiError = require("../utils/ApiError");
const Employee = require("../models/Employee");
const EmployeeMilestoneEvent = require("../models/EmployeeMilestoneEvent");
const EmployeeSettings = require("../models/EmployeeSettings");
const AuthSession = require("../models/AuthSession");
const { isAdminOrManager } = require("../utils/roles");
const { formatEmployee } = require("../views/responses");
const { sanitizeSearchText } = require("../utils/sanitize");

const ALLOWED_CREATE_ROLES = ["Manager", "Employee"];

function isAdminRole(role) {
  return String(role || "").trim().toLowerCase() === "admin";
}

function parseReactivationDateTime(value) {
  if (!value) return null;

  const normalized = String(value).trim().replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function toMySqlDateTime(date) {
  const pad = (part) => String(part).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatLastLogin(value) {
  if (!value) {
    return "Never";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Never";
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

function formatScheduledDateTime(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
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

function mapEmployeeRow(row) {
  return formatEmployee({
    id: row.id,
    name: row.name,
    logon: row.logon,
    email: row.email,
    role: row.role,
    lastLogin: formatLastLogin(row.last_login_at),
    terminated: Boolean(row.is_terminated),
    suspended: Boolean(row.is_suspended),
    reactivatedDate: formatScheduledDateTime(row.reactivated_date),
  });
}

async function getAllEmployees(query = {}) {
  const filters = {};

  if (query.search && `${query.search}`.trim()) {
    filters.search = sanitizeSearchText(query.search);
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
    const employees = await Employee.findAll(filters);
    return employees.map(mapEmployeeRow);
  }

  const keysetResult = await Employee.findAllKeyset({
    ...filters,
    pageSize,
    cursorId,
  });

  return {
    employees: keysetResult.rows.map(mapEmployeeRow),
    pagination: {
      type: "keyset",
      pageSize: keysetResult.pageSize,
      hasMore: keysetResult.hasMore,
      nextCursor: keysetResult.nextCursor,
    },
  };
}

async function createEmployee({ name, logon, email, password, role }) {
  if (!ALLOWED_CREATE_ROLES.includes(role)) {
    throw new ApiError(400, "Role must be Manager or Employee");
  }

  const existingEmail = await Employee.findByEmail(email);
  if (existingEmail) {
    throw new ApiError(409, "An employee with this email already exists");
  }

  const existingLogon = await Employee.findByLogon(logon);
  if (existingLogon) {
    throw new ApiError(409, "An employee with this username already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const employee = await Employee.create({
    name,
    logon,
    email,
    passwordHash,
    role,
  });

  await EmployeeSettings.ensureForEmployee(employee.id);

  return mapEmployeeRow(employee);
}

async function updateEmployee(id, { name, logon, email, role, password }) {
  if (!ALLOWED_CREATE_ROLES.includes(role)) {
    throw new ApiError(400, "Role must be Manager or Employee");
  }

  const employee = await Employee.findById(id);

  if (!employee) {
    throw new ApiError(404, "Employee not found");
  }

  if (isAdminRole(employee.role)) {
    throw new ApiError(400, "Admin accounts cannot be edited");
  }

  const existingEmail = await Employee.findByEmail(email, employee.id);
  if (existingEmail) {
    throw new ApiError(409, "An employee with this email already exists");
  }

  const existingLogon = await Employee.findByLogon(logon, employee.id);
  if (existingLogon) {
    throw new ApiError(409, "An employee with this username already exists");
  }

  await Employee.update(employee.id, { name, logon, email, role });

  if (password) {
    const passwordHash = await bcrypt.hash(password, 10);
    await Employee.updatePassword(employee.id, passwordHash);
  }

  return mapEmployeeRow(await Employee.findById(employee.id, { includeDeleted: true }));
}

async function terminateEmployee(id, actorId) {
  if (Number(id) === Number(actorId)) {
    throw new ApiError(400, "You cannot terminate your own account");
  }

  const employee = await Employee.findById(id);

  if (!employee) {
    throw new ApiError(404, "Employee not found");
  }

  if (employee.is_terminated) {
    throw new ApiError(400, "Employee is already terminated");
  }

  if (isAdminRole(employee.role)) {
    throw new ApiError(400, "Admin accounts cannot be terminated");
  }

  await Employee.terminate(id);
  await AuthSession.deleteAllByEmployeeId(id);

  return mapEmployeeRow(await Employee.findById(id, { includeDeleted: true }));
}

async function activateEmployee(id) {
  const employee = await Employee.findById(id);

  if (!employee) {
    throw new ApiError(404, "Employee not found");
  }

  if (!employee.is_terminated && !employee.is_suspended) {
    throw new ApiError(400, "Employee is already active");
  }

  await Employee.activate(id);

  return mapEmployeeRow(await Employee.findById(id, { includeDeleted: true }));
}

async function suspendEmployee(id, actorId, reactivatedDate) {
  if (Number(id) === Number(actorId)) {
    throw new ApiError(400, "You cannot suspend your own account");
  }

  const employee = await Employee.findById(id);

  if (!employee) {
    throw new ApiError(404, "Employee not found");
  }

  if (employee.is_terminated) {
    throw new ApiError(400, "Terminated employees cannot be suspended");
  }

  if (employee.is_suspended) {
    throw new ApiError(400, "Employee is already suspended");
  }

  if (isAdminRole(employee.role)) {
    throw new ApiError(400, "Admin accounts cannot be suspended");
  }

  const scheduledAt = parseReactivationDateTime(reactivatedDate);

  if (!scheduledAt) {
    throw new ApiError(400, "Invalid reactivation date and time");
  }

  if (scheduledAt.getTime() <= Date.now()) {
    throw new ApiError(400, "Reactivation date and time must be in the future");
  }

  await Employee.suspend(id, {
    suspendedBy: actorId,
    reactivatedDate: toMySqlDateTime(scheduledAt),
  });
  await AuthSession.deleteAllByEmployeeId(id);

  return mapEmployeeRow(await Employee.findById(id, { includeDeleted: true }));
}

async function processScheduledReactivations() {
  const dueEmployees = await Employee.findSuspendedDueForReactivation();

  for (const employee of dueEmployees) {
    await Employee.unsuspend(employee.id);
  }

  return dueEmployees.length;
}

async function deleteEmployee(id, actorId) {
  if (Number(id) === Number(actorId)) {
    throw new ApiError(400, "You cannot delete your own account");
  }

  const employee = await Employee.findById(id);

  if (!employee) {
    throw new ApiError(404, "Employee not found");
  }

  await Employee.softDelete(id, actorId);
  await AuthSession.deleteAllByEmployeeId(id);

  return { message: "Employee deleted successfully" };
}

async function getEmployeeMilestoneStats(
  employeeId,
  { from, to } = {},
  requester = {}
) {
  const targetId = Number(employeeId);
  const requesterId = Number(requester.id);

  if (!Number.isFinite(targetId)) {
    throw new ApiError(400, "Invalid employee id");
  }

  const privileged = isAdminOrManager(requester.role);

  if (!privileged && targetId !== requesterId) {
    throw new ApiError(403, "You can only view your own milestone statistics");
  }

  const employee = await Employee.findById(targetId);

  if (!employee) {
    throw new ApiError(404, "Employee not found");
  }

  const filters = {};

  if (privileged) {
    if (from && `${from}`.trim()) {
      filters.from = `${from}`.trim();
    }

    if (to && `${to}`.trim()) {
      filters.to = `${to}`.trim();
    }
  }

  const row = await EmployeeMilestoneEvent.countStatsByEmployee(targetId, filters);

  return {
    employeeId: targetId,
    employeeName: employee.name || "",
    created: Number(row.created_orders) || 0,
    updated: Number(row.updated_orders) || 0,
    completed: Number(row.completed_orders) || 0,
    cancelled: Number(row.cancelled_orders) || 0,
    deleted: Number(row.deleted_orders) || 0,
    total: Number(row.total_orders) || 0,
    dateFrom: filters.from || null,
    dateTo: filters.to || null,
    canFilterByDate: privileged,
    attribution: "milestone_events",
  };
}

module.exports = {
  getAllEmployees,
  createEmployee,
  updateEmployee,
  terminateEmployee,
  activateEmployee,
  suspendEmployee,
  deleteEmployee,
  processScheduledReactivations,
  getEmployeeMilestoneStats,
};
