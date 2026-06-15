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

export async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (auth) {
    const accessToken = getAccessToken();

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

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
