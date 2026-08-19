const { trimToString, addMaxLengthError } = require("./validationHelpers");
const { validatePasswordComplexity } = require("../utils/passwordValidation");

function validateLogin(body = {}) {
  const errors = [];

  const identifier = trimToString(body.identifier || body.email || body.logon);

  if (!identifier) {
    errors.push({
      field: "identifier",
      message: "Email or logon is required",
    });
  } else {
    addMaxLengthError(errors, "identifier", identifier, 255);
  }

  if (!body.password) {
    errors.push({ field: "password", message: "Password is required" });
  } else if (typeof body.password === "string" && body.password.length > 128) {
    errors.push({
      field: "password",
      message: "Password must be 128 characters or less",
    });
  }

  return { valid: errors.length === 0, errors, identifier };
}

function validateTwoFactor(body = {}) {
  const errors = [];

  if (!body.sessionToken?.trim()) {
    errors.push({
      field: "sessionToken",
      message: "Session token is required",
    });
  }

  if (!body.code || String(body.code).replace(/\D/g, "").length !== 6) {
    errors.push({ field: "code", message: "A 6-digit code is required" });
  }

  return { valid: errors.length === 0, errors };
}

function validateResendTwoFactor(body = {}) {
  const errors = [];

  if (!body.sessionToken?.trim()) {
    errors.push({
      field: "sessionToken",
      message: "Session token is required",
    });
  }

  return { valid: errors.length === 0, errors };
}

function validateRefresh(body = {}) {
  const errors = [];
  const refreshToken = trimToString(body.refreshToken);

  if (!refreshToken) {
    errors.push({
      field: "refreshToken",
      message: "Refresh token is required",
    });
  }

  return { valid: errors.length === 0, errors, refreshToken };
}

function validateLogout(body = {}) {
  const errors = [];
  const refreshToken = trimToString(body.refreshToken);
  const sessionToken = trimToString(body.sessionToken);

  if (!refreshToken && !sessionToken) {
    errors.push({
      field: "refreshToken",
      message: "Refresh token or session token is required",
    });
  }

  return { valid: errors.length === 0, errors, refreshToken, sessionToken };
}

function validateImpersonate(body = {}) {
  const errors = [];
  const employeeId = Number(body.employeeId);

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    errors.push({
      field: "employeeId",
      message: "A valid employee is required",
    });
  }

  return { valid: errors.length === 0, errors, employeeId };
}

function validateImpersonateExchange(body = {}) {
  const errors = [];
  const exchangeToken = trimToString(body.exchangeToken);

  if (!exchangeToken || !/^[a-f0-9]{64}$/i.test(exchangeToken)) {
    errors.push({
      field: "exchangeToken",
      message: "A valid exchange token is required",
    });
  }

  return { valid: errors.length === 0, errors, exchangeToken };
}

function validateForgotPassword(body = {}) {
  const errors = [];
  const email = trimToString(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!email) {
    errors.push({ field: "email", message: "Email is required" });
  } else {
    addMaxLengthError(errors, "email", email, 255);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      errors.push({ field: "email", message: "Enter a valid email address" });
    }
  }

  errors.push(...validatePasswordComplexity(password, "password"));

  if (!confirmPassword.trim()) {
    errors.push({
      field: "confirmPassword",
      message: "Confirm password is required",
    });
  } else if (password !== confirmPassword) {
    errors.push({
      field: "confirmPassword",
      message: "Passwords do not match",
    });
  }

  return { valid: errors.length === 0, errors, email, password };
}

module.exports = {
  validateLogin,
  validateTwoFactor,
  validateResendTwoFactor,
  validateRefresh,
  validateLogout,
  validateImpersonate,
  validateImpersonateExchange,
  validateForgotPassword,
};
