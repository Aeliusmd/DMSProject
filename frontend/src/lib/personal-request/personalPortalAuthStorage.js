const LEGACY_ACCESS_TOKEN_KEY = "dms_personal_access_token";
const LEGACY_REFRESH_TOKEN_KEY = "dms_personal_refresh_token";
const LEGACY_SESSION_TOKEN_KEY = "dms_personal_session_token";
const USER_KEY = "dms_personal_user";
const ACCESS_EXPIRES_KEY = "dms_personal_access_expires_at";

function isBrowser() {
  return typeof window !== "undefined";
}

function clearLegacyTokenStorage() {
  if (!isBrowser()) return;
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  localStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
}

if (isBrowser()) {
  clearLegacyTokenStorage();
}

export function getPersonalAccessToken() {
  return null;
}

export function getPersonalRefreshToken() {
  return null;
}

export function getPersonalSessionToken() {
  return null;
}

export function getPersonalAccessExpiresAt() {
  if (!isBrowser()) return null;
  const raw = sessionStorage.getItem(ACCESS_EXPIRES_KEY);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function getStoredPersonalUser() {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isPersonalAuthenticated() {
  return Boolean(getStoredPersonalUser());
}

export function setPersonalAuth({ user, accessExpiresAt } = {}) {
  if (!isBrowser()) return;

  clearLegacyTokenStorage();

  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  if (accessExpiresAt) {
    sessionStorage.setItem(ACCESS_EXPIRES_KEY, String(accessExpiresAt));
  }
}

export function clearPersonalAuth() {
  if (!isBrowser()) return;

  clearLegacyTokenStorage();
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(ACCESS_EXPIRES_KEY);
}
