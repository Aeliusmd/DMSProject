const crypto = require("crypto");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const config = require("../config");

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

function shouldSkipRateLimit() {
  return (
    config.nodeEnv === "test" ||
    config.authRateLimit.enabled === false
  );
}

function rateLimitExceededHandler(_req, res) {
  res.status(429).json({
    success: false,
    message: "Too many attempts. Please try again later.",
    errors: null,
  });
}

function normalizeAccountIdentifier(body = {}) {
  const raw =
    body.email ||
    body.identifier ||
    body.companyEmail ||
    "";

  const normalized = `${raw}`.trim().toLowerCase();
  return normalized || null;
}

function hashKeyPart(value) {
  if (!value) return "";
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 24);
}

function ipAccountKeyGenerator(req, res) {
  const ipKey = ipKeyGenerator(req.ip, 56);
  const account = normalizeAccountIdentifier(req.body);

  if (!account) {
    return ipKey;
  }

  return `${ipKey}:${hashKeyPart(account)}`;
}

function ipSessionKeyGenerator(req, res) {
  const ipKey = ipKeyGenerator(req.ip, 56);
  const sessionToken = `${req.body?.sessionToken || ""}`.trim();

  if (!sessionToken) {
    return ipKey;
  }

  return `${ipKey}:${hashKeyPart(sessionToken)}`;
}

function createAuthRateLimiter({ windowMs, max, keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: rateLimitExceededHandler,
    skip: shouldSkipRateLimit,
  });
}

const authLoginRateLimit = createAuthRateLimiter({
  windowMs: config.authRateLimit.login.windowMs,
  max: config.authRateLimit.login.max,
  keyGenerator: ipAccountKeyGenerator,
});

const authRegisterRateLimit = createAuthRateLimiter({
  windowMs: config.authRateLimit.register.windowMs,
  max: config.authRateLimit.register.max,
  keyGenerator: ipAccountKeyGenerator,
});

const authTwoFactorVerifyRateLimit = createAuthRateLimiter({
  windowMs: config.authRateLimit.twoFactorVerify.windowMs,
  max: config.authRateLimit.twoFactorVerify.max,
  keyGenerator: ipSessionKeyGenerator,
});

const authTwoFactorResendRateLimit = createAuthRateLimiter({
  windowMs: config.authRateLimit.twoFactorResend.windowMs,
  max: config.authRateLimit.twoFactorResend.max,
  keyGenerator: ipSessionKeyGenerator,
});

const authRefreshRateLimit = createAuthRateLimiter({
  windowMs: config.authRateLimit.refresh.windowMs,
  max: config.authRateLimit.refresh.max,
  keyGenerator: (req, res) => ipKeyGenerator(req.ip, 56),
});

module.exports = {
  authLoginRateLimit,
  authRegisterRateLimit,
  authTwoFactorVerifyRateLimit,
  authTwoFactorResendRateLimit,
  authRefreshRateLimit,
  FIFTEEN_MINUTES_MS,
  ONE_HOUR_MS,
};
