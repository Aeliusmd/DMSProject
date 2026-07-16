const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const config = require("../config");
const ApiError = require("../utils/ApiError");
const CompanyPortalUser = require("../models/CompanyPortalUser");
const CompanyPortalSession = require("../models/CompanyPortalSession");
const { sendTwoFactorCode } = require("./emailService");
const twoFactorStore = require("./twoFactorStore");
const tokenService = require("./tokenService");

function companyOtpKey(sessionId) {
  return `company:${sessionId}`;
}

/** Unusable hash so password_hash stays NOT NULL; login is OTP-only. */
async function generateUnusedPasswordHash() {
  return bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
}

function formatCompanyUser(row) {
  if (!row) return null;

  return {
    id: row.id || row.company_user_id,
    companyName: row.company_name,
    email: row.email,
    phone: row.phone,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2 || "",
    city: row.city,
    state: row.state,
    zip: row.zip,
    role: "Company",
    portal: "company",
  };
}

async function register(data) {
  const existing = await CompanyPortalUser.findByEmail(data.email);

  if (existing) {
    throw new ApiError(409, "An account with this email already exists", [
      { field: "email", message: "An account with this email already exists" },
    ]);
  }

  const passwordHash = await generateUnusedPasswordHash();

  const user = await CompanyPortalUser.create({
    companyName: data.companyName,
    phone: data.phone,
    email: data.email,
    passwordHash,
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2,
    city: data.city,
    state: data.state,
    zip: data.zip,
  });

  return {
    user: formatCompanyUser(user),
    message:
      "Registration successful. Sign in with your company email to receive a verification code.",
  };
}

async function login({ email, ipAddress, userAgent }) {
  const user = await CompanyPortalUser.findByEmailForAuth(email);

  if (!user) {
    throw new ApiError(401, "No company account found for this email", [
      { field: "email", message: "No company account found for this email" },
    ]);
  }

  if (!user.is_active) {
    throw new ApiError(
      403,
      "Your account is inactive. Please contact support."
    );
  }

  const sessionToken = tokenService.generateSessionToken();
  const expiresAt = tokenService.getSessionExpiryDate(false);

  const session = await CompanyPortalSession.create({
    companyUserId: user.id,
    sessionToken,
    ipAddress,
    userAgent,
    expiresAt,
  });

  const otpCode = tokenService.generateOtpCode();
  const otpExpiresAt =
    Date.now() + config.twoFactor.expiresMinutes * 60 * 1000;

  twoFactorStore.set(companyOtpKey(session.id), otpCode, otpExpiresAt);

  const emailResult = await sendTwoFactorCode({
    to: user.email,
    name: user.company_name,
    code: otpCode,
  });

  return {
    requiresTwoFactor: true,
    sessionToken,
    email: tokenService.maskEmail(user.email),
    expiresInMinutes: config.twoFactor.expiresMinutes,
    devCodeLogged: emailResult.devLogged === true,
  };
}

async function verifyTwoFactor({
  sessionToken,
  code,
  trustDevice = false,
}) {
  const session = await CompanyPortalSession.findBySessionToken(sessionToken);

  if (!session) {
    throw new ApiError(401, "Invalid or expired session");
  }

  if (session.two_factor_verified) {
    throw new ApiError(400, "Two-factor authentication already completed");
  }

  const isValidCode = twoFactorStore.verify(companyOtpKey(session.id), code);

  if (!isValidCode) {
    throw new ApiError(401, "Invalid or expired verification code");
  }

  const expiresAt = tokenService.getSessionExpiryDate(trustDevice);

  await CompanyPortalSession.markTwoFactorVerified(session.id, {
    trustDevice,
    expiresAt,
  });

  await CompanyPortalUser.updateLastLogin(session.company_user_id);

  const accessToken = tokenService.generateCompanyAccessToken({
    companyUserId: session.company_user_id,
    sessionId: session.id,
  });

  const refreshToken = tokenService.generateCompanyRefreshToken({
    companyUserId: session.company_user_id,
    sessionId: session.id,
    sessionToken,
  });

  return {
    accessToken,
    refreshToken,
    sessionToken,
    expiresIn: tokenService.getAccessTokenExpiresInSeconds(),
    user: formatCompanyUser(session),
    trustDevice,
  };
}

async function resendTwoFactor({ sessionToken }) {
  const session = await CompanyPortalSession.findBySessionToken(sessionToken);

  if (!session) {
    throw new ApiError(401, "Invalid or expired session");
  }

  if (session.two_factor_verified) {
    throw new ApiError(400, "Two-factor authentication already completed");
  }

  const otpKey = companyOtpKey(session.id);
  const lastSentAt = twoFactorStore.getLastSentAt(otpKey);
  const cooldownMs = config.twoFactor.resendCooldownSeconds * 1000;

  if (lastSentAt && Date.now() - lastSentAt < cooldownMs) {
    const waitSeconds = Math.ceil(
      (cooldownMs - (Date.now() - lastSentAt)) / 1000
    );
    throw new ApiError(
      429,
      `Please wait ${waitSeconds} seconds before requesting a new code`
    );
  }

  const otpCode = tokenService.generateOtpCode();
  const otpExpiresAt =
    Date.now() + config.twoFactor.expiresMinutes * 60 * 1000;

  twoFactorStore.set(otpKey, otpCode, otpExpiresAt);

  const emailResult = await sendTwoFactorCode({
    to: session.email,
    name: session.company_name,
    code: otpCode,
  });

  return {
    message: "Verification code resent",
    email: tokenService.maskEmail(session.email),
    expiresInMinutes: config.twoFactor.expiresMinutes,
    devCodeLogged: emailResult.devLogged === true,
  };
}

async function refreshTokens({ refreshToken }) {
  let decoded;

  try {
    decoded = tokenService.verifyCompanyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const session = await CompanyPortalSession.findById(decoded.sessionId);

  if (!session || session.session_token !== decoded.sessionToken) {
    throw new ApiError(401, "Session expired or invalid");
  }

  if (!session.two_factor_verified) {
    throw new ApiError(401, "Two-factor authentication required");
  }

  const accessToken = tokenService.generateCompanyAccessToken({
    companyUserId: session.company_user_id,
    sessionId: session.id,
  });

  const nextRefreshToken = tokenService.generateCompanyRefreshToken({
    companyUserId: session.company_user_id,
    sessionId: session.id,
    sessionToken: session.session_token,
  });

  return {
    accessToken,
    refreshToken: nextRefreshToken,
    expiresIn: tokenService.getAccessTokenExpiresInSeconds(),
    user: formatCompanyUser(session),
  };
}

async function logout({ refreshToken, sessionToken }) {
  let deleted = false;
  let companyUserId = null;

  if (sessionToken) {
    const session = await CompanyPortalSession.findBySessionToken(sessionToken);
    if (session) {
      companyUserId = session.company_user_id;
      twoFactorStore.remove(companyOtpKey(session.id));
      deleted = await CompanyPortalSession.deleteBySessionToken(sessionToken);
    }
  }

  if (!deleted && refreshToken) {
    try {
      const decoded = tokenService.verifyCompanyRefreshToken(refreshToken);
      const session = await CompanyPortalSession.findById(decoded.sessionId);

      if (session) {
        companyUserId = session.company_user_id;
        twoFactorStore.remove(companyOtpKey(session.id));
        await CompanyPortalSession.deleteById(session.id);
        deleted = true;
      }
    } catch {
      // Ignore invalid refresh tokens on logout.
    }
  }

  return {
    message: "Logged out successfully",
    companyUserId,
  };
}

async function getCurrentUser(companyUserId) {
  const user = await CompanyPortalUser.findById(companyUserId);

  if (!user || !user.is_active) {
    throw new ApiError(401, "Account not found or inactive");
  }

  return formatCompanyUser(user);
}

module.exports = {
  register,
  login,
  verifyTwoFactor,
  resendTwoFactor,
  refreshTokens,
  logout,
  getCurrentUser,
  formatCompanyUser,
};
