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

module.exports = {
  generateSessionToken,
  generateAccessToken,
  generateRefreshToken,
  generateCompanyAccessToken,
  generateCompanyRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyCompanyAccessToken,
  verifyCompanyRefreshToken,
  getAccessTokenExpiresInSeconds,
  getSessionExpiryDate,
  generateOtpCode,
  maskEmail,
};
