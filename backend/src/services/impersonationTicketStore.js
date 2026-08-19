const crypto = require("crypto");

const tickets = new Map();
const DEFAULT_TTL_MS = 60 * 1000;

function create(payload, ttlMs = DEFAULT_TTL_MS) {
  const token = crypto.randomBytes(32).toString("hex");

  tickets.set(token, {
    payload,
    expiresAt: Date.now() + ttlMs,
  });

  return token;
}

function consume(token) {
  const key = String(token || "").trim();
  const entry = tickets.get(key);
  tickets.delete(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    return null;
  }

  return entry.payload;
}

function cleanupExpired() {
  const now = Date.now();

  for (const [key, entry] of tickets.entries()) {
    if (now > entry.expiresAt) {
      tickets.delete(key);
    }
  }
}

setInterval(cleanupExpired, 60 * 1000).unref();

module.exports = {
  create,
  consume,
  DEFAULT_TTL_MS,
};
