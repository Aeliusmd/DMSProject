const {
  trimToString,
  getDigits,
  isValidEmail,
  addMaxLengthError,
} = require("./validationHelpers");
const { sanitizeText } = require("../utils/sanitize");

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

function validateCompanyRegister(body = {}) {
  const errors = [];

  const companyName = sanitizeField(body.companyName, 255);
  const phoneRaw = sanitizeField(body.phone || body.companyPhone, 30);
  const email = sanitizeField(body.email || body.companyEmail, 255).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const confirmPassword =
    typeof body.confirmPassword === "string"
      ? body.confirmPassword
      : typeof body.reEnterPassword === "string"
        ? body.reEnterPassword
        : "";
  const addressLine1 = sanitizeField(
    body.addressLine1 || body.address || body.companyAddress,
    255
  );
  const addressLine2 = sanitizeField(body.addressLine2, 255);
  const city = sanitizeField(body.city, 100);
  const state = sanitizeField(body.state, 2).toUpperCase();
  const zip = sanitizeField(body.zip || body.zipCode, 20);

  if (!companyName) {
    errors.push({ field: "companyName", message: "Company name is required" });
  } else {
    addMaxLengthError(errors, "companyName", companyName, 255);
  }

  const phoneDigits = getDigits(phoneRaw);
  if (!phoneRaw) {
    errors.push({ field: "phone", message: "Company phone number is required" });
  } else if (phoneDigits.length !== 10) {
    errors.push({
      field: "phone",
      message: "Enter a valid 10 digit phone number",
    });
  }

  if (!email) {
    errors.push({ field: "email", message: "Company email is required" });
  } else if (!isValidEmail(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  } else {
    addMaxLengthError(errors, "email", email, 255);
  }

  validatePasswordPair(password, confirmPassword, errors);

  if (!addressLine1) {
    errors.push({
      field: "addressLine1",
      message: "Company address is required",
    });
  } else {
    addMaxLengthError(errors, "addressLine1", addressLine1, 255);
  }

  if (addressLine2) {
    addMaxLengthError(errors, "addressLine2", addressLine2, 255);
  }

  if (!city) {
    errors.push({ field: "city", message: "City is required" });
  } else {
    addMaxLengthError(errors, "city", city, 100);
  }

  if (!state) {
    errors.push({ field: "state", message: "State is required" });
  } else if (!/^[A-Z]{2}$/.test(state)) {
    errors.push({ field: "state", message: "State must be 2 letters" });
  }

  const zipDigits = getDigits(zip);
  if (!zip) {
    errors.push({ field: "zip", message: "ZIP code is required" });
  } else if (zipDigits.length !== 5) {
    errors.push({ field: "zip", message: "ZIP must be 5 digits" });
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      companyName,
      phone: phoneDigits,
      email,
      password,
      addressLine1,
      addressLine2: addressLine2 || null,
      city,
      state,
      zip: zipDigits,
    },
  };
}

function validateCompanyLogin(body = {}) {
  const errors = [];

  const email = sanitizeField(body.email || body.identifier, 255).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (!email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (!isValidEmail(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  } else {
    addMaxLengthError(errors, "email", email, 255);
  }

  if (!password) {
    errors.push({ field: "password", message: "Password is required" });
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push({
      field: "password",
      message: `Password must be ${MAX_PASSWORD_LENGTH} characters or less`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    data: { email, password },
  };
}

function validateCompanyTwoFactor(body = {}) {
  const errors = [];

  const sessionToken = trimToString(body.sessionToken);

  if (!sessionToken) {
    errors.push({
      field: "sessionToken",
      message: "Session token is required",
    });
  } else {
    addMaxLengthError(errors, "sessionToken", sessionToken, 128);
  }

  if (!body.code || String(body.code).replace(/\D/g, "").length !== 6) {
    errors.push({ field: "code", message: "A 6-digit code is required" });
  }

  return { valid: errors.length === 0, errors };
}

function validateCompanyResendTwoFactor(body = {}) {
  const errors = [];
  const sessionToken = trimToString(body.sessionToken);

  if (!sessionToken) {
    errors.push({
      field: "sessionToken",
      message: "Session token is required",
    });
  }

  return { valid: errors.length === 0, errors };
}

function validateCompanyRefresh(body = {}) {
  const errors = [];

  if (!trimToString(body.refreshToken)) {
    errors.push({
      field: "refreshToken",
      message: "Refresh token is required",
    });
  }

  return { valid: errors.length === 0, errors };
}

function validateCompanyLogout(body = {}) {
  const errors = [];

  if (!trimToString(body.refreshToken) && !trimToString(body.sessionToken)) {
    errors.push({
      field: "refreshToken",
      message: "Refresh token or session token is required",
    });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateCompanyRegister,
  validateCompanyLogin,
  validateCompanyTwoFactor,
  validateCompanyResendTwoFactor,
  validateCompanyRefresh,
  validateCompanyLogout,
};
