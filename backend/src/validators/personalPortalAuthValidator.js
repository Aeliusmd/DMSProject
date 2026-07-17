const {
  trimToString,
  isValidEmail,
  addMaxLengthError,
} = require("./validationHelpers");
const { sanitizeText } = require("../utils/sanitize");
const {
  addPersonNameFormatError,
} = require("../utils/nameValidation");

const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 8;

function sanitizeField(value, maxLength) {
  return sanitizeText(value, { maxLength, allowEmpty: true });
}

function validatePasswordPair(password, confirmPassword, errors) {
  if (!password) {
    errors.push({ field: "password", message: "Password is required" });
  } else if (password.length < MIN_PASSWORD_LENGTH) {
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

  if (!confirmPassword) {
    errors.push({
      field: "confirmPassword",
      message: "Please re-enter your password",
    });
  } else if (password && confirmPassword !== password) {
    errors.push({
      field: "confirmPassword",
      message: "Passwords do not match",
    });
  }
}

function validatePersonalRegister(body = {}) {
  const errors = [];
  const firstName = sanitizeField(body.firstName, 100);
  const lastName = sanitizeField(body.lastName, 100);
  const email = sanitizeField(body.email, 255).toLowerCase();
  const phone = sanitizeField(body.phone, 30);
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!firstName) {
    errors.push({ field: "firstName", message: "First name is required" });
  } else {
    addMaxLengthError(errors, "firstName", firstName, 100);
    addPersonNameFormatError(errors, "firstName", firstName);
  }

  if (!lastName) {
    errors.push({ field: "lastName", message: "Last name is required" });
  } else {
    addMaxLengthError(errors, "lastName", lastName, 100);
    addPersonNameFormatError(errors, "lastName", lastName);
  }

  if (!email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!isValidEmail(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  } else {
    addMaxLengthError(errors, "email", email, 255);
  }

  validatePasswordPair(password, confirmPassword, errors);

  return {
    valid: errors.length === 0,
    errors,
    data: {
      firstName,
      lastName,
      email,
      phone: phone || null,
      password,
    },
  };
}

function validatePersonalLogin(body = {}) {
  const errors = [];
  const email = sanitizeField(body.email, 255).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !isValidEmail(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  }

  if (!password) {
    errors.push({ field: "password", message: "Password is required" });
  }

  return {
    valid: errors.length === 0,
    errors,
    data: { email, password },
  };
}

function validatePersonalTwoFactor(body = {}) {
  const errors = [];
  const sessionToken = sanitizeField(body.sessionToken, 255);
  const code = trimToString(body.code).replace(/\D/g, "");

  if (!sessionToken) {
    errors.push({ field: "sessionToken", message: "Session expired. Sign in again." });
  }

  if (!/^\d{6}$/.test(code)) {
    errors.push({ field: "code", message: "Enter the 6-digit verification code" });
  }

  return { valid: errors.length === 0, errors, sessionToken, code };
}

function validatePersonalResendTwoFactor(body = {}) {
  const errors = [];
  const sessionToken = sanitizeField(body.sessionToken, 255);
  if (!sessionToken) {
    errors.push({ field: "sessionToken", message: "Session expired. Sign in again." });
  }
  return { valid: errors.length === 0, errors, sessionToken };
}

function validatePersonalRefresh(body = {}) {
  const errors = [];
  const refreshToken = sanitizeField(body.refreshToken, 1024);
  if (!refreshToken) {
    errors.push({ field: "refreshToken", message: "Refresh token is required" });
  }
  return { valid: errors.length === 0, errors, refreshToken };
}

function validatePersonalLogout(body = {}) {
  return {
    valid: true,
    errors: [],
    refreshToken: sanitizeField(body.refreshToken, 1024) || null,
    sessionToken: sanitizeField(body.sessionToken, 255) || null,
  };
}

module.exports = {
  validatePersonalRegister,
  validatePersonalLogin,
  validatePersonalTwoFactor,
  validatePersonalResendTwoFactor,
  validatePersonalRefresh,
  validatePersonalLogout,
};
