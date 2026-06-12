const ApiError = require("../utils/ApiError");

/**
 * Protect routes — implement JWT/session verification here.
 */
function authenticate(_req, _res, next) {
  // TODO: verify token from Authorization header
  next(new ApiError(501, "Authentication not implemented yet"));
}

function authorize(..._roles) {
  return (_req, _res, next) => {
    // TODO: check user role against allowed roles
    next(new ApiError(501, "Authorization not implemented yet"));
  };
}

module.exports = { authenticate, authorize };
