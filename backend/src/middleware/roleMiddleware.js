const ApiError = require("../utils/ApiError");
const { isAdminOrManager } = require("../utils/roles");

function denyRoles(...deniedRoles) {
  const denied = deniedRoles.map((role) => String(role).toLowerCase());

  return (req, _res, next) => {
    const userRole = String(req.user?.role || "").toLowerCase();

    if (denied.includes(userRole)) {
      return next(
        new ApiError(403, "You do not have permission to access this resource")
      );
    }

    return next();
  };
}

function authorizeSelfOrAdmin(paramName = "employeeId") {
  return (req, _res, next) => {
    if (isAdminOrManager(req.user?.role)) {
      return next();
    }

    const targetId = String(req.params[paramName] || "");
    const userId = String(req.user?.id || "");

    if (targetId && userId && targetId === userId) {
      return next();
    }

    return next(
      new ApiError(403, "You do not have permission to access this resource")
    );
  };
}

module.exports = {
  denyRoles,
  authorizeSelfOrAdmin,
};
