const ApiError = require("../utils/ApiError");
const CompanyPortalEmployeeSession = require("../models/CompanyPortalEmployeeSession");
const CompanyPortalSession = require("../models/CompanyPortalSession");
const tokenService = require("../services/tokenService");
const { getAccessTokenFromRequest } = require("../utils/authCookies");

async function authenticateCompanyPortal(req, _res, next) {
  try {
    const token = getAccessTokenFromRequest(req, "company");

    if (!token) {
      throw new ApiError(401, "Authentication required");
    }

    const decoded = tokenService.verifyCompanyAccessToken(token);
    const companyUserId = decoded.companyUserId || decoded.sub;

    if (decoded.employeeId) {
      const session = await CompanyPortalEmployeeSession.findById(
        decoded.sessionId
      );

      if (!session || Number(session.employee_id) !== Number(decoded.employeeId)) {
        throw new ApiError(401, "Session expired or invalid");
      }

      // MySQL may return TINYINT as 0/1; treat only explicit inactive as blocked.
      if (Number(session.employee_is_active) === 0) {
        throw new ApiError(403, "Your employee account is inactive");
      }

      req.companyUser = {
        id: companyUserId,
        employeeId: decoded.employeeId,
        employeeName: session.employee_name,
        email: session.employee_email,
        companyName: session.company_name,
        role: "CompanyEmployee",
        isAdmin: false,
        sessionId: decoded.sessionId,
      };
      req.companySession = session;
      return next();
    }

    const session = await CompanyPortalSession.findById(decoded.sessionId);

    if (!session) {
      throw new ApiError(401, "Session expired or invalid");
    }

    if (!session.two_factor_verified) {
      throw new ApiError(401, "Two-factor authentication required");
    }

    req.companyUser = {
      id: companyUserId,
      employeeId: null,
      companyName: session.company_name || null,
      email: session.email || null,
      role: "Company",
      isAdmin: true,
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

function requireCompanyAdmin(req, _res, next) {
  if (!req.companyUser?.isAdmin) {
    return next(new ApiError(403, "Company admin access required"));
  }
  return next();
}

module.exports = { authenticateCompanyPortal, requireCompanyAdmin };
