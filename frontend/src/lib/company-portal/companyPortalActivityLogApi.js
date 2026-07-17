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

async function activityLogRequest(path, options = {}) {
  const accessToken = getCompanyAccessToken();

  let response = await safeFetch(`${API_BASE_URL}${path}`, {
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
      response = await safeFetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(retryToken ? { Authorization: `Bearer ${retryToken}` } : {}),
          ...(options.headers || {}),
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

function buildActivityLogQuery(filters = {}) {
  const params = new URLSearchParams();

  if (filters.module && filters.module !== "All Modules") {
    params.set("module", filters.module);
  }
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.employeeId) params.set("employeeId", String(filters.employeeId));
  if (filters.actorType && filters.actorType !== "all") {
    params.set("actorType", filters.actorType);
  }
  if (filters.pagination) params.set("pagination", String(filters.pagination));
  if (filters.cursor != null && `${filters.cursor}`.trim() !== "") {
    params.set("cursor", String(filters.cursor));
  }
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function getCompanyPortalActivityLogsPaginated(filters = {}) {
  const data = await activityLogRequest(
    `/company-portal/activity-log${buildActivityLogQuery({
      ...filters,
      pagination: "keyset",
    })}`,
    { method: "GET" }
  );

  const payload = data?.data;
  if (payload?.pagination) {
    return {
      logs: payload.logs || [],
      pagination: payload.pagination,
    };
  }

  return {
    logs: Array.isArray(payload?.logs)
      ? payload.logs
      : Array.isArray(payload)
        ? payload
        : [],
    pagination: {
      pageSize: Number(filters.pageSize) || 10,
      hasMore: false,
      nextCursor: null,
    },
  };
}
