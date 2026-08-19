const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 8;
const SPECIAL_CHAR_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

function validatePasswordComplexity(password, field = "password") {
  const errors = [];
  const value = typeof password === "string" ? password : "";

  if (!value.trim()) {
    errors.push({ field, message: "Password is required" });
    return errors;
  }

  if (value.length < MIN_PASSWORD_LENGTH) {
    errors.push({
      field,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  } else if (value.length > MAX_PASSWORD_LENGTH) {
    errors.push({
      field,
      message: `Password must be ${MAX_PASSWORD_LENGTH} characters or less`,
    });
  } else {
    if (!/[A-Z]/.test(value)) {
      errors.push({
        field,
        message: "Password must include at least one uppercase letter",
      });
    }

    if (!/[a-z]/.test(value)) {
      errors.push({
        field,
        message: "Password must include at least one lowercase letter",
      });
    }

    if (!/[0-9]/.test(value)) {
      errors.push({
        field,
        message: "Password must include at least one number",
      });
    }

    if (!SPECIAL_CHAR_PATTERN.test(value)) {
      errors.push({
        field,
        message: "Password must include at least one special character",
      });
    }
  }

  return errors;
}

module.exports = {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  validatePasswordComplexity,
};
