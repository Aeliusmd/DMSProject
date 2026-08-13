const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HTML_MARKUP_PATTERN = /[<>]/;
const PERSON_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'.\- ]*$/u;
const ORGANIZATION_NAME_PATTERN =
  /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9&.,'()#\-/ ]*$/u;
const ORDER_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9#\-_/ ]*$/;

const FIELD_LABELS = {
  name: "Name",
  email: "Email",
  facilityName: "Facility name",
  facilityAddress: "Street address",
  facilityCity: "City",
  facilityState: "State",
  facilityZip: "ZIP code",
  treatingDoctor: "Specific doctor",
  applicantName: "Applicant name",
  caseName: "Case name",
  caseNumber: "Order number",
  recNumber: "REC number",
  companyName: "Company name",
  companyAddress: "Company address",
  companyCity: "City",
  companyState: "State",
  companyZip: "ZIP code",
  doctorAddress: "Doctor address",
  requestedRecord: "Requested record",
  dateOfInjuryText: "Date of injury",
  contactEmail: "Contact email",
  search: "Search",
  orderNumber: "Order number",
};

function stripControlCharacters(value) {
  return `${value || ""}`.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

function stripHtmlMarkup(value) {
  return `${value || ""}`.replace(/[<>]/g, "");
}

export function hasHtmlMarkup(value) {
  return HTML_MARKUP_PATTERN.test(String(value ?? ""));
}

export function htmlMarkupError(field = "This field") {
  const label = FIELD_LABELS[field] || field;
  return `${label} cannot contain angle brackets or HTML tags`;
}

export function sanitizeInput(value, maxLength = 255) {
  const cleaned = stripHtmlMarkup(stripControlCharacters(value)).trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) : cleaned;
}

export function sanitizeSearchText(value, maxLength = 200) {
  return sanitizeInput(value, maxLength);
}

export function getDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

export function sanitizeEmail(value, maxLength = 255) {
  return sanitizeInput(value, maxLength).toLowerCase();
}

export function sanitizeState(value) {
  return sanitizeInput(value, 2).toUpperCase();
}

export function sanitizeZip(value) {
  const digits = getDigits(value);
  if (!digits) return "";
  if (digits.length === 9) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  return digits.slice(0, 5);
}

export function sanitizeOrderReference(value, maxLength = 100) {
  const cleaned = sanitizeInput(value, maxLength)
    .toUpperCase()
    .replace(/[^A-Z0-9#\-_/ ]/g, "");
  return cleaned.trim();
}

export function sanitizeMoneyInput(value, { max = 100000 } = {}) {
  const normalized = `${value || ""}`.replace(/[^\d.]/g, "");
  if (!normalized) return "";

  const parts = normalized.split(".");
  const whole = parts[0] || "0";
  const fraction = (parts[1] || "").slice(0, 2);
  const numeric = Number(`${whole}.${fraction || "0"}`);

  if (!Number.isFinite(numeric) || numeric < 0) return "";
  if (numeric > max) return String(max);

  return fraction ? `${whole}.${fraction}` : whole;
}

export function sanitizePersonName(value, maxLength = 255) {
  const cleaned = sanitizeInput(value, maxLength);
  if (!cleaned) return "";
  if (!PERSON_NAME_PATTERN.test(cleaned)) {
    return cleaned.replace(/[^\p{L}\p{M}'.\- ]/gu, "").trim();
  }
  return cleaned;
}

export function sanitizeOrganizationName(value, maxLength = 255) {
  const cleaned = sanitizeInput(value, maxLength);
  if (!cleaned) return "";
  if (!ORGANIZATION_NAME_PATTERN.test(cleaned)) {
    return cleaned.replace(/[^\p{L}\p{M}0-9&.,'()#\-/ ]/gu, "").trim();
  }
  return cleaned;
}

export function validateNoHtmlMarkup(value, field) {
  return hasHtmlMarkup(value) ? htmlMarkupError(field) : "";
}

export function validateCompanyName(value) {
  if (validateNoHtmlMarkup(value, "companyName")) {
    return htmlMarkupError("companyName");
  }
  const cleaned = sanitizeOrganizationName(value, 255);
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
  if (validateNoHtmlMarkup(value, "email")) {
    return htmlMarkupError("email");
  }
  const cleaned = sanitizeEmail(value, 255);
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
  if (validateNoHtmlMarkup(value, "companyAddress")) {
    return htmlMarkupError("companyAddress");
  }
  const cleaned = sanitizeInput(value, 255);
  if (!cleaned) return "Company address is required";
  return "";
}

export function validateCity(value) {
  if (validateNoHtmlMarkup(value, "companyCity")) {
    return htmlMarkupError("companyCity");
  }
  const cleaned = sanitizeInput(value, 100);
  if (!cleaned) return "City is required";
  return "";
}

export function validateState(value) {
  if (validateNoHtmlMarkup(value, "companyState")) {
    return htmlMarkupError("companyState");
  }
  const cleaned = sanitizeState(value);
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

export function validateEmployeeName(value) {
  if (validateNoHtmlMarkup(value, "name")) {
    return htmlMarkupError("name");
  }
  const cleaned = sanitizePersonName(value, 255);
  if (!cleaned) return "Employee name is required";
  if (!PERSON_NAME_PATTERN.test(cleaned)) {
    return "Name can only contain letters, spaces, hyphens, apostrophes, and periods";
  }
  return "";
}

export function validateEmployeeEmail(value) {
  if (validateNoHtmlMarkup(value, "email")) {
    return htmlMarkupError("email");
  }
  const cleaned = sanitizeEmail(value, 255);
  if (!cleaned) return "Email is required";
  if (!EMAIL_PATTERN.test(cleaned)) return "Enter a valid email address";
  return "";
}

export function sanitizeCompanyRegisterField(name, value) {
  switch (name) {
    case "companyName":
      return sanitizeOrganizationName(value, 255);
    case "phone":
      return getDigits(value).slice(0, 10);
    case "email":
      return sanitizeEmail(value, 255);
    case "password":
    case "confirmPassword":
      return typeof value === "string" ? value.slice(0, 128) : "";
    case "addressLine1":
    case "addressLine2":
      return sanitizeInput(value, 255);
    case "city":
      return sanitizeInput(value, 100);
    case "state":
      return sanitizeState(value);
    case "zip":
      return getDigits(value).slice(0, 5);
    default:
      return sanitizeInput(value);
  }
}

export function buildCompanyRegisterPayload(form) {
  return {
    companyName: sanitizeOrganizationName(form.companyName, 255),
    phone: getDigits(form.phone),
    email: sanitizeEmail(form.email, 255),
    password: form.password,
    confirmPassword: form.confirmPassword,
    addressLine1: sanitizeInput(form.addressLine1, 255),
    addressLine2: sanitizeInput(form.addressLine2 || "", 255) || null,
    city: sanitizeInput(form.city, 100),
    state: sanitizeState(form.state),
    zip: getDigits(form.zip),
  };
}

export function buildCreateEmployeePayload(form) {
  return {
    name: sanitizePersonName(form.name, 255),
    email: sanitizeEmail(form.email, 255),
    password: form.password,
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

export function validateCreateEmployeeForm(form) {
  return {
    name: validateEmployeeName(form.name),
    email: validateEmployeeEmail(form.email),
    password: validatePassword(form.password),
  };
}

export function sanitizeFacilityFormValues(form = {}) {
  return {
    facilityName: sanitizeOrganizationName(form.facilityName, 255),
    facilityAddress: sanitizeInput(form.facilityAddress, 500),
    facilityCity: sanitizeInput(form.facilityCity, 100),
    facilityState: sanitizeState(form.facilityState),
    facilityZip: sanitizeZip(form.facilityZip),
    treatingDoctor: sanitizePersonName(form.treatingDoctor, 255),
  };
}

export function validateFacilityForm(form = {}) {
  const errors = {};

  if (validateNoHtmlMarkup(form.facilityAddress, "facilityAddress")) {
    errors.facilityAddress = htmlMarkupError("facilityAddress");
  }
  if (validateNoHtmlMarkup(form.facilityCity, "facilityCity")) {
    errors.facilityCity = htmlMarkupError("facilityCity");
  }
  if (validateNoHtmlMarkup(form.facilityState, "facilityState")) {
    errors.facilityState = htmlMarkupError("facilityState");
  }
  if (validateNoHtmlMarkup(form.facilityZip, "facilityZip")) {
    errors.facilityZip = htmlMarkupError("facilityZip");
  }
  if (form.facilityName && validateNoHtmlMarkup(form.facilityName, "facilityName")) {
    errors.facilityName = htmlMarkupError("facilityName");
  }
  if (form.treatingDoctor && validateNoHtmlMarkup(form.treatingDoctor, "treatingDoctor")) {
    errors.treatingDoctor = htmlMarkupError("treatingDoctor");
  }

  const sanitized = sanitizeFacilityFormValues(form);

  if (!sanitized.facilityAddress) {
    errors.facilityAddress = errors.facilityAddress || "Street address is required";
  }
  if (!sanitized.facilityCity) {
    errors.facilityCity = errors.facilityCity || "City is required";
  }
  if (!sanitized.facilityState) {
    errors.facilityState = errors.facilityState || "State is required";
  } else if (!/^[A-Z]{2}$/.test(sanitized.facilityState)) {
    errors.facilityState = errors.facilityState || "State must be 2 letters";
  }

  const zipDigits = getDigits(sanitized.facilityZip);
  if (!zipDigits) {
    errors.facilityZip = errors.facilityZip || "ZIP code is required";
  } else if (zipDigits.length !== 5 && zipDigits.length !== 9) {
    errors.facilityZip = errors.facilityZip || "ZIP must be 5 digits";
  }

  return { errors, sanitized };
}

const ORDER_TEXT_FIELDS = {
  facilityName: { max: 255, type: "organization" },
  facilityAddress: { max: 500, type: "text" },
  facilityCity: { max: 100, type: "text" },
  facilityState: { max: 2, type: "state" },
  facilityZip: { max: 20, type: "zip" },
  treatingDoctor: { max: 255, type: "person" },
  applicantName: { max: 255, type: "person" },
  caseName: { max: 255, type: "text" },
  caseNumber: { max: 100, type: "orderRef" },
  recNumber: { max: 100, type: "text" },
  ssn: { max: 50, type: "text" },
  dateOfInjuryText: { max: 100, type: "text" },
  companyName: { max: 255, type: "organization" },
  companyAddress: { max: 500, type: "text" },
  companyCity: { max: 100, type: "text" },
  companyState: { max: 2, type: "state" },
  companyZip: { max: 20, type: "zip" },
  doctorAddress: { max: 500, type: "text" },
  requestedRecord: { max: 4000, type: "text" },
  contactEmail: { max: 255, type: "email" },
  contactPhone: { max: 30, type: "phone" },
};

export function sanitizeCompanyOrderField(name, value) {
  const config = ORDER_TEXT_FIELDS[name];
  if (!config) {
    return value;
  }

  switch (config.type) {
    case "organization":
      return sanitizeOrganizationName(value, config.max);
    case "person":
      return sanitizePersonName(value, config.max);
    case "state":
      return sanitizeState(value);
    case "zip":
      return sanitizeZip(value);
    case "orderRef":
      return sanitizeOrderReference(value, config.max);
    case "email":
      return sanitizeEmail(value, config.max);
    case "phone":
      return getDigits(value).slice(0, 10);
    default:
      return sanitizeInput(value, config.max);
  }
}

export function sanitizeCompanyOrderForm(form = {}) {
  const next = { ...form };

  Object.keys(ORDER_TEXT_FIELDS).forEach((field) => {
    if (field in next) {
      next[field] = sanitizeCompanyOrderField(field, next[field]);
    }
  });

  return next;
}

export function sanitizeTrackOrderInput(value) {
  return sanitizeOrderReference(value, 100);
}

export function hasValidationErrors(errors = {}) {
  return Object.values(errors).some(Boolean);
}
