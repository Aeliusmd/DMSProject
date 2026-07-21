const bcrypt = require("bcryptjs");
const Stripe = require("stripe");
const config = require("../config");
const ApiError = require("../utils/ApiError");
const { getPool } = require("../config/database");
const CompanyPortalEmployee = require("../models/CompanyPortalEmployee");
const CompanyPortalEmployeeSession = require("../models/CompanyPortalEmployeeSession");
const CompanyPortalUser = require("../models/CompanyPortalUser");
const tokenService = require("./tokenService");

function formatEmployeeUser(sessionRow) {
  return {
    id: sessionRow.employee_id,
    companyUserId: sessionRow.company_user_id,
    name: sessionRow.employee_name,
    email: sessionRow.employee_email,
    companyName: sessionRow.company_name,
    walletBalance: Number(sessionRow.wallet_balance || 0),
    role: "CompanyEmployee",
    portal: "company",
    isAdmin: false,
  };
}

async function login({ email, password, ipAddress, userAgent, trustDevice = false }) {
  const employee = await CompanyPortalEmployee.findByEmail(email);

  if (!employee) {
    throw new ApiError(401, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, employee.password_hash);
  if (!passwordMatches) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (!employee.is_active) {
    throw new ApiError(
      403,
      "Your account is currently blocked. Please contact your company administrator."
    );
  }

  const sessionToken = tokenService.generateSessionToken();
  const expiresAt = tokenService.getSessionExpiryDate(trustDevice);

  const session = await CompanyPortalEmployeeSession.create({
    employeeId: employee.id,
    companyUserId: employee.company_user_id,
    sessionToken,
    trustDevice,
    ipAddress,
    userAgent,
    expiresAt,
  });

  await CompanyPortalEmployee.updateLastLogin(employee.id);

  const accessToken = tokenService.generateCompanyAccessToken({
    companyUserId: employee.company_user_id,
    employeeId: employee.id,
    role: "CompanyEmployee",
    sessionId: session.id,
  });

  const refreshToken = tokenService.generateCompanyRefreshToken({
    companyUserId: employee.company_user_id,
    employeeId: employee.id,
    role: "CompanyEmployee",
    sessionId: session.id,
    sessionToken,
  });

  const hydrated = await CompanyPortalEmployeeSession.findById(session.id);

  return {
    accessToken,
    refreshToken,
    sessionToken,
    expiresIn: tokenService.getAccessTokenExpiresInSeconds(),
    user: formatEmployeeUser(hydrated),
    trustDevice,
  };
}

async function refreshTokens({ refreshToken }) {
  let decoded;

  try {
    decoded = tokenService.verifyCompanyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  if (!decoded.employeeId) {
    throw new ApiError(401, "Invalid employee session");
  }

  const session = await CompanyPortalEmployeeSession.findById(decoded.sessionId);

  if (!session || session.session_token !== decoded.sessionToken) {
    throw new ApiError(401, "Session expired or invalid");
  }

  if (Number(session.employee_is_active) === 0) {
    await CompanyPortalEmployeeSession.deleteById(session.id);
    throw new ApiError(
      403,
      "Your account is currently blocked. Please contact your company administrator."
    );
  }

  const accessToken = tokenService.generateCompanyAccessToken({
    companyUserId: session.company_user_id,
    employeeId: session.employee_id,
    role: "CompanyEmployee",
    sessionId: session.id,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: tokenService.getAccessTokenExpiresInSeconds(),
    user: formatEmployeeUser(session),
  };
}

async function logout({ refreshToken, sessionToken }) {
  let deleted = false;
  let companyUserId = null;
  let employeeId = null;
  let companyName = null;
  let performerName = null;

  if (sessionToken) {
    const session =
      await CompanyPortalEmployeeSession.findBySessionToken(sessionToken);
    if (session) {
      companyUserId = session.company_user_id;
      employeeId = session.employee_id;
      companyName = session.company_name || null;
      performerName = session.employee_name || "Company Employee";
      deleted = await CompanyPortalEmployeeSession.deleteBySessionToken(
        sessionToken
      );
    }
  }

  if (!deleted && refreshToken) {
    try {
      const decoded = tokenService.verifyCompanyRefreshToken(refreshToken);
      if (decoded.employeeId) {
        const session = await CompanyPortalEmployeeSession.findById(
          decoded.sessionId
        );
        if (session) {
          companyUserId = session.company_user_id;
          employeeId = session.employee_id;
          companyName = session.company_name || null;
          performerName = session.employee_name || "Company Employee";
          await CompanyPortalEmployeeSession.deleteById(decoded.sessionId);
          deleted = true;
        }
      }
    } catch {
      // Ignore invalid refresh tokens on logout.
    }
  }

  return {
    message: "Logged out successfully",
    companyUserId,
    employeeId,
    companyName,
    performerName,
  };
}

async function getCurrentUser(employeeId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT e.*, u.company_name
     FROM company_portal_employees e
     INNER JOIN company_portal_users u ON u.id = e.company_user_id
     WHERE e.id = :employeeId
       AND e.deleted_at IS NULL
     LIMIT 1`,
    { employeeId }
  );

  const employee = rows[0];
  if (!employee || !employee.is_active) {
    throw new ApiError(
      401,
      "Your account is currently blocked. Please contact your company administrator."
    );
  }

  return {
    id: employee.id,
    companyUserId: employee.company_user_id,
    name: employee.name,
    email: employee.email,
    companyName: employee.company_name,
    walletBalance: Number(employee.wallet_balance || 0),
    role: "CompanyEmployee",
    portal: "company",
    isAdmin: false,
  };
}

module.exports = {
  login,
  refreshTokens,
  logout,
  getCurrentUser,
  formatEmployeeUser,
};
