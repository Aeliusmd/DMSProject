const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const config = require("../config");
const ApiError = require("../utils/ApiError");

function generateSessionToken() {
  return crypto.randomBytes(48).toString("hex");
}

function generateAccessToken(payload) {
  return jwt.sign(
    {
      sub: payload.employeeId,
      role: payload.role,
      sessionId: payload.sessionId,
      type: "access",
    },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
}

function generateRefreshToken(payload) {
  return jwt.sign(
    {
      sub: payload.employeeId,
      sessionId: payload.sessionId,
      sessionToken: payload.sessionToken,
      type: "refresh",
    },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

function generateCompanyAccessToken(payload) {
  return jwt.sign(
    {
      sub: payload.companyUserId,
      role: "Company",
      sessionId: payload.sessionId,
      type: "company_access",
      portal: "company",
    },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
}

function generateCompanyRefreshToken(payload) {
  return jwt.sign(
    {
      sub: payload.companyUserId,
      sessionId: payload.sessionId,
      sessionToken: payload.sessionToken,
      type: "company_refresh",
      portal: "company",
    },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

function generatePersonalAccessToken(payload) {
  return jwt.sign(
    {
      sub: payload.personalUserId,
      role: "Personal",
      sessionId: payload.sessionId,
      type: "personal_access",
      portal: "personal",
    },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
}

function generatePersonalRefreshToken(payload) {
  return jwt.sign(
    {
      sub: payload.personalUserId,
      sessionId: payload.sessionId,
      sessionToken: payload.sessionToken,
      type: "personal_refresh",
      portal: "personal",
    },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  );
}

function verifyAccessToken(token) {
  const decoded = jwt.verify(token, config.jwt.accessSecret);

  if (decoded.type !== "access") {
    throw new ApiError(401, "Invalid or expired session. Please sign in again.");
  }

  return decoded;
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, config.jwt.refreshSecret);

  if (decoded.type !== "refresh") {
    throw new ApiError(401, "Invalid or expired session. Please sign in again.");
  }

  return decoded;
}

function verifyCompanyAccessToken(token) {
  const decoded = jwt.verify(token, config.jwt.accessSecret);

  if (decoded.type !== "company_access" || decoded.portal !== "company") {
    throw new ApiError(401, "Invalid or expired session. Please sign in again.");
  }

  return decoded;
}

function verifyCompanyRefreshToken(token) {
  const decoded = jwt.verify(token, config.jwt.refreshSecret);

  if (decoded.type !== "company_refresh" || decoded.portal !== "company") {
    throw new ApiError(401, "Invalid or expired session. Please sign in again.");
  }

  return decoded;
}

function verifyPersonalAccessToken(token) {
  const decoded = jwt.verify(token, config.jwt.accessSecret);

  if (decoded.type !== "personal_access" || decoded.portal !== "personal") {
    throw new ApiError(401, "Invalid or expired session. Please sign in again.");
  }

  return decoded;
}

function verifyPersonalRefreshToken(token) {
  const decoded = jwt.verify(token, config.jwt.refreshSecret);

  if (decoded.type !== "personal_refresh" || decoded.portal !== "personal") {
    throw new ApiError(401, "Invalid or expired session. Please sign in again.");
  }

  return decoded;
}

function getAccessTokenExpiresInSeconds() {
  const value = config.jwt.accessExpiresIn;

  if (value.endsWith("m")) {
    return Number(value.replace("m", "")) * 60;
  }

  if (value.endsWith("h")) {
    return Number(value.replace("h", "")) * 3600;
  }

  if (value.endsWith("d")) {
    return Number(value.replace("d", "")) * 86400;
  }

  return 900;
}

function getSessionExpiryDate(trustDevice = false) {
  const days = trustDevice
    ? config.session.trustedDeviceDays
    : config.session.defaultDays;

  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function generateOtpCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function maskEmail(email) {
  if (!email || !email.includes("@")) {
    return email;
  }

  const [local, domain] = email.split("@");
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

function generatePersonalPortalEmailToken(email) {
  return jwt.sign(
    {
      email: `${email || ""}`.trim().toLowerCase(),
      type: "personal_portal_email",
    },
    config.jwt.accessSecret,
    { expiresIn: "2h" }
  );
}

function verifyPersonalPortalEmailToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);

    if (decoded.type !== "personal_portal_email" || !decoded.email) {
      throw new ApiError(
        401,
        "Email verification is invalid. Please verify your email again."
      );
    }

    return decoded.email;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error?.name === "TokenExpiredError") {
      throw new ApiError(
        401,
        "Email verification expired. Please verify your email again."
      );
    }

    throw new ApiError(
      401,
      "Email verification is invalid. Please verify your email again."
    );
  }
}

module.exports = {
  generateSessionToken,
  generateAccessToken,
  generateRefreshToken,
  generateCompanyAccessToken,
  generateCompanyRefreshToken,
  generatePersonalAccessToken,
  generatePersonalRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyCompanyAccessToken,
  verifyCompanyRefreshToken,
  verifyPersonalAccessToken,
  verifyPersonalRefreshToken,
  getAccessTokenExpiresInSeconds,
  getSessionExpiryDate,
  generateOtpCode,
  maskEmail,
  generatePersonalPortalEmailToken,
  verifyPersonalPortalEmailToken,
};
