export const ROLES = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  EMPLOYEE: "Employee",
};

export function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

export function isAdmin(user) {
  return normalizeRole(user?.role) === "admin";
}

export function canAccessEmployeesPage(user) {
  return isAdmin(user);
}
