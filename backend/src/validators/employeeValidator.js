const MAX_NAME_LENGTH = 150;
const MAX_LOGON_LENGTH = 100;
const MAX_EMAIL_LENGTH = 255;
const MAX_PASSWORD_LENGTH = 128;
const ALLOWED_ROLES = new Set(["Manager", "Employee"]);

function trimToString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validateCreateEmployee(body = {}) {
  const errors = [];

  const name = trimToString(body.name);
  const logon = trimToString(body.logon || body.userName);
  const email = trimToString(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const role = trimToString(body.role);

  if (!name) {
    errors.push({ field: "name", message: "Name is required" });
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.push({
      field: "name",
      message: `Name must be ${MAX_NAME_LENGTH} characters or less`,
    });
  }

  if (!logon) {
    errors.push({ field: "logon", message: "Username is required" });
  } else if (logon.length > MAX_LOGON_LENGTH) {
    errors.push({
      field: "logon",
      message: `Username must be ${MAX_LOGON_LENGTH} characters or less`,
    });
  } else if (!/^[A-Za-z0-9._-]+$/.test(logon)) {
    errors.push({
      field: "logon",
      message: "Username can contain only letters, numbers, dot, underscore, and hyphen",
    });
  }

  if (!email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (email.length > MAX_EMAIL_LENGTH) {
    errors.push({
      field: "email",
      message: `Email must be ${MAX_EMAIL_LENGTH} characters or less`,
    });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  }

  if (!password) {
    errors.push({ field: "password", message: "Password is required" });
  } else if (password.length < 8) {
    errors.push({
      field: "password",
      message: "Password must be at least 8 characters",
    });
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push({
      field: "password",
      message: `Password must be ${MAX_PASSWORD_LENGTH} characters or less`,
    });
  }

  if (!role) {
    errors.push({ field: "role", message: "Role is required" });
  } else if (!ALLOWED_ROLES.has(role)) {
    errors.push({ field: "role", message: "Role must be Manager or Employee" });
  }

  return {
    valid: errors.length === 0,
    errors,
    data: { name, logon, email, password, role },
  };
}

function validateUpdateEmployee(body = {}) {
  const errors = [];

  const name = trimToString(body.name);
  const logon = trimToString(body.logon || body.userName);
  const email = trimToString(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const role = trimToString(body.role);

  if (!name) {
    errors.push({ field: "name", message: "Name is required" });
  } else if (name.length > MAX_NAME_LENGTH) {
    errors.push({
      field: "name",
      message: `Name must be ${MAX_NAME_LENGTH} characters or less`,
    });
  }

  if (!logon) {
    errors.push({ field: "logon", message: "Username is required" });
  } else if (logon.length > MAX_LOGON_LENGTH) {
    errors.push({
      field: "logon",
      message: `Username must be ${MAX_LOGON_LENGTH} characters or less`,
    });
  } else if (!/^[A-Za-z0-9._-]+$/.test(logon)) {
    errors.push({
      field: "logon",
      message: "Username can contain only letters, numbers, dot, underscore, and hyphen",
    });
  }

  if (!email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (email.length > MAX_EMAIL_LENGTH) {
    errors.push({
      field: "email",
      message: `Email must be ${MAX_EMAIL_LENGTH} characters or less`,
    });
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  }

  // Password is optional on update; validate only when provided.
  if (password.length > 0 && password.length < 8) {
    errors.push({
      field: "password",
      message: "Password must be at least 8 characters",
    });
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    errors.push({
      field: "password",
      message: `Password must be ${MAX_PASSWORD_LENGTH} characters or less`,
    });
  }

  if (!role) {
    errors.push({ field: "role", message: "Role is required" });
  } else if (!ALLOWED_ROLES.has(role)) {
    errors.push({ field: "role", message: "Role must be Manager or Employee" });
  }

  const hasPassword = password.length > 0;

  return {
    valid: errors.length === 0,
    errors,
    data: {
      name,
      logon,
      email,
      role,
      ...(hasPassword ? { password } : {}),
    },
  };
}

module.exports = { validateCreateEmployee, validateUpdateEmployee };
