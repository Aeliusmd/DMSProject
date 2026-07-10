const ApiError = require("../utils/ApiError");
const tokenService = require("../services/tokenService");
const CompanyPortalSession = require("../models/CompanyPortalSession");

async function authenticateCompanyPortal(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new ApiError(401, "Authentication required");
    }

    const decoded = tokenService.verifyCompanyAccessToken(token);
    const session = await CompanyPortalSession.findById(decoded.sessionId);

    if (!session) {
      throw new ApiError(401, "Session expired or invalid");
    }

    if (!session.two_factor_verified) {
      throw new ApiError(401, "Two-factor authentication required");
    }

    req.companyUser = {
      id: decoded.sub,
      role: "Company",
      sessionId: decoded.sessionId,
    };

    req.companySession = session;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }

    return next(new ApiError(401, "Invalid or expired access token"));
  }
}

module.exports = { authenticateCompanyPortal };
