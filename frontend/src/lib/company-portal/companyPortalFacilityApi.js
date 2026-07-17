import { API_BASE_URL } from "@/config/api";
import { ApiRequestError } from "@/lib/auth/authApi";
import {
  isNetworkError,
  NETWORK_UNAVAILABLE_MESSAGE,
} from "@/lib/networkErrors";
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

async function refreshCompanyAccessToken() {
  const refreshToken = getCompanyRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await safeFetch(
      `${API_BASE_URL}/company-portal/auth/refresh`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      }
    );
    const payload = await parseResponse(response);
    if (!response.ok) {
      clearCompanyAuth();
      return false;
    }

    const data = payload?.data || {};
    setCompanyAuth({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken || refreshToken,
      user: data.user,
    });
    return true;
  } catch {
    clearCompanyAuth();
    return false;
  }
}

async function companyAuthFetch(path, options = {}) {
  const accessToken = getCompanyAccessToken();
  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers || {}),
  };

  let response = await safeFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    const refreshed = await refreshCompanyAccessToken();
    if (refreshed) {
      const retryToken = getCompanyAccessToken();
      response = await safeFetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          ...headers,
          ...(retryToken ? { Authorization: `Bearer ${retryToken}` } : {}),
        },
      });
    } else {
      clearCompanyAuth();
      throw new ApiRequestError("Session expired. Please sign in again.", 401);
    }
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

export async function searchCompanyPortalFacilities(query) {
  const params = new URLSearchParams();
  params.set("q", `${query || ""}`.trim());
  const payload = await companyAuthFetch(
    `/company-portal/facilities/search?${params.toString()}`,
    { method: "GET" }
  );
  return payload?.data?.facilities || [];
}
