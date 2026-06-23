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

  return payload;
}

export async function logout() {
  const refreshToken = getRefreshToken();

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
}
