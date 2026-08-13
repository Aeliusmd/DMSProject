const { trimToString, addMaxLengthError } = require("./validationHelpers");

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

module.exports = {
  validateLogin,
  validateTwoFactor,
  validateResendTwoFactor,
  validateRefresh,
  validateLogout,
};
