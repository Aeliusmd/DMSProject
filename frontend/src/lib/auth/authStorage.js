const LEGACY_ACCESS_TOKEN_KEY = "dms_access_token";
const LEGACY_REFRESH_TOKEN_KEY = "dms_refresh_token";
const USER_KEY = "dms_user";
const ACCESS_EXPIRES_KEY = "dms_access_expires_at";

function isBrowser() {
  return typeof window !== "undefined";
}

function clearLegacyTokenStorage() {
  if (!isBrowser()) return;
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
}

if (isBrowser()) {
  clearLegacyTokenStorage();
}

export function getAccessToken() {
  return null;
}

export function getRefreshToken() {
  return null;
}

export function getAccessExpiresAt() {
  if (!isBrowser()) return null;
  const raw = sessionStorage.getItem(ACCESS_EXPIRES_KEY);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function getStoredUser() {
  if (!isBrowser()) return null;

  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuth({ user, accessExpiresAt } = {}) {
  if (!isBrowser()) return;

  clearLegacyTokenStorage();

  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  if (accessExpiresAt) {
    sessionStorage.setItem(ACCESS_EXPIRES_KEY, String(accessExpiresAt));
  }
}

export function clearAuth() {
  if (!isBrowser()) return;

  clearLegacyTokenStorage();
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(ACCESS_EXPIRES_KEY);
}

export function isAuthenticated() {
  return Boolean(getStoredUser());
}
