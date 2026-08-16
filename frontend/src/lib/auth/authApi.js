import { API_BASE_URL } from "@/config/api";
import {
  isNetworkError,
  NETWORK_UNAVAILABLE_MESSAGE,
} from "@/lib/networkErrors";
import { withCredentials } from "@/lib/auth/fetchCredentials";
import {
  clearAuth,
  getAccessExpiresAt,
  getStoredUser,
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

export async function authFetch(path, options = {}, _isRetry = false) {
  const response = await safeFetch(`${API_BASE_URL}${path}`, options);

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

  const headers = {};

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

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

export async function refreshAccessToken() {
  const data = await request("/auth/refresh", {
    method: "POST",
    body: {},
  });

  const payload = data?.data || {};

  setAuth({
    user: payload.user,
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
      body: {},
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
    accessExpiresAt: payload.accessExpiresAt,
  });

  startAuthAutoRefresh();
}
