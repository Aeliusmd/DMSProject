import { API_BASE_URL } from "@/config/api";
import {
  clearAuth,
  getAccessToken,
  getRefreshToken,
  setAuth,
} from "./authStorage";

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

// Ensures only one refresh request is in flight even if several authed
// requests get a 401 at the same time (e.g. concurrent dropdown loads).
let refreshPromise = null;

function refreshOnce() {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

// --- Silent auto-refresh (keeps active users signed in) --------------------
// While the user is actively using the app we proactively exchange the
// refresh token for a new access token shortly before the current one
// expires, so an expired access token never interrupts an in-progress task
// (e.g. filling out a new order). Idle users are refreshed lazily on their
// next request instead, so sessions still lapse when nobody is around.

const REFRESH_SKEW_MS = 60 * 1000; // refresh ~1 min before expiry
const ACTIVITY_WINDOW_MS = 15 * 60 * 1000; // "active" = interacted in last 15 min
const INACTIVE_RECHECK_MS = 60 * 1000; // re-check cadence while idle
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

  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();

  // No tokens means the user is signed out — stop the loop.
  if (!accessToken || !refreshToken) return;

  const isActive = Date.now() - lastActivityAt <= ACTIVITY_WINDOW_MS;

  if (isActive) {
    try {
      await refreshOnce();
    } catch {
      // Session is no longer valid; the next authed request / route guard
      // will surface the sign-in requirement. Stop scheduling here.
      return;
    }

    // refreshAccessToken() re-arms the timer against the fresh token.
    return;
  }

  // Idle: don't burn the session. Check again soon so that as soon as the
  // user returns and interacts we can refresh before their next action.
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(autoRefreshTick, INACTIVE_RECHECK_MS);
}

export function scheduleTokenRefresh() {
  if (typeof window === "undefined") return;

  clearTimeout(refreshTimer);
  refreshTimer = null;

  const accessToken = getAccessToken();
  if (!accessToken || !getRefreshToken()) return;

  const expiryMs = decodeJwtExpiryMs(accessToken);
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

  markActivity();
  scheduleTokenRefresh();
}

export function stopAuthAutoRefresh() {
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

// Authenticated fetch for non-JSON endpoints (file/blob downloads) that need
// the same expired-token handling as request(): attach the bearer token and,
// on a 401, silently refresh once and retry before giving up.
export async function authFetch(path, options = {}, _isRetry = false) {
  const accessToken = getAccessToken();
  const headers = { ...(options.headers || {}) };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
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
  { method = "GET", body, auth = false, cache, _isRetry = false } = {}
) {
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  const headers = {};

  // Let the browser set the multipart boundary for FormData uploads.
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const accessToken = getAccessToken();

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  let requestBody;
  if (body !== undefined && body !== null) {
    requestBody = isFormData ? body : JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: requestBody,
    ...(cache ? { cache } : {}),
  });

  // Access token likely expired — try to refresh once, then retry.
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

    return request(path, { method, body, auth, _isRetry: true });
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

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new ApiRequestError("No refresh token available", 401);
  }

  const data = await request("/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  });

  const payload = data?.data || {};

  setAuth({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
  });

  // Re-arm the proactive refresh against the freshly issued access token.
  scheduleTokenRefresh();

  return payload;
}

export async function logout() {
  const refreshToken = getRefreshToken();

  stopAuthAutoRefresh();

  if (refreshToken) {
    try {
      await request("/auth/logout", {
        method: "POST",
        body: { refreshToken },
      });
    } catch {
      // Clear local session even if backend logout fails.
    }
  }

  clearAuth();
}

export async function getCurrentUser() {
  const data = await request("/auth/me", { auth: true });
  return data?.data?.user || null;
}

export function saveAuthSession(payload) {
  setAuth({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
  });

  // Begin proactive silent refresh as soon as the session is established.
  startAuthAutoRefresh();
}
