import { API_BASE_URL } from "@/config/api";
import {
  isNetworkError,
  NETWORK_UNAVAILABLE_MESSAGE,
} from "@/lib/networkErrors";
import { withCredentials } from "@/lib/auth/fetchCredentials";
import {
  beginImpersonationSession,
  clearAuth,
  getAccessExpiresAt,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  isImpersonating,
  setAuth,
} from "./authStorage";

function withAuthHeaders(headers = {}) {
  const nextHeaders = { ...headers };
  const accessToken = getAccessToken();

  if (accessToken) {
    nextHeaders.Authorization = `Bearer ${accessToken}`;
  }

  return nextHeaders;
}

export class ApiRequestError extends Error {
  constructor(message, status, errors = null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.errors = errors;
  }
}

async function parseResponse(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function safeFetch(url, options) {
  try {
    return await fetch(url, withCredentials(options));
  } catch (error) {
    if (isNetworkError(error)) {
      throw new ApiRequestError(NETWORK_UNAVAILABLE_MESSAGE, 0);
    }
    throw error;
  }
}

let refreshPromise = null;

function refreshOnce() {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

const REFRESH_SKEW_MS = 60 * 1000;
const ACTIVITY_WINDOW_MS = 15 * 60 * 1000;
const INACTIVE_RECHECK_MS = 60 * 1000;
/** Log out after this much continuous idle time (no mouse/keyboard/scroll/touch). */
const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const IDLE_CHECK_MS = 60 * 1000;
const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

let refreshTimer = null;
let idleCheckTimer = null;
let idleLogoutInProgress = false;
let activityListenersBound = false;
let lastActivityAt = Date.now();
let staffAuthChannel = null;

const STAFF_AUTH_CHANNEL = "dms-staff-auth";
const TOKEN_HANDOFF_MS = 300;

function markActivity() {
  lastActivityAt = Date.now();
}

function hasStaffClientTokens() {
  return Boolean(getAccessToken() || getRefreshToken());
}

function bindStaffAuthChannel() {
  if (typeof window === "undefined") return;
  if (typeof BroadcastChannel === "undefined") return;
  if (staffAuthChannel) return;

  staffAuthChannel = new BroadcastChannel(STAFF_AUTH_CHANNEL);
  staffAuthChannel.onmessage = (event) => {
    if (event?.data?.type !== "auth-tokens-request") return;
    const refreshToken = getRefreshToken();
    if (!refreshToken) return;

    staffAuthChannel.postMessage({
      type: "auth-tokens",
      accessToken: getAccessToken(),
      refreshToken,
      accessExpiresAt: getAccessExpiresAt(),
      user: getStoredUser(),
    });
  };
}

function unbindStaffAuthChannel() {
  if (!staffAuthChannel) return;
  try {
    staffAuthChannel.close();
  } catch {
    // Ignore channel close failures.
  }
  staffAuthChannel = null;
}

function requestTokensFromOtherTabs() {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
      resolve(false);
      return;
    }

    const channel = new BroadcastChannel(STAFF_AUTH_CHANNEL);
    const timer = setTimeout(() => {
      try {
        channel.close();
      } catch {
        // Ignore channel close failures.
      }
      resolve(false);
    }, TOKEN_HANDOFF_MS);

    channel.onmessage = (event) => {
      if (event?.data?.type !== "auth-tokens") return;
      if (!event.data.refreshToken) return;

      clearTimeout(timer);
      setAuth({
        user: event.data.user || undefined,
        accessToken: event.data.accessToken || undefined,
        refreshToken: event.data.refreshToken,
        accessExpiresAt: event.data.accessExpiresAt || undefined,
      });

      try {
        channel.close();
      } catch {
        // Ignore channel close failures.
      }
      resolve(true);
    };

    channel.postMessage({ type: "auth-tokens-request" });
  });
}

/**
 * Staff auth is tab-scoped via sessionStorage. Closing the tab clears tokens,
 * but httpOnly cookies can otherwise restore the session. Require client tokens
 * (or a handoff from another open tab); otherwise end the cookie/server session.
 * Company/personal portals are unaffected.
 */
export async function ensureStaffClientSession() {
  if (typeof window === "undefined") return false;

  if (hasStaffClientTokens()) {
    bindStaffAuthChannel();
    return true;
  }

  const recovered = await requestTokensFromOtherTabs();
  if (recovered && hasStaffClientTokens()) {
    bindStaffAuthChannel();
    return true;
  }

  try {
    await logout();
  } catch {
    clearAuth();
  }

  return false;
}

function clearIdleCheckTimer() {
  if (idleCheckTimer) {
    clearTimeout(idleCheckTimer);
    idleCheckTimer = null;
  }
}

function scheduleIdleCheck() {
  if (typeof window === "undefined") return;

  clearIdleCheckTimer();
  if (!getStoredUser()) return;

  idleCheckTimer = setTimeout(() => {
    void checkIdleTimeout();
  }, IDLE_CHECK_MS);
}

async function checkIdleTimeout() {
  if (typeof window === "undefined") return;
  if (!getStoredUser()) return;
  if (idleLogoutInProgress) return;

  const idleForMs = Date.now() - lastActivityAt;

  if (idleForMs < IDLE_TIMEOUT_MS) {
    scheduleIdleCheck();
    return;
  }

  idleLogoutInProgress = true;
  const wasImpersonating = isImpersonating();

  try {
    await logout();
  } catch {
    clearAuth();
  } finally {
    idleLogoutInProgress = false;
  }

  window.location.replace(wasImpersonating ? "/login-as?ended=1" : "/login");
}

async function autoRefreshTick() {
  if (typeof window === "undefined") return;
  if (!getStoredUser()) return;

  const isActive = Date.now() - lastActivityAt <= ACTIVITY_WINDOW_MS;

  if (isActive) {
    try {
      await refreshOnce();
    } catch {
      return;
    }

    return;
  }

  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(autoRefreshTick, INACTIVE_RECHECK_MS);
}

export function scheduleTokenRefresh() {
  if (typeof window === "undefined") return;

  clearTimeout(refreshTimer);
  refreshTimer = null;

  if (!getStoredUser()) return;

  const expiryMs = getAccessExpiresAt();
  if (!expiryMs) return;

  const delay = Math.max(0, expiryMs - Date.now() - REFRESH_SKEW_MS);
  refreshTimer = setTimeout(autoRefreshTick, delay);
}

export function startAuthAutoRefresh() {
  if (typeof window === "undefined") return;

  if (!activityListenersBound) {
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, markActivity, { passive: true })
    );
    activityListenersBound = true;
  }

  bindStaffAuthChannel();
  markActivity();
  scheduleTokenRefresh();
  scheduleIdleCheck();
}

export function stopAuthAutoRefresh() {
  if (typeof window === "undefined") return;

  clearTimeout(refreshTimer);
  refreshTimer = null;
  clearIdleCheckTimer();
  unbindStaffAuthChannel();

  if (activityListenersBound) {
    ACTIVITY_EVENTS.forEach((event) =>
      window.removeEventListener(event, markActivity)
    );
    activityListenersBound = false;
  }
}

export async function authFetch(path, options = {}, _isRetry = false) {
  const response = await safeFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: withAuthHeaders(options?.headers || {}),
  });

  if (response.status === 401 && !_isRetry && !path.startsWith("/auth/")) {
    try {
      await refreshOnce();
    } catch {
      clearAuth();
      throw new ApiRequestError("Session expired. Please sign in again.", 401);
    }

    return authFetch(path, options, true);
  }

  return response;
}

export async function request(
  path,
  { method = "GET", body, auth = false, cache, signal, _isRetry = false } = {}
) {
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const headers = withAuthHeaders(
    !isFormData ? { "Content-Type": "application/json" } : {}
  );

  let requestBody;
  if (body !== undefined && body !== null) {
    requestBody = isFormData ? body : JSON.stringify(body);
  }

  const response = await safeFetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: requestBody,
    ...(cache ? { cache } : {}),
    ...(signal ? { signal } : {}),
  });

  if (
    response.status === 401 &&
    auth &&
    !_isRetry &&
    !path.startsWith("/auth/")
  ) {
    try {
      await refreshOnce();
    } catch {
      clearAuth();
      throw new ApiRequestError("Session expired. Please sign in again.", 401);
    }

    return request(path, { method, body, auth, cache, signal, _isRetry: true });
  }

  const data = await parseResponse(response);

  if (!response.ok) {
    throw new ApiRequestError(
      data?.message || "Request failed",
      response.status,
      data?.errors || null
    );
  }

  return data;
}

export async function login({ email, password }) {
  return request("/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function verifyTwoFactor({ sessionToken, code, trustDevice }) {
  return request("/auth/verify-2fa", {
    method: "POST",
    body: {
      sessionToken,
      code,
      trustDevice,
    },
  });
}

export async function resendTwoFactor(sessionToken) {
  return request("/auth/resend-2fa", {
    method: "POST",
    body: { sessionToken },
  });
}

export async function requestPasswordReset({ email, password, confirmPassword }) {
  return request("/auth/forgot-password", {
    method: "POST",
    body: { email, password, confirmPassword },
  });
}

export async function verifyForgotPassword({ sessionToken, code }) {
  return request("/auth/forgot-password/verify", {
    method: "POST",
    body: { sessionToken, code },
  });
}

export async function resendForgotPassword(sessionToken) {
  return request("/auth/forgot-password/resend", {
    method: "POST",
    body: { sessionToken },
  });
}

export async function refreshAccessToken() {
  const data = await request("/auth/refresh", {
    method: "POST",
    body: {
      refreshToken: getRefreshToken() || undefined,
    },
  });

  const payload = data?.data || {};

  setAuth({
    user: payload.user,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    accessExpiresAt: payload.accessExpiresAt,
  });

  scheduleTokenRefresh();

  return payload;
}

export async function logout() {
  stopAuthAutoRefresh();

  try {
    await request("/auth/logout", {
      method: "POST",
      body: {
        refreshToken: getRefreshToken() || undefined,
      },
    });
  } catch {
    // Clear local session even if backend logout fails.
  }

  clearAuth();
}

export async function getCurrentUser() {
  const data = await request("/auth/me", { auth: true });
  const user = data?.data?.user || null;

  if (user) {
    setAuth({ user });
  }

  return user;
}

export function saveAuthSession(payload) {
  setAuth({
    user: payload.user,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    accessExpiresAt: payload.accessExpiresAt,
  });

  startAuthAutoRefresh();
}

export async function startImpersonation(employeeId) {
  return request(`/employees/${employeeId}/impersonate`, {
    method: "POST",
    auth: true,
  });
}

export async function exchangeImpersonation(exchangeToken) {
  return request("/auth/impersonate/exchange", {
    method: "POST",
    body: { exchangeToken },
  });
}

export function saveImpersonationSession(payload) {
  beginImpersonationSession({
    user: payload.user,
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    accessExpiresAt: payload.accessExpiresAt,
  });

  startAuthAutoRefresh();
}

export async function exitImpersonationSession() {
  if (!isImpersonating()) {
    return logout();
  }

  stopAuthAutoRefresh();

  try {
    await request("/auth/logout", {
      method: "POST",
      body: {
        refreshToken: getRefreshToken() || undefined,
      },
    });
  } catch {
    // Clear local impersonation session even if backend logout fails.
  }

  clearAuth();
}
