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
    const refreshed = await refreshCompanyAccessToken();
    if (refreshed) {
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

    clearCompanyAuth();
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

export async function registerCompany(payload) {
  return request("/company-portal/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginCompany({ email }) {
  return request("/company-portal/auth/login", {
    method: "POST",
    body: JSON.stringify({ email }),
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
  if (!refreshToken) return false;

  try {
    const response = await request("/company-portal/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });

    const payload = response?.data || {};
    setCompanyAuth({
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken || refreshToken,
      user: payload.user,
    });
    return true;
  } catch {
    clearCompanyAuth();
    return false;
  }
}

export async function logoutCompany() {
  const refreshToken = getCompanyRefreshToken();

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
  return authRequest("/company-portal/auth/me", { method: "GET" });
}

export function saveCompanyAuthSession(payload) {
  setCompanyAuth(payload);
}
