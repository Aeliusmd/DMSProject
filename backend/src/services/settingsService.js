const bcrypt = require("bcryptjs");
const ApiError = require("../utils/ApiError");
const Employee = require("../models/Employee");
const EmployeeSettings = require("../models/EmployeeSettings");
const { formatUser } = require("../views/responses");

const DEFAULT_NOTIFICATIONS = {
  notifyNewOrders: true,
  notifyInvoiceReminders: true,
  notifyEmployeeActivity: true,
  notifyCaseStatus: true,
};

function splitName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function joinName(firstName, lastName) {
  return [firstName, lastName]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
}

function mapNotificationRow(row) {
  if (!row) {
    return {
      newOrderAlerts: DEFAULT_NOTIFICATIONS.notifyNewOrders,
      invoiceReminders: DEFAULT_NOTIFICATIONS.notifyInvoiceReminders,
      employeeActivity: DEFAULT_NOTIFICATIONS.notifyEmployeeActivity,
      caseStatusUpdates: DEFAULT_NOTIFICATIONS.notifyCaseStatus,
    };
  }

  return {
    newOrderAlerts: Boolean(row.notify_new_orders),
    invoiceReminders: Boolean(row.notify_invoice_reminders),
    employeeActivity: Boolean(row.notify_employee_activity),
    caseStatusUpdates: Boolean(row.notify_case_status),
  };
}

function mapNotificationPayload(notifications = {}) {
  return {
    notifyNewOrders: Boolean(notifications.newOrderAlerts),
    notifyInvoiceReminders: Boolean(notifications.invoiceReminders),
    notifyEmployeeActivity: Boolean(notifications.employeeActivity),
    notifyCaseStatus: Boolean(notifications.caseStatusUpdates),
  };
}

function formatSettingsResponse(employee, settingsRow) {
  const { firstName, lastName } = splitName(employee.name);

  return {
    profile: {
      firstName,
      lastName,
      email: employee.email || "",
    },
    notifications: mapNotificationRow(settingsRow),
    user: formatUser({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      logon: employee.logon,
      role: employee.role,
    }),
  };
}

async function getSettings(employeeId) {
  const employee = await Employee.findByIdPublic(employeeId);

  if (!employee) {
    throw new ApiError(404, "User not found");
  }

  const settings = await EmployeeSettings.ensureForEmployee(employeeId);

  return formatSettingsResponse(employee, settings);
}

async function updateProfile(employeeId, { firstName, lastName, email }) {
  const employee = await Employee.findByIdPublic(employeeId);

  if (!employee) {
    throw new ApiError(404, "User not found");
  }

  const trimmedEmail = String(email || "").trim();
  const trimmedFirstName = String(firstName || "").trim();
  const trimmedLastName = String(lastName || "").trim();

  if (!trimmedFirstName) {
    throw new ApiError(400, "Validation failed", [
      { field: "firstName", message: "First name is required" },
    ]);
  }

  if (!trimmedEmail) {
    throw new ApiError(400, "Validation failed", [
      { field: "email", message: "Email is required" },
    ]);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmedEmail)) {
    throw new ApiError(400, "Validation failed", [
      { field: "email", message: "Enter a valid email address" },
    ]);
  }

  const existingEmail = await Employee.findByEmail(trimmedEmail, employeeId);

  if (existingEmail) {
    throw new ApiError(409, "This email is already in use");
  }

  const updatedEmployee = await Employee.updateProfile(employeeId, {
    name: joinName(trimmedFirstName, trimmedLastName),
    email: trimmedEmail,
  });

  const settings = await EmployeeSettings.findByEmployeeId(employeeId);

  return formatSettingsResponse(updatedEmployee, settings);
}

async function updateNotifications(employeeId, notifications) {
  const employee = await Employee.findByIdPublic(employeeId);

  if (!employee) {
    throw new ApiError(404, "User not found");
  }

  const settings = await EmployeeSettings.upsert(
    employeeId,
    mapNotificationPayload(notifications)
  );

  return formatSettingsResponse(employee, settings);
}

async function changePassword(employeeId, { currentPassword, newPassword }) {
  const employee = await Employee.findById(employeeId);

  if (!employee) {
    throw new ApiError(404, "User not found");
  }

  if (!currentPassword) {
    throw new ApiError(400, "Validation failed", [
      { field: "currentPassword", message: "Current password is required" },
    ]);
  }

  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(400, "Validation failed", [
      {
        field: "newPassword",
        message: "Password must be at least 8 characters",
      },
    ]);
  }

  const passwordMatches = await bcrypt.compare(
    currentPassword,
    employee.password_hash
  );

  if (!passwordMatches) {
    throw new ApiError(400, "Current password is incorrect", [
      {
        field: "currentPassword",
        message: "Current password does not match",
      },
    ]);
  }

  if (currentPassword === newPassword) {
    throw new ApiError(400, "Validation failed", [
      {
        field: "newPassword",
        message: "New password must be different from current password",
      },
    ]);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await Employee.updatePassword(employeeId, passwordHash);

  return { message: "Password updated successfully" };
}

module.exports = {
  getSettings,
  updateProfile,
  updateNotifications,
  changePassword,
};
