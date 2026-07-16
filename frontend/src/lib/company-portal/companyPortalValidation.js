const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function stripControlCharacters(value) {
  return `${value || ""}`.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

export function sanitizeInput(value, maxLength = 255) {
  const cleaned = stripControlCharacters(value).trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

export function getDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function validateCompanyName(value) {
  const cleaned = sanitizeInput(value, 255);
  if (!cleaned) return "Company name is required";
  if (cleaned.length > 255) return "Company name must be 255 characters or less";
  return "";
}

export function validateCompanyPhone(value) {
  const digits = getDigits(value);
  if (!digits) return "Company phone number is required";
  if (digits.length !== 10) return "Enter a valid 10 digit phone number";
  return "";
}

export function validateCompanyEmail(value) {
  const cleaned = sanitizeInput(value, 255).toLowerCase();
  if (!cleaned) return "Company email is required";
  if (!EMAIL_PATTERN.test(cleaned)) return "Enter a valid email address";
  return "";
}

export function validatePassword(value) {
  if (!value) return "Password is required";
  if (value.length < 8) return "Password must be at least 8 characters";
  if (value.length > 128) return "Password must be 128 characters or less";
  if (/\s/.test(value)) return "Password cannot contain spaces";
  return "";
}

export function validateConfirmPassword(password, confirmPassword) {
  if (!confirmPassword) return "Please re-enter your password";
  if (confirmPassword !== password) return "Passwords do not match";
  return "";
}

export function validateAddressLine1(value) {
  const cleaned = sanitizeInput(value, 255);
  if (!cleaned) return "Company address is required";
  return "";
}

export function validateCity(value) {
  const cleaned = sanitizeInput(value, 100);
  if (!cleaned) return "City is required";
  return "";
}

export function validateState(value) {
  const cleaned = sanitizeInput(value, 2).toUpperCase();
  if (!cleaned) return "State is required";
  if (!/^[A-Z]{2}$/.test(cleaned)) return "State must be 2 letters";
  return "";
}

export function validateZip(value) {
  const digits = getDigits(value);
  if (!digits) return "ZIP code is required";
  if (digits.length !== 5) return "ZIP must be 5 digits";
  return "";
}

export function buildCompanyRegisterPayload(form) {
  return {
    companyName: sanitizeInput(form.companyName, 255),
    phone: getDigits(form.phone),
    email: sanitizeInput(form.email, 255).toLowerCase(),
    password: form.password,
    confirmPassword: form.confirmPassword,
    addressLine1: sanitizeInput(form.addressLine1, 255),
    addressLine2: sanitizeInput(form.addressLine2 || "", 255) || null,
    city: sanitizeInput(form.city, 100),
    state: sanitizeInput(form.state, 2).toUpperCase(),
    zip: getDigits(form.zip),
  };
}

export function validateCompanyRegisterForm(form) {
  return {
    companyName: validateCompanyName(form.companyName),
    phone: validateCompanyPhone(form.phone),
    email: validateCompanyEmail(form.email),
    password: validatePassword(form.password),
    confirmPassword: validateConfirmPassword(
      form.password,
      form.confirmPassword
    ),
    addressLine1: validateAddressLine1(form.addressLine1),
    city: validateCity(form.city),
    state: validateState(form.state),
    zip: validateZip(form.zip),
  };
}

export function hasValidationErrors(errors = {}) {
  return Object.values(errors).some(Boolean);
}
