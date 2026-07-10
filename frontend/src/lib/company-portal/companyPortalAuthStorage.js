const ACCESS_TOKEN_KEY = "dms_company_access_token";
const REFRESH_TOKEN_KEY = "dms_company_refresh_token";
const USER_KEY = "dms_company_user";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getCompanyAccessToken() {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getCompanyRefreshToken() {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredCompanyUser() {
  if (!isBrowser()) return null;

  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setCompanyAuth({ accessToken, refreshToken, user }) {
  if (!isBrowser()) return;

  if (accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  }

  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearCompanyAuth() {
  if (!isBrowser()) return;

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isCompanyAuthenticated() {
  return Boolean(getCompanyAccessToken());
}
