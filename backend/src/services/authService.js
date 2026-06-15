const bcrypt = require("bcryptjs");
const config = require("../config");
const ApiError = require("../utils/ApiError");
const Employee = require("../models/Employee");
const AuthSession = require("../models/AuthSession");
const { sendTwoFactorCode } = require("./emailService");
const twoFactorStore = require("./twoFactorStore");
const tokenService = require("./tokenService");
const { formatUser } = require("../views/responses");

async function login({ identifier, password, ipAddress, userAgent }) {
  const employee = await Employee.findByEmailOrLogonForAuth(identifier.trim());

  if (!employee) {
    throw new ApiError(401, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, employee.password_hash);

  if (!passwordMatches) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (employee.deleted_at) {
    throw new ApiError(
      403,
      "Your account has been deleted. Please contact the administrator."
    );
  }

  if (employee.is_terminated) {
    throw new ApiError(
      403,
      "Your account has been terminated. Please contact the administrator."
    );
  }

  const sessionToken = tokenService.generateSessionToken();
  const expiresAt = tokenService.getSessionExpiryDate(false);

  const session = await AuthSession.create({
    employeeId: employee.id,
    sessionToken,
    ipAddress,
    userAgent,
    expiresAt,
  });

  const otpCode = tokenService.generateOtpCode();
  const otpExpiresAt =
    Date.now() + config.twoFactor.expiresMinutes * 60 * 1000;

  twoFactorStore.set(session.id, otpCode, otpExpiresAt);

  const emailResult = await sendTwoFactorCode({
    to: employee.email,
    name: employee.name,
    code: otpCode,
  });

  return {
    requiresTwoFactor: true,
    sessionToken,
    email: tokenService.maskEmail(employee.email),
    expiresInMinutes: config.twoFactor.expiresMinutes,
    devCodeLogged: emailResult.devLogged === true,
  };
}

async function verifyTwoFactor({
  sessionToken,
  code,
  trustDevice = false,
  ipAddress,
  userAgent,
}) {
  const session = await AuthSession.findBySessionToken(sessionToken);

  if (!session) {
    throw new ApiError(401, "Invalid or expired session");
  }

  if (session.two_factor_verified) {
    throw new ApiError(400, "Two-factor authentication already completed");
  }

  const isValidCode = twoFactorStore.verify(session.id, code);

  if (!isValidCode) {
    throw new ApiError(401, "Invalid or expired verification code");
  }

  const expiresAt = tokenService.getSessionExpiryDate(trustDevice);

  await AuthSession.markTwoFactorVerified(session.id, {
    trustDevice,
    expiresAt,
  });

  await Employee.updateLastLogin(session.employee_id);

  const accessToken = tokenService.generateAccessToken({
    employeeId: session.employee_id,
    role: session.role,
    sessionId: session.id,
  });

  const refreshToken = tokenService.generateRefreshToken({
    employeeId: session.employee_id,
    sessionId: session.id,
    sessionToken,
  });

  return {
    accessToken,
    refreshToken,
    sessionToken,
    expiresIn: tokenService.getAccessTokenExpiresInSeconds(),
    user: formatUser({
      id: session.employee_id,
      name: session.name,
      email: session.email,
      logon: session.logon,
      role: session.role,
    }),
    trustDevice,
    ipAddress,
    userAgent,
  };
}

async function resendTwoFactor({ sessionToken }) {
  const session = await AuthSession.findBySessionToken(sessionToken);

  if (!session) {
    throw new ApiError(401, "Invalid or expired session");
  }

  if (session.two_factor_verified) {
    throw new ApiError(400, "Two-factor authentication already completed");
  }

  const lastSentAt = twoFactorStore.getLastSentAt(session.id);
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

  twoFactorStore.set(session.id, otpCode, otpExpiresAt);

  const emailResult = await sendTwoFactorCode({
    to: session.email,
    name: session.name,
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
    decoded = tokenService.verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const session = await AuthSession.findById(decoded.sessionId);

  if (!session || session.session_token !== decoded.sessionToken) {
    throw new ApiError(401, "Session is no longer valid");
  }

  if (!session.two_factor_verified) {
    throw new ApiError(401, "Two-factor authentication required");
  }

  const accessToken = tokenService.generateAccessToken({
    employeeId: session.employee_id,
    role: session.role,
    sessionId: session.id,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: tokenService.getAccessTokenExpiresInSeconds(),
    user: formatUser({
      id: session.employee_id,
      name: session.name,
      email: session.email,
      logon: session.logon,
      role: session.role,
    }),
  };
}

async function logout({ refreshToken, sessionToken }) {
  if (refreshToken) {
    try {
      const decoded = tokenService.verifyRefreshToken(refreshToken);
      twoFactorStore.remove(decoded.sessionId);
      await AuthSession.deleteById(decoded.sessionId);
      return { message: "Logged out successfully" };
    } catch {
      // Fall through to session token logout
    }
  }

  if (sessionToken) {
    const session = await AuthSession.findBySessionToken(sessionToken);

    if (session) {
      twoFactorStore.remove(session.id);
      await AuthSession.deleteBySessionToken(sessionToken);
    }

    return { message: "Logged out successfully" };
  }

  throw new ApiError(400, "Refresh token or session token is required");
}

async function getCurrentUser(employeeId) {
  const employee = await Employee.findById(employeeId);

  if (!employee) {
    throw new ApiError(404, "User not found");
  }

  return formatUser({
    id: employee.id,
    name: employee.name,
    email: employee.email,
    logon: employee.logon,
    role: employee.role,
  });
}

module.exports = {
  login,
  verifyTwoFactor,
  resendTwoFactor,
  refreshTokens,
  logout,
  getCurrentUser,
};
