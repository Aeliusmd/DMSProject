const ACCESS_TOKEN_KEY = "dms_access_token";
const REFRESH_TOKEN_KEY = "dms_refresh_token";
const LEGACY_ACCESS_TOKEN_KEY = "dms_access_token";
const LEGACY_REFRESH_TOKEN_KEY = "dms_refresh_token";
const USER_KEY = "dms_user";
const ACCESS_EXPIRES_KEY = "dms_access_expires_at";
const IMPERSONATION_FLAG_KEY = "dms_impersonating";
const SESSION_USER_KEY = "dms_session_user";
const DEVICE_TRUST_TOKEN_KEY = "dms_device_trust_token";
const BROWSER_STAFF_OWNER_KEY = "dms_browser_staff_owner";

function isBrowser() {
  return typeof window !== "undefined";
}

function clearLegacyLocalTokenStorage() {
  if (!isBrowser()) return;
  // Older builds stored tokens in localStorage; prefer sessionStorage.
  try {
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  } catch {
    // Ignore storage failures.
  }
}

if (isBrowser()) {
  clearLegacyLocalTokenStorage();
}

export function isImpersonating() {
  if (!isBrowser()) return false;
  try {
    return sessionStorage.getItem(IMPERSONATION_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function getAccessToken() {
  if (!isBrowser()) return null;
  try {
    return sessionStorage.getItem(ACCESS_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function getRefreshToken() {
  if (!isBrowser()) return null;
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function getAccessExpiresAt() {
  if (!isBrowser()) return null;
  const raw = sessionStorage.getItem(ACCESS_EXPIRES_KEY);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseUser(raw) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeStaffEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function toStaffIdentity(user) {
  if (!user) return null;

  const id = user.id ?? user.userId ?? null;
  const email = user.email || "";

  if (id == null && !email) return null;

  return { id, email };
}

export function isSameStaffUser(a, b) {
  const left = toStaffIdentity(a);
  const right = toStaffIdentity(b);

  if (!left || !right) return false;

  if (left.id != null && right.id != null && String(left.id) === String(right.id)) {
    return true;
  }

  const leftEmail = normalizeStaffEmail(left.email);
  const rightEmail = normalizeStaffEmail(right.email);

  return Boolean(leftEmail && rightEmail && leftEmail === rightEmail);
}

export function getBrowserStaffOwner() {
  if (!isBrowser()) return null;

  try {
    return toStaffIdentity(parseUser(localStorage.getItem(BROWSER_STAFF_OWNER_KEY)));
  } catch {
    return null;
  }
}

export function setBrowserStaffOwner(user) {
  if (!isBrowser()) return;

  const identity = toStaffIdentity(user);
  if (!identity) return;

  try {
    localStorage.setItem(BROWSER_STAFF_OWNER_KEY, JSON.stringify(identity));
  } catch {
    // Ignore storage failures.
  }
}

export function clearBrowserStaffOwner() {
  if (!isBrowser()) return;

  try {
    localStorage.removeItem(BROWSER_STAFF_OWNER_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/** Staff account that owns this browser (admin during impersonation, not the employee). */
export function getStaffBrowserUser() {
  if (!isBrowser()) return null;

  const owner = getBrowserStaffOwner();
  if (owner) return owner;

  if (isImpersonating()) {
    return toStaffIdentity(parseUser(localStorage.getItem(USER_KEY)));
  }

  return toStaffIdentity(getStoredUser());
}

export function getStoredUser() {
  if (!isBrowser()) return null;

  if (isImpersonating()) {
    try {
      return parseUser(sessionStorage.getItem(SESSION_USER_KEY));
    } catch {
      return null;
    }
  }

  return parseUser(localStorage.getItem(USER_KEY));
}

export function setAuth({ user, accessToken, refreshToken, accessExpiresAt } = {}) {
  if (!isBrowser()) return;

  clearLegacyLocalTokenStorage();

  if (user) {
    const serialized = JSON.stringify(user);

    if (isImpersonating()) {
      sessionStorage.setItem(SESSION_USER_KEY, serialized);
    } else {
      localStorage.setItem(USER_KEY, serialized);
    }
  }

  // Only overwrite tokens when a non-empty string is provided so callers like
  // profile update / getCurrentUser can refresh the user without wiping auth.
  if (typeof accessToken === "string" && accessToken) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }

  if (typeof refreshToken === "string" && refreshToken) {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  if (accessExpiresAt) {
    sessionStorage.setItem(ACCESS_EXPIRES_KEY, String(accessExpiresAt));
  }
}

export function beginImpersonationSession({
  user,
  accessToken,
  refreshToken,
  accessExpiresAt,
} = {}) {
  if (!isBrowser()) return;

  sessionStorage.setItem(IMPERSONATION_FLAG_KEY, "1");
  setAuth({ user, accessToken, refreshToken, accessExpiresAt });
}

export function clearAuth() {
  if (!isBrowser()) return;

  const impersonating = isImpersonating();

  // Wipe order drafts with the auth session so the next user on this tab
  // cannot restore another person's unsaved edit.
  try {
    const prefix = "dms:order-draft-session:";
    const keysToRemove = [];
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key && key.startsWith(prefix)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => window.sessionStorage.removeItem(key));
  } catch {
    // Ignore storage failures.
  }

  clearLegacyLocalTokenStorage();

  try {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(ACCESS_EXPIRES_KEY);
    sessionStorage.removeItem(IMPERSONATION_FLAG_KEY);
    sessionStorage.removeItem(SESSION_USER_KEY);
  } catch {
    // Ignore storage failures.
  }

  if (!impersonating) {
    localStorage.removeItem(USER_KEY);
    clearBrowserStaffOwner();
  }
}

export function getDeviceTrustToken() {
  if (!isBrowser()) return null;
  try {
    return localStorage.getItem(DEVICE_TRUST_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setDeviceTrustToken(token) {
  if (!isBrowser()) return;
  try {
    if (typeof token === "string" && token) {
      localStorage.setItem(DEVICE_TRUST_TOKEN_KEY, token);
    }
  } catch {
    // Ignore storage failures.
  }
}

export function clearDeviceTrustToken() {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(DEVICE_TRUST_TOKEN_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function isAuthenticated() {
  return Boolean(getStoredUser());
}
