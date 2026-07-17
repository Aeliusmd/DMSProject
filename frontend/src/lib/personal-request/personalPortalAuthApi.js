import { API_BASE_URL } from "@/config/api";
import {
  isNetworkError,
  NETWORK_UNAVAILABLE_MESSAGE,
} from "@/lib/networkErrors";
import { ApiRequestError } from "@/lib/auth/authApi";
import {
  clearPersonalAuth,
  getPersonalAccessToken,
  getPersonalRefreshToken,
  getPersonalSessionToken,
  setPersonalAuth,
} from "./personalPortalAuthStorage";

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

async function refreshPersonalAccessToken() {
  const refreshToken = getPersonalRefreshToken();
  if (!refreshToken) return false;

  try {
    const payload = await request("/personal-portal/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });

    const data = payload?.data || {};
    setPersonalAuth({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    });
    return true;
  } catch {
    clearPersonalAuth();
    return false;
  }
}

async function authRequest(path, options = {}) {
  const accessToken = getPersonalAccessToken();

  const response = await safeFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401) {
    const refreshed = await refreshPersonalAccessToken();
    if (refreshed) {
      const retryToken = getPersonalAccessToken();
      const retry = await safeFetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          ...(options.body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
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

    clearPersonalAuth();
    throw new ApiRequestError("Session expired. Please sign in again.", 401);
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

export async function registerPersonal(payload) {
  return request("/personal-portal/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginPersonal(payload) {
  return request("/personal-portal/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function verifyPersonalTwoFactor({
  sessionToken,
  code,
  trustDevice = false,
}) {
  return request("/personal-portal/auth/verify-2fa", {
    method: "POST",
    body: JSON.stringify({ sessionToken, code, trustDevice }),
  });
}

export async function resendPersonalTwoFactor(sessionToken) {
  return request("/personal-portal/auth/resend-2fa", {
    method: "POST",
    body: JSON.stringify({ sessionToken }),
  });
}

export function savePersonalAuthSession(payload) {
  setPersonalAuth({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
    sessionToken: payload.sessionToken,
  });
}

export async function logoutPersonal() {
  try {
    await request("/personal-portal/auth/logout", {
      method: "POST",
      body: JSON.stringify({
        refreshToken: getPersonalRefreshToken(),
        sessionToken: getPersonalSessionToken(),
      }),
    });
  } catch {
    // Always clear local session
  } finally {
    clearPersonalAuth();
  }
}

export async function getPersonalCurrentUser() {
  return authRequest("/personal-portal/auth/me", { method: "GET" });
}

export async function getPersonalDashboard() {
  return authRequest("/personal-portal/dashboard", { method: "GET" });
}

export async function listPersonalRequests({
  pageSize = 10,
  cursor = null,
  status = "",
} = {}) {
  const params = new URLSearchParams();
  params.set("pagination", "keyset");
  params.set("pageSize", String(pageSize));
  if (cursor) params.set("cursor", String(cursor));
  if (status) params.set("status", status);

  return authRequest(`/personal-portal/requests?${params.toString()}`, {
    method: "GET",
  });
}

export async function submitAuthenticatedPersonalRequest(formData) {
  return authRequest("/personal-portal/requests", {
    method: "POST",
    body: formData,
    headers: {},
  });
}
