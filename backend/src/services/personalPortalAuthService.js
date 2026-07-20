const config = require("../config");
const ApiError = require("../utils/ApiError");
const PersonalPortalUser = require("../models/PersonalPortalUser");
const PersonalPortalSession = require("../models/PersonalPortalSession");
const PersonalRequestOrder = require("../models/PersonalRequestOrder");
const { sendTwoFactorCode } = require("./emailService");
const twoFactorStore = require("./twoFactorStore");
const tokenService = require("./tokenService");

function personalOtpKey(sessionId) {
  return `personal:${sessionId}`;
}

function formatPersonalUser(row) {
  if (!row) return null;

  const firstName = row.first_name || "";
  const lastName = row.last_name || "";
  const email = row.email || "";
  const displayName =
    `${firstName} ${lastName}`.trim() || email.split("@")[0] || "Patient";

  return {
    id: row.id || row.personal_user_id,
    firstName,
    lastName,
    email,
    phone: row.phone || "",
    displayName,
    role: "Personal",
    portal: "personal",
  };
}

/**
 * Password-based registration is disabled. Accounts are created
 * automatically on first email + OTP sign-in.
 */
async function register() {
  throw new ApiError(
    410,
    "Password registration is no longer available. Sign in with your email to receive a verification code."
  );
}

async function login({ email, ipAddress, userAgent }) {
  const user = await PersonalPortalUser.findOrCreateLightweightByEmail(email);

  if (!user.is_active) {
    throw new ApiError(403, "Your account is inactive. Please contact support.");
  }

  const sessionToken = tokenService.generateSessionToken();
  const expiresAt = tokenService.getSessionExpiryDate(false);

  const session = await PersonalPortalSession.create({
    personalUserId: user.id,
    sessionToken,
    ipAddress,
    userAgent,
    expiresAt,
  });

  const otpCode = tokenService.generateOtpCode();
  const otpExpiresAt =
    Date.now() + config.twoFactor.expiresMinutes * 60 * 1000;

  twoFactorStore.set(personalOtpKey(session.id), otpCode, otpExpiresAt);

  const emailResult = await sendTwoFactorCode({
    to: user.email,
    name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Patient",
    code: otpCode,
    subtitle: "Personal Request Portal",
  });

  return {
    requiresTwoFactor: true,
    sessionToken,
    email: tokenService.maskEmail(user.email),
    expiresInMinutes: config.twoFactor.expiresMinutes,
    devCodeLogged: emailResult.devLogged === true,
  };
}

async function verifyTwoFactor({ sessionToken, code, trustDevice = false }) {
  const session = await PersonalPortalSession.findBySessionToken(sessionToken);

  if (!session) {
    throw new ApiError(401, "Invalid or expired session");
  }

  if (session.two_factor_verified) {
    throw new ApiError(400, "Two-factor authentication already completed");
  }

  const isValidCode = twoFactorStore.verify(personalOtpKey(session.id), code);

  if (!isValidCode) {
    throw new ApiError(401, "Invalid or expired verification code");
  }

  const expiresAt = tokenService.getSessionExpiryDate(trustDevice);

  await PersonalPortalSession.markTwoFactorVerified(session.id, {
    trustDevice,
    expiresAt,
  });

  await PersonalPortalUser.updateLastLogin(session.personal_user_id);

  const accessToken = tokenService.generatePersonalAccessToken({
    personalUserId: session.personal_user_id,
    sessionId: session.id,
  });

  const refreshToken = tokenService.generatePersonalRefreshToken({
    personalUserId: session.personal_user_id,
    sessionId: session.id,
    sessionToken,
  });

  return {
    accessToken,
    refreshToken,
    sessionToken,
    expiresIn: tokenService.getAccessTokenExpiresInSeconds(),
    user: formatPersonalUser(session),
    trustDevice,
  };
}

async function resendTwoFactor({ sessionToken }) {
  const session = await PersonalPortalSession.findBySessionToken(sessionToken);

  if (!session) {
    throw new ApiError(401, "Invalid or expired session");
  }

  if (session.two_factor_verified) {
    throw new ApiError(400, "Two-factor authentication already completed");
  }

  const otpKey = personalOtpKey(session.id);
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
    name: `${session.first_name} ${session.last_name}`.trim() || "Patient",
    code: otpCode,
    subtitle: "Personal Request Portal",
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
    decoded = tokenService.verifyPersonalRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const session = await PersonalPortalSession.findById(decoded.sessionId);

  if (!session || session.session_token !== decoded.sessionToken) {
    throw new ApiError(401, "Session expired or invalid");
  }

  if (!session.two_factor_verified) {
    throw new ApiError(401, "Two-factor authentication required");
  }

  const accessToken = tokenService.generatePersonalAccessToken({
    personalUserId: session.personal_user_id,
    sessionId: session.id,
  });

  const nextRefreshToken = tokenService.generatePersonalRefreshToken({
    personalUserId: session.personal_user_id,
    sessionId: session.id,
    sessionToken: session.session_token,
  });

  return {
    accessToken,
    refreshToken: nextRefreshToken,
    expiresIn: tokenService.getAccessTokenExpiresInSeconds(),
    user: formatPersonalUser(session),
  };
}

async function logout({ refreshToken, sessionToken }) {
  let deleted = false;

  if (sessionToken) {
    const session = await PersonalPortalSession.findBySessionToken(sessionToken);
    if (session) {
      twoFactorStore.remove(personalOtpKey(session.id));
      deleted = await PersonalPortalSession.deleteBySessionToken(sessionToken);
    }
  }

  if (!deleted && refreshToken) {
    try {
      const decoded = tokenService.verifyPersonalRefreshToken(refreshToken);
      const session = await PersonalPortalSession.findById(decoded.sessionId);
      if (session) {
        twoFactorStore.remove(personalOtpKey(session.id));
        await PersonalPortalSession.deleteById(session.id);
      }
    } catch {
      // Ignore invalid refresh tokens on logout.
    }
  }

  return { message: "Logged out successfully" };
}

async function getCurrentUser(personalUserId) {
  const user = await PersonalPortalUser.findById(personalUserId);

  if (!user || !user.is_active) {
    throw new ApiError(401, "Account not found or inactive");
  }

  return formatPersonalUser(user);
}

async function updateAccountEmail(personalUserId, email) {
  const existing = await PersonalPortalUser.findByEmail(email);
  if (existing && existing.id !== personalUserId) {
    throw new ApiError(409, "An account with this email already exists", [
      { field: "email", message: "An account with this email already exists" },
    ]);
  }

  const user = await PersonalPortalUser.updateEmail(personalUserId, email);
  if (!user || !user.is_active) {
    throw new ApiError(401, "Account not found or inactive");
  }

  await PersonalRequestOrder.updateEmailForPortalUser(personalUserId, email);

  return {
    user: formatPersonalUser(user),
    message: "Email updated. Future notifications will use this address.",
  };
}

module.exports = {
  register,
  login,
  verifyTwoFactor,
  resendTwoFactor,
  refreshTokens,
  logout,
  getCurrentUser,
  updateAccountEmail,
  formatPersonalUser,
};
