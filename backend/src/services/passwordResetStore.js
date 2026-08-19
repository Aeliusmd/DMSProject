const store = new Map();

function set(sessionToken, payload, expiresAt) {
  store.set(String(sessionToken), {
    ...payload,
    expiresAt,
    createdAt: Date.now(),
  });
}

function get(sessionToken) {
  const key = String(sessionToken || "");
  const entry = store.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  return entry;
}

function consume(sessionToken) {
  const entry = get(sessionToken);
  store.delete(String(sessionToken || ""));
  return entry;
}

function remove(sessionToken) {
  store.delete(String(sessionToken || ""));
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
  get,
  consume,
  remove,
};
