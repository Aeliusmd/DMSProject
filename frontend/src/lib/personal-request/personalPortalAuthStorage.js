const ACCESS_TOKEN_KEY = "dms_personal_access_token";
const REFRESH_TOKEN_KEY = "dms_personal_refresh_token";
const USER_KEY = "dms_personal_user";
const SESSION_TOKEN_KEY = "dms_personal_session_token";

export function getPersonalAccessToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getPersonalRefreshToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getPersonalSessionToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_TOKEN_KEY);
}

export function getStoredPersonalUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isPersonalAuthenticated() {
  return Boolean(getPersonalAccessToken());
}

export function setPersonalAuth({ accessToken, refreshToken, user, sessionToken }) {
  if (typeof window === "undefined") return;
  if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  if (sessionToken) localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearPersonalAuth() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SESSION_TOKEN_KEY);
}
