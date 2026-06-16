const crypto = require("crypto");

const store = new Map();

function hashCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

function set(sessionId, code, expiresAt) {
  store.set(String(sessionId), {
    hash: hashCode(code),
    expiresAt,
    createdAt: Date.now(),
  });
}

function verify(sessionId, code) {
  const entry = store.get(String(sessionId));

  if (!entry) {
    return false;
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(String(sessionId));
    return false;
  }

  const isValid = entry.hash === hashCode(code);
  if (isValid) {
    store.delete(String(sessionId));
  }

  return isValid;
}

function remove(sessionId) {
  store.delete(String(sessionId));
}

function getLastSentAt(sessionId) {
  const entry = store.get(String(sessionId));
  return entry?.createdAt || null;
}

function cleanupExpired() {
  const now = Date.now();

  for (const [key, entry] of store.entries()) {
    if (now > entry.expiresAt) {
      store.delete(key);
    }
  }
}

setInterval(cleanupExpired, 60 * 1000).unref();

module.exports = {
  set,
  verify,
  remove,
  getLastSentAt,
};
