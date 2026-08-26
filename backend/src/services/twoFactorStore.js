const crypto = require("crypto");
const AuthOtpCode = require("../models/AuthOtpCode");

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function hashesMatch(storedHash, incomingHash) {
  const a = Buffer.from(String(storedHash || ""), "utf8");
  const b = Buffer.from(String(incomingHash || ""), "utf8");

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

function toMs(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Persist a hashed OTP in MySQL so any app server behind a load balancer
 * can verify it. Callers should pass the recipient email when known.
 *
 * @param {string|number} lookupKey session-scoped key (not the email alone)
 * @param {string} code plain OTP (hashed before save)
 * @param {number} expiresAtMs expiry as epoch ms
 * @param {string} [email] recipient email stored with the row
 */
async function set(lookupKey, code, expiresAtMs, email = "") {
  const startTime = new Date();
  const endTime = new Date(expiresAtMs);

  await AuthOtpCode.upsert({
    lookupKey,
    email,
    otpHash: hashCode(code),
    startTime,
    endTime,
  });
}

async function verify(lookupKey, code) {
  const entry = await AuthOtpCode.findByLookupKey(lookupKey);

  if (!entry) {
    return false;
  }

  const endsAtMs = toMs(entry.end_time);
  if (!endsAtMs || Date.now() > endsAtMs) {
    await AuthOtpCode.deleteByLookupKey(lookupKey);
    return false;
  }

  const isValid = hashesMatch(entry.otp_hash, hashCode(code));
  if (isValid) {
    await AuthOtpCode.deleteByLookupKey(lookupKey);
  }

  return isValid;
}

async function remove(lookupKey) {
  await AuthOtpCode.deleteByLookupKey(lookupKey);
}

async function getLastSentAt(lookupKey) {
  const entry = await AuthOtpCode.findByLookupKey(lookupKey);
  return toMs(entry?.start_time);
}

async function cleanupExpired() {
  try {
    await AuthOtpCode.deleteExpired();
  } catch {
    // Ignore cleanup failures (e.g. pool not ready during boot).
  }

  try {
    const AuthTrustedDevice = require("../models/AuthTrustedDevice");
    await AuthTrustedDevice.deleteExpired();
  } catch {
    // Ignore cleanup failures.
  }
}

setInterval(cleanupExpired, 60 * 1000).unref();

module.exports = {
  set,
  verify,
  remove,
  getLastSentAt,
};
