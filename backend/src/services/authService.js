const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const config = require("../config");
const ApiError = require("../utils/ApiError");
const Employee = require("../models/Employee");
const AuthSession = require("../models/AuthSession");
const AuthTrustedDevice = require("../models/AuthTrustedDevice");
const { sendTwoFactorCode } = require("./emailService");
const twoFactorStore = require("./twoFactorStore");
const impersonationTicketStore = require("./impersonationTicketStore");
const passwordResetStore = require("./passwordResetStore");
const tokenService = require("./tokenService");
const { formatUser } = require("../views/responses");

const IMPERSONATION_SESSION_HOURS = 4;
const IMPERSONATION_TICKET_TTL_MS = impersonationTicketStore.DEFAULT_TTL_MS;

function isAdminRole(role) {
  return String(role || "").trim().toLowerCase() === "admin";
}

function assertEmployeeCanBeImpersonated(employee) {
  if (!employee || employee.deleted_at) {
    throw new ApiError(404, "Employee not found");
  }

  if (isAdminRole(employee.role)) {
    throw new ApiError(403, "Admin accounts cannot be signed into this way");
  }

  if (employee.is_terminated) {
    throw new ApiError(403, "This account is terminated");
  }

  if (employee.is_suspended) {
    throw new ApiError(403, "This account is suspended");
  }
}

async function attachImpersonationUser(user, impersonatorId) {
  if (!impersonatorId) {
    return user;
  }

  const impersonator = await Employee.findById(impersonatorId, {
    includeDeleted: true,
  });

  return {
    ...user,
    impersonated: true,
    impersonatedBy: {
      id: impersonator?.id || impersonatorId,
      name: impersonator?.name || "Admin",
    },
  };
}

async function issueAuthTokens({
  employee,
  session,
  sessionToken,
  trustDevice = false,
  deviceTrustToken = null,
  deviceTrustExpiresAt = null,
  ipAddress,
  userAgent,
}) {
  const employeeId = employee.employee_id || employee.id;
  const role = employee.role || session.role;

  const accessToken = tokenService.generateAccessToken({
    employeeId,
    role,
    sessionId: session.id,
  });

  const refreshToken = tokenService.generateRefreshToken({
    employeeId,
    sessionId: session.id,
    sessionToken,
  });

  return {
    requiresTwoFactor: false,
    accessToken,
    refreshToken,
    sessionToken,
    expiresIn: tokenService.getAccessTokenExpiresInSeconds(),
    user: formatUser({
      id: employeeId,
      name: employee.name || session.name,
      email: employee.email || session.email,
      logon: employee.logon || session.logon,
      role,
    }),
    trustDevice: Boolean(trustDevice),
    deviceTrustToken: deviceTrustToken || undefined,
    deviceTrustExpiresAt: deviceTrustExpiresAt || undefined,
    trustedDeviceDays: config.session.trustedDeviceDays,
    ipAddress,
    userAgent,
  };
}

async function login({
  identifier,
  password,
  ipAddress,
  userAgent,
  deviceTrustToken = null,
}) {
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

  if (employee.is_suspended) {
    const dueForReactivation =
      employee.reactivated_date &&
      new Date(employee.reactivated_date).getTime() <= Date.now();

    if (dueForReactivation) {
      await Employee.unsuspend(employee.id);
    } else {
      throw new ApiError(
        403,
        "Your account has been suspended. Please contact the administrator."
      );
    }
  }

  const trustedDevice = await AuthTrustedDevice.findValidByToken(deviceTrustToken);

  if (trustedDevice && Number(trustedDevice.employee_id) === Number(employee.id)) {
    const sessionToken = tokenService.generateSessionToken();
    const expiresAt = tokenService.getSessionExpiryDate(false);

    const session = await AuthSession.create({
      employeeId: employee.id,
      sessionToken,
      ipAddress,
      userAgent,
      expiresAt,
      twoFactorVerified: true,
      trustDevice: true,
    });

    await Employee.updateLastLogin(employee.id);

    return issueAuthTokens({
      employee,
      session,
      sessionToken,
      trustDevice: true,
      deviceTrustToken,
      deviceTrustExpiresAt: trustedDevice.expires_at,
      ipAddress,
      userAgent,
    });
  }

  if (deviceTrustToken) {
    // Stale / wrong-account trust token — drop it from DB if present.
    await AuthTrustedDevice.deleteByToken(deviceTrustToken);
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

  await twoFactorStore.set(session.id, otpCode, otpExpiresAt, employee.email);

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
    trustedDeviceDays: config.session.trustedDeviceDays,
    clearDeviceTrust: Boolean(deviceTrustToken),
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

  const isValidCode = await twoFactorStore.verify(session.id, code);

  if (!isValidCode) {
    throw new ApiError(401, "Invalid or expired verification code");
  }

  const expiresAt = tokenService.getSessionExpiryDate(trustDevice);

  await AuthSession.markTwoFactorVerified(session.id, {
    trustDevice,
    expiresAt,
  });

  await Employee.updateLastLogin(session.employee_id);

  let nextDeviceTrustToken = null;
  let deviceTrustExpiresAt = null;

  if (trustDevice) {
    nextDeviceTrustToken = crypto.randomBytes(32).toString("hex");
    const trustedAt = new Date();
    deviceTrustExpiresAt = tokenService.getSessionExpiryDate(true);

    await AuthTrustedDevice.create({
      employeeId: session.employee_id,
      deviceToken: nextDeviceTrustToken,
      trustedAt,
      expiresAt: deviceTrustExpiresAt,
    });
  }

  return issueAuthTokens({
    employee: {
      id: session.employee_id,
      name: session.name,
      email: session.email,
      logon: session.logon,
      role: session.role,
    },
    session,
    sessionToken,
    trustDevice,
    deviceTrustToken: nextDeviceTrustToken,
    deviceTrustExpiresAt,
    ipAddress,
    userAgent,
  });
}

async function resendTwoFactor({ sessionToken }) {
  const session = await AuthSession.findBySessionToken(sessionToken);

  if (!session) {
    throw new ApiError(401, "Invalid or expired session");
  }

  if (session.two_factor_verified) {
    throw new ApiError(400, "Two-factor authentication already completed");
  }

  const lastSentAt = await twoFactorStore.getLastSentAt(session.id);
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

  await twoFactorStore.set(session.id, otpCode, otpExpiresAt, session.email);

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

  const impersonatorId = decoded.impersonatorId || null;
  const accessToken = tokenService.generateAccessToken({
    employeeId: session.employee_id,
    role: session.role,
    sessionId: session.id,
    impersonatorId,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: tokenService.getAccessTokenExpiresInSeconds(),
    impersonated: Boolean(impersonatorId),
    user: await attachImpersonationUser(
      formatUser({
        id: session.employee_id,
        name: session.name,
        email: session.email,
        logon: session.logon,
        role: session.role,
      }),
      impersonatorId
    ),
  };
}

async function logout({ refreshToken, sessionToken }) {
  if (refreshToken) {
    try {
      const decoded = tokenService.verifyRefreshToken(refreshToken);
      await twoFactorStore.remove(decoded.sessionId);
      await AuthSession.deleteById(decoded.sessionId);
      return {
        message: "Logged out successfully",
        employeeId: decoded.sub,
        impersonated: Boolean(decoded.impersonatorId),
      };
    } catch {
      // Fall through to session token logout
    }
  }

  if (sessionToken) {
    const session = await AuthSession.findBySessionToken(sessionToken);

    if (session) {
      await twoFactorStore.remove(session.id);
      await AuthSession.deleteBySessionToken(sessionToken);
      return {
        message: "Logged out successfully",
        employeeId: session.employee_id,
      };
    }

    return { message: "Logged out successfully", employeeId: null };
  }

  throw new ApiError(400, "Refresh token or session token is required");
}

async function getCurrentUser(employeeId, { impersonatorId } = {}) {
  const employee = await Employee.findById(employeeId);

  if (!employee) {
    throw new ApiError(404, "User not found");
  }

  return attachImpersonationUser(
    formatUser({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      logon: employee.logon,
      role: employee.role,
    }),
    impersonatorId
  );
}

async function startImpersonation({
  adminId,
  adminRole,
  alreadyImpersonating,
  employeeId,
}) {
  if (alreadyImpersonating) {
    throw new ApiError(403, "Exit the current user session before signing in as another user");
  }

  if (!isAdminRole(adminRole)) {
    throw new ApiError(403, "Only administrators can sign in as another user");
  }

  if (Number(adminId) === Number(employeeId)) {
    throw new ApiError(400, "You are already signed in as this user");
  }

  const employee = await Employee.findById(employeeId);
  assertEmployeeCanBeImpersonated(employee);

  const exchangeToken = impersonationTicketStore.create(
    {
      employeeId: employee.id,
      impersonatorId: adminId,
    },
    IMPERSONATION_TICKET_TTL_MS
  );

  return {
    exchangeToken,
    expiresInSeconds: Math.floor(IMPERSONATION_TICKET_TTL_MS / 1000),
    user: formatUser({
      id: employee.id,
      name: employee.name,
      email: employee.email,
      logon: employee.logon,
      role: employee.role,
    }),
  };
}

async function exchangeImpersonation({ exchangeToken, ipAddress, userAgent }) {
  const ticket = impersonationTicketStore.consume(exchangeToken);

  if (!ticket?.employeeId || !ticket?.impersonatorId) {
    throw new ApiError(401, "This sign-in link is invalid or has expired");
  }

  const employee = await Employee.findById(ticket.employeeId);
  assertEmployeeCanBeImpersonated(employee);

  const impersonator = await Employee.findById(ticket.impersonatorId, {
    includeDeleted: true,
  });

  if (!impersonator || !isAdminRole(impersonator.role)) {
    throw new ApiError(403, "This sign-in link is no longer valid");
  }

  const sessionToken = tokenService.generateSessionToken();
  const expiresAt = new Date(
    Date.now() + IMPERSONATION_SESSION_HOURS * 60 * 60 * 1000
  );
  const auditUserAgent = `[impersonation by ${ticket.impersonatorId}] ${
    userAgent || ""
  }`.slice(0, 500);

  const session = await AuthSession.create({
    employeeId: employee.id,
    sessionToken,
    ipAddress,
    userAgent: auditUserAgent,
    expiresAt,
    twoFactorVerified: true,
  });

  const accessToken = tokenService.generateAccessToken({
    employeeId: employee.id,
    role: employee.role,
    sessionId: session.id,
    impersonatorId: ticket.impersonatorId,
  });

  const refreshToken = tokenService.generateRefreshToken({
    employeeId: employee.id,
    sessionId: session.id,
    sessionToken,
    impersonatorId: ticket.impersonatorId,
  });

  return {
    accessToken,
    refreshToken,
    sessionToken,
    expiresIn: tokenService.getAccessTokenExpiresInSeconds(),
    impersonated: true,
    user: await attachImpersonationUser(
      formatUser({
        id: employee.id,
        name: employee.name,
        email: employee.email,
        logon: employee.logon,
        role: employee.role,
      }),
      ticket.impersonatorId
    ),
    impersonator: {
      id: impersonator.id,
      name: impersonator.name,
    },
    ipAddress,
    userAgent,
  };
}

function passwordResetOtpKey(sessionToken) {
  return `password-reset:${sessionToken}`;
}

async function assertEmployeeCanResetPassword(employee) {
  if (!employee || employee.deleted_at) {
    throw new ApiError(404, "No account found for this email address");
  }

  if (employee.is_terminated) {
    throw new ApiError(
      403,
      "Your account has been terminated. Please contact the administrator."
    );
  }

  if (employee.is_suspended) {
    const dueForReactivation =
      employee.reactivated_date &&
      new Date(employee.reactivated_date).getTime() <= Date.now();

    if (dueForReactivation) {
      await Employee.unsuspend(employee.id);
    } else {
      throw new ApiError(
        403,
        "Your account has been suspended. Please contact the administrator."
      );
    }
  }
}

async function sendPasswordResetCode(employee, sessionToken) {
  const otpCode = tokenService.generateOtpCode();
  const otpExpiresAt =
    Date.now() + config.twoFactor.expiresMinutes * 60 * 1000;

  await twoFactorStore.set(
    passwordResetOtpKey(sessionToken),
    otpCode,
    otpExpiresAt,
    employee.email
  );

  const emailResult = await sendTwoFactorCode({
    to: employee.email,
    name: employee.name,
    code: otpCode,
    purpose: "password_reset",
  });

  return emailResult;
}

async function requestPasswordReset({ email, password }) {
  const employee = await Employee.findByEmailOrLogonForAuth(email);

  await assertEmployeeCanResetPassword(employee);

  const isSamePassword = await bcrypt.compare(password, employee.password_hash);

  if (isSamePassword) {
    throw new ApiError(400, "Validation failed", [
      {
        field: "password",
        message: "New password must be different from current password",
      },
    ]);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const sessionToken = tokenService.generateSessionToken();
  const expiresAt =
    Date.now() + config.twoFactor.expiresMinutes * 60 * 1000;

  passwordResetStore.set(
    sessionToken,
    {
      employeeId: employee.id,
      passwordHash,
    },
    expiresAt
  );

  const emailResult = await sendPasswordResetCode(employee, sessionToken);

  return {
    requiresTwoFactor: true,
    sessionToken,
    email: tokenService.maskEmail(employee.email),
    expiresInMinutes: config.twoFactor.expiresMinutes,
    resendCooldownSeconds: config.twoFactor.resendCooldownSeconds,
    devCodeLogged: emailResult.devLogged === true,
  };
}

async function verifyPasswordReset({ sessionToken, code }) {
  const pending = passwordResetStore.get(sessionToken);

  if (!pending) {
    throw new ApiError(401, "Invalid or expired password reset session");
  }

  const isValidCode = await twoFactorStore.verify(
    passwordResetOtpKey(sessionToken),
    code
  );

  if (!isValidCode) {
    throw new ApiError(401, "Invalid or expired verification code");
  }

  const employee = await Employee.findById(pending.employeeId);
  await assertEmployeeCanResetPassword(employee);

  await Employee.updatePassword(employee.id, pending.passwordHash);
  await AuthSession.deleteAllByEmployeeId(employee.id);
  passwordResetStore.consume(sessionToken);

  return {
    message: "Password updated successfully",
    employeeId: employee.id,
    employeeName: employee.name,
  };
}

async function resendPasswordReset({ sessionToken }) {
  const pending = passwordResetStore.get(sessionToken);

  if (!pending) {
    throw new ApiError(401, "Invalid or expired password reset session");
  }

  const lastSentAt = await twoFactorStore.getLastSentAt(
    passwordResetOtpKey(sessionToken)
  );
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

  const employee = await Employee.findById(pending.employeeId);
  await assertEmployeeCanResetPassword(employee);

  const emailResult = await sendPasswordResetCode(employee, sessionToken);

  return {
    message: "Verification code resent",
    email: tokenService.maskEmail(employee.email),
    expiresInMinutes: config.twoFactor.expiresMinutes,
    devCodeLogged: emailResult.devLogged === true,
  };
}

module.exports = {
  login,
  verifyTwoFactor,
  resendTwoFactor,
  refreshTokens,
  logout,
  getCurrentUser,
  startImpersonation,
  exchangeImpersonation,
  requestPasswordReset,
  verifyPasswordReset,
  resendPasswordReset,
};
