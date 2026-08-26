const ACCESS_TOKEN_KEY = "dms_access_token";
const REFRESH_TOKEN_KEY = "dms_refresh_token";
const LEGACY_ACCESS_TOKEN_KEY = "dms_access_token";
const LEGACY_REFRESH_TOKEN_KEY = "dms_refresh_token";
const USER_KEY = "dms_user";
const ACCESS_EXPIRES_KEY = "dms_access_expires_at";
const IMPERSONATION_FLAG_KEY = "dms_impersonating";
const SESSION_USER_KEY = "dms_session_user";
const DEVICE_TRUST_TOKEN_KEY = "dms_device_trust_token";

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
