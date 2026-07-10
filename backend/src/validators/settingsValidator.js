const {
  FIELD_LIMITS,
  trimToString,
  isBlank,
  isValidEmail,
  addMaxLengthError,
} = require("./validationHelpers");

function validateUpdateProfile(body = {}) {
  const errors = [];
  const firstName = trimToString(body.firstName);
  const lastName = trimToString(body.lastName);
  const email = trimToString(body.email);

  if (!firstName) {
    errors.push({ field: "firstName", message: "First name is required" });
  } else {
    addMaxLengthError(errors, "firstName", firstName, FIELD_LIMITS.VARCHAR_100);
  }

  addMaxLengthError(errors, "lastName", lastName, FIELD_LIMITS.VARCHAR_100);

  if (!email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!isValidEmail(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  } else {
    addMaxLengthError(errors, "email", email, FIELD_LIMITS.VARCHAR_255);
  }

  return { valid: errors.length === 0, errors };
}

function isBooleanLike(value) {
  return (
    value === undefined ||
    value === null ||
    typeof value === "boolean" ||
    value === 0 ||
    value === 1 ||
    value === "0" ||
    value === "1" ||
    value === "true" ||
    value === "false"
  );
}

function validateUpdateNotifications(body = {}) {
  const errors = [];
  const notifications = body.notifications ?? body;

  const booleanFields = [
    { field: "newOrderAlerts", alt: "notifyNewOrders" },
    { field: "invoiceReminders", alt: "notifyInvoiceReminders" },
    { field: "employeeActivity", alt: "notifyEmployeeActivity" },
    { field: "caseStatusUpdates", alt: "notifyCaseStatus" },
  ];

  booleanFields.forEach(({ field, alt }) => {
    const value = notifications[field] ?? notifications[alt];

    if (!isBooleanLike(value)) {
      errors.push({
        field,
        message: `${field} must be true or false`,
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

function validateChangePassword(body = {}) {
  const errors = [];
  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword =
    typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword) {
    errors.push({
      field: "currentPassword",
      message: "Current password is required",
    });
  }

  if (!newPassword) {
    errors.push({
      field: "newPassword",
      message: "Password must be at least 8 characters",
    });
  } else if (newPassword.length < 8) {
    errors.push({
      field: "newPassword",
      message: "Password must be at least 8 characters",
    });
  } else if (newPassword.length > 128) {
    errors.push({
      field: "newPassword",
      message: "Password must be 128 characters or less",
    });
  }

  if (
    currentPassword &&
    newPassword &&
    currentPassword === newPassword
  ) {
    errors.push({
      field: "newPassword",
      message: "New password must be different from current password",
    });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateUpdateProfile,
  validateUpdateNotifications,
  validateChangePassword,
};
