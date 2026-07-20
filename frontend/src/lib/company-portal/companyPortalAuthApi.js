import { API_BASE_URL } from "@/config/api";
import {
  isNetworkError,
  NETWORK_UNAVAILABLE_MESSAGE,
} from "@/lib/networkErrors";
import { ApiRequestError } from "@/lib/auth/authApi";
import {
  clearCompanyAuth,
  getCompanyAccessToken,
  getCompanyRefreshToken,
  setCompanyAuth,
} from "./companyPortalAuthStorage";

async function parseResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (isNetworkError(error)) {
      throw new ApiRequestError(NETWORK_UNAVAILABLE_MESSAGE, 0);
    }
    throw error;
  }
}

let refreshPromise = null;

function refreshCompanyOnce() {
  if (!refreshPromise) {
    refreshPromise = refreshCompanyAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

const REFRESH_SKEW_MS = 60 * 1000;
const ACTIVITY_WINDOW_MS = 15 * 60 * 1000;
const INACTIVE_RECHECK_MS = 60 * 1000;
const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

let refreshTimer = null;
let activityListenersBound = false;
let lastActivityAt = Date.now();

function markActivity() {
  lastActivityAt = Date.now();
}

function decodeJwtExpiryMs(token) {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return null;

    const normalized = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized));

    return typeof decoded?.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function autoRefreshTick() {
  if (typeof window === "undefined") return;

  const accessToken = getCompanyAccessToken();
  const refreshToken = getCompanyRefreshToken();

  if (!accessToken || !refreshToken) return;

  const isActive = Date.now() - lastActivityAt <= ACTIVITY_WINDOW_MS;

  if (isActive) {
    try {
      await refreshCompanyOnce();
    } catch {
      return;
    }

    return;
  }

  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(autoRefreshTick, INACTIVE_RECHECK_MS);
}

export function scheduleCompanyTokenRefresh() {
  if (typeof window === "undefined") return;

  clearTimeout(refreshTimer);
  refreshTimer = null;

  const accessToken = getCompanyAccessToken();
  if (!accessToken || !getCompanyRefreshToken()) return;

  const expiryMs = decodeJwtExpiryMs(accessToken);
  if (!expiryMs) return;

  const delay = Math.max(0, expiryMs - Date.now() - REFRESH_SKEW_MS);
  refreshTimer = setTimeout(autoRefreshTick, delay);
}

export function startCompanyAuthAutoRefresh() {
  if (typeof window === "undefined") return;

  if (!activityListenersBound) {
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, markActivity, { passive: true })
    );
    activityListenersBound = true;
  }

  markActivity();
  scheduleCompanyTokenRefresh();
}

export function stopCompanyAuthAutoRefresh() {
  if (typeof window === "undefined") return;

  clearTimeout(refreshTimer);
  refreshTimer = null;

  if (activityListenersBound) {
    ACTIVITY_EVENTS.forEach((event) =>
      window.removeEventListener(event, markActivity)
    );
    activityListenersBound = false;
  }
}

export async function tryRefreshCompanyAccessToken() {
  try {
    await refreshCompanyOnce();
    return true;
  } catch {
    clearCompanyAuth();
    return false;
  }
}

async function request(path, options = {}) {
  const response = await safeFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new ApiRequestError(
      payload?.message || "Request failed",
      response.status,
      payload?.errors || null
    );
  }

  return payload;
}

async function authRequest(path, options = {}) {
  const accessToken = getCompanyAccessToken();

  const response = await safeFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    try {
      await refreshCompanyOnce();
    } catch {
      clearCompanyAuth();
      throw new ApiRequestError("Session expired. Please sign in again.", 401);
    }

    const retryToken = getCompanyAccessToken();
    const retry = await safeFetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(retryToken ? { Authorization: `Bearer ${retryToken}` } : {}),
        ...(options.headers || {}),
      },
    });

    const retryPayload = await parseResponse(retry);
    if (!retry.ok) {
      throw new ApiRequestError(
        retryPayload?.message || "Request failed",
        retry.status,
        retryPayload?.errors || null
      );
    }
    return retryPayload;
  }

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new ApiRequestError(
      payload?.message || "Request failed",
      response.status,
      payload?.errors || null
    );
  }

  return payload;
}

export async function registerCompany(payload) {
  return request("/company-portal/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginCompanyEmployee({ email, password }) {
  return request("/company-portal/auth/employee/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function loginCompany({ email, password }) {
  return request("/company-portal/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function verifyCompanyTwoFactor({
  sessionToken,
  code,
  trustDevice = false,
}) {
  return request("/company-portal/auth/verify-2fa", {
    method: "POST",
    body: JSON.stringify({ sessionToken, code, trustDevice }),
  });
}

export async function resendCompanyTwoFactor(sessionToken) {
  return request("/company-portal/auth/resend-2fa", {
    method: "POST",
    body: JSON.stringify({ sessionToken }),
  });
}

export async function refreshCompanyAccessToken() {
  const refreshToken = getCompanyRefreshToken();

  if (!refreshToken) {
    throw new ApiRequestError("No refresh token available", 401);
  }

  const response = await request("/company-portal/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

  const payload = response?.data || {};
  setCompanyAuth({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
  });

  scheduleCompanyTokenRefresh();

  return payload;
}

export async function logoutCompany() {
  const refreshToken = getCompanyRefreshToken();

  stopCompanyAuthAutoRefresh();

  try {
    if (refreshToken) {
      await request("/company-portal/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    }
  } catch {
    // Always clear local session.
  } finally {
    clearCompanyAuth();
  }
}

export async function getCompanyCurrentUser() {
  const payload = await authRequest("/company-portal/auth/me", { method: "GET" });
  const user = payload?.data?.user;
  if (user) {
    setCompanyAuth({ user });
  }
  return payload;
}

export function saveCompanyAuthSession(payload) {
  setCompanyAuth(payload);
  startCompanyAuthAutoRefresh();
}
