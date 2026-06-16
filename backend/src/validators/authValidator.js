function validateLogin(body = {}) {
  const errors = [];

  const identifier = body.identifier || body.email || body.logon;

  if (!identifier?.trim()) {
    errors.push({
      field: "identifier",
      message: "Email or logon is required",
    });
  }

  if (!body.password) {
    errors.push({ field: "password", message: "Password is required" });
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

  if (!body.refreshToken?.trim()) {
    errors.push({
      field: "refreshToken",
      message: "Refresh token is required",
    });
  }

  return { valid: errors.length === 0, errors };
}

function validateLogout(body = {}) {
  const errors = [];

  if (!body.refreshToken?.trim() && !body.sessionToken?.trim()) {
    errors.push({
      field: "refreshToken",
      message: "Refresh token or session token is required",
    });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateLogin,
  validateTwoFactor,
  validateResendTwoFactor,
  validateRefresh,
  validateLogout,
};
