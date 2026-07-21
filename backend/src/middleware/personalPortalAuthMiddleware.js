const ApiError = require("../utils/ApiError");
const tokenService = require("../services/tokenService");
const PersonalPortalSession = require("../models/PersonalPortalSession");
const { getAccessTokenFromRequest } = require("../utils/authCookies");

async function authenticatePersonalPortal(req, _res, next) {
  try {
    const token = getAccessTokenFromRequest(req, "personal");

    if (!token) {
      throw new ApiError(401, "Authentication required");
    }

    const decoded = tokenService.verifyPersonalAccessToken(token);
    const session = await PersonalPortalSession.findById(decoded.sessionId);

    if (!session) {
      throw new ApiError(401, "Session expired or invalid");
    }

    if (!session.two_factor_verified) {
      throw new ApiError(401, "Two-factor authentication required");
    }

    req.personalUser = {
      id: decoded.sub,
      role: "Personal",
      sessionId: decoded.sessionId,
      email: session.email,
      firstName: session.first_name,
      lastName: session.last_name,
    };

    req.personalSession = session;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }

    return next(new ApiError(401, "Invalid or expired access token"));
  }
}

module.exports = { authenticatePersonalPortal };
