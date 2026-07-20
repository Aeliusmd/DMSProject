const {
  trimToString,
  getDigits,
  isValidEmail,
  addMaxLengthError,
} = require("./validationHelpers");
const { sanitizeText, sanitizeSearchText } = require("../utils/sanitize");
const {
  addNoHtmlMarkupError,
  addPersonNameFormatError,
} = require("../utils/nameValidation");

const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 8;

function sanitizeField(value, maxLength) {
  return sanitizeText(value, { maxLength, allowEmpty: true });
}

function validatePassword(password, errors) {
  if (!password) {
    errors.push({ field: "password", message: "Password is required" });
    return;
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push({
      field: "password",
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push({
      field: "password",
      message: `Password must be ${MAX_PASSWORD_LENGTH} characters or less`,
    });
  } else if (/\s/.test(password)) {
    errors.push({
      field: "password",
      message: "Password cannot contain spaces",
    });
  }
}

function validateCreateEmployee(body = {}) {
  const errors = [];

  addNoHtmlMarkupError(errors, "name", trimToString(body.name));
  addNoHtmlMarkupError(errors, "email", trimToString(body.email));

  const name = sanitizeField(body.name, 255);
  const email = sanitizeField(body.email, 255).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (!name) {
    errors.push({ field: "name", message: "Employee name is required" });
  } else {
    addMaxLengthError(errors, "name", name, 255);
    addPersonNameFormatError(errors, "name", name);
  }

  if (!email) {
    errors.push({ field: "email", message: "Employee email is required" });
  } else if (!isValidEmail(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  } else {
    addMaxLengthError(errors, "email", email, 255);
  }

  validatePassword(password, errors);

  return {
    valid: errors.length === 0,
    errors,
    data: { name, email, password },
  };
}

function validateEmployeeListQuery(query = {}) {
  const search = sanitizeSearchText(query.search || "", { maxLength: 200 });
  const pageSizeRaw = Number(query.pageSize);
  const pageSize = Number.isFinite(pageSizeRaw)
    ? Math.min(Math.max(pageSizeRaw, 1), 50)
    : 10;

  return {
    valid: true,
    errors: [],
    data: {
      search,
      cursor: trimToString(query.cursor) || null,
      pageSize,
    },
  };
}

function validateWalletTopup(body = {}) {
  const errors = [];
  const amount = Number(body.amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push({ field: "amount", message: "Enter a valid top-up amount" });
  } else if (amount > 100000) {
    errors.push({
      field: "amount",
      message: "Top-up amount cannot exceed $100,000",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    data: { amount },
  };
}

function validateWalletAllocate(body = {}) {
  const errors = [];
  const employeeId = Number(body.employeeId);
  const amount = Number(body.amount);

  if (!Number.isFinite(employeeId) || employeeId <= 0) {
    errors.push({ field: "employeeId", message: "Select an employee" });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push({ field: "amount", message: "Enter a valid amount" });
  } else if (amount > 100000) {
    errors.push({
      field: "amount",
      message: "Allocation amount cannot exceed $100,000",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    data: { employeeId, amount },
  };
}

module.exports = {
  validateCreateEmployee,
  validateEmployeeListQuery,
  validateWalletTopup,
  validateWalletAllocate,
};
