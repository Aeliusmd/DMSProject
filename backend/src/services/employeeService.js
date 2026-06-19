const bcrypt = require("bcryptjs");
const ApiError = require("../utils/ApiError");
const Employee = require("../models/Employee");
const EmployeeSettings = require("../models/EmployeeSettings");
const AuthSession = require("../models/AuthSession");
const { formatEmployee } = require("../views/responses");

const ALLOWED_CREATE_ROLES = ["Manager", "Employee"];

function isAdminRole(role) {
  return String(role || "").trim().toLowerCase() === "admin";
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

function mapEmployeeRow(row) {
  return formatEmployee({
    id: row.id,
    name: row.name,
    logon: row.logon,
    email: row.email,
    role: row.role,
    lastLogin: formatLastLogin(row.last_login_at),
    terminated: Boolean(row.is_terminated),
  });
}

async function getAllEmployees() {
  const employees = await Employee.findAll();
  return employees.map(mapEmployeeRow);
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

  if (!employee.is_terminated) {
    throw new ApiError(400, "Employee is already active");
  }

  await Employee.activate(id);

  return mapEmployeeRow(await Employee.findById(id, { includeDeleted: true }));
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

module.exports = {
  getAllEmployees,
  createEmployee,
  terminateEmployee,
  activateEmployee,
  deleteEmployee,
};
