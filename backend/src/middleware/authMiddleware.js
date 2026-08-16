const ApiError = require("../utils/ApiError");
const tokenService = require("../services/tokenService");
const AuthSession = require("../models/AuthSession");
const { getAccessTokenFromRequest } = require("../utils/authCookies");

async function authenticate(req, _res, next) {
  try {
    const token = getAccessTokenFromRequest(req, "internal");

    if (!token) {
      throw new ApiError(401, "Authentication required");
    }

    const decoded = tokenService.verifyAccessToken(token);
    const session = await AuthSession.findById(decoded.sessionId);

    if (!session) {
      throw new ApiError(401, "Session expired or invalid");
    }

    if (!session.two_factor_verified) {
      throw new ApiError(401, "Two-factor authentication required");
    }

    req.user = {
      id: decoded.sub,
      role: decoded.role,
      sessionId: decoded.sessionId,
    };

    req.session = session;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }

    return next(new ApiError(401, "Invalid or expired access token"));
  }
}

function authorize(...allowedRoles) {
  const normalizedRoles = allowedRoles.map((role) => role.toLowerCase());

  return (req, _res, next) => {
    if (!req.user?.role) {
      return next(new ApiError(401, "Authentication required"));
    }

    const userRole = String(req.user.role).toLowerCase();

    if (!normalizedRoles.includes(userRole)) {
      return next(new ApiError(403, "You do not have permission to access this resource"));
    }

    next();
  };
}

module.exports = { authenticate, authorize };
