function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function isAdmin(role) {
  return normalizeRole(role) === "admin";
}

function isManager(role) {
  return normalizeRole(role) === "manager";
}

function isEmployee(role) {
  return normalizeRole(role) === "employee";
}

function isAdminOrManager(role) {
  const normalized = normalizeRole(role);
  return normalized === "admin" || normalized === "manager";
}

module.exports = {
  normalizeRole,
  isAdmin,
  isManager,
  isEmployee,
  isAdminOrManager,
};
