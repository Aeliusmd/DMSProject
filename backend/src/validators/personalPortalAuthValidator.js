const {
  trimToString,
  isValidEmail,
} = require("./validationHelpers");
const { sanitizeText } = require("../utils/sanitize");

function sanitizeField(value, maxLength) {
  return sanitizeText(value, { maxLength, allowEmpty: true });
}

function validatePersonalRegister() {
  return {
    valid: false,
    errors: [
      {
        field: "email",
        message:
          "Password registration is no longer available. Sign in with your email to receive a verification code.",
      },
    ],
    data: null,
  };
}

function validatePersonalLogin(body = {}) {
  const errors = [];
  const email = sanitizeField(body.email, 255).toLowerCase();

  if (!email || !isValidEmail(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  }

  return {
    valid: errors.length === 0,
    errors,
    data: { email },
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
