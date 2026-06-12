function validateLogin(body = {}) {
  const errors = [];

  if (!body.email?.trim()) {
    errors.push({ field: "email", message: "Email is required" });
  }

  if (!body.password) {
    errors.push({ field: "password", message: "Password is required" });
  }

  return { valid: errors.length === 0, errors };
}

function validateTwoFactor(body = {}) {
  const errors = [];

  if (!body.code || String(body.code).length !== 6) {
    errors.push({ field: "code", message: "A 6-digit code is required" });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateLogin, validateTwoFactor };
