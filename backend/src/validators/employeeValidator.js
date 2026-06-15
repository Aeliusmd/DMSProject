function validateCreateEmployee(body = {}) {
  const errors = [];

  const name = body.name?.trim();
  const logon = (body.logon || body.userName)?.trim();
  const email = body.email?.trim();
  const password = body.password;
  const role = body.role;

  if (!name) {
    errors.push({ field: "name", message: "Name is required" });
  }

  if (!logon) {
    errors.push({ field: "logon", message: "Username is required" });
  }

  if (!email) {
    errors.push({ field: "email", message: "Email is required" });
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
  }

  if (!role) {
    errors.push({ field: "role", message: "Role is required" });
  } else if (!["Manager", "Employee"].includes(role)) {
    errors.push({ field: "role", message: "Role must be Manager or Employee" });
  }

  return {
    valid: errors.length === 0,
    errors,
    data: { name, logon, email, password, role },
  };
}

module.exports = { validateCreateEmployee };
