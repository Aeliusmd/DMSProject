import { API_BASE_URL } from "@/config/api";
import { ApiRequestError } from "@/lib/auth/authApi";
import {
  isNetworkError,
  NETWORK_UNAVAILABLE_MESSAGE,
} from "@/lib/networkErrors";
import {
  clearCompanyAuth,
  getCompanyAccessToken,
} from "./companyPortalAuthStorage";
import { tryRefreshCompanyAccessToken } from "./companyPortalAuthApi";

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

async function managementRequest(path, options = {}) {
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
    const refreshed = await tryRefreshCompanyAccessToken();
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

export async function listCompanyEmployees(search = "") {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const query = params.toString();
  return managementRequest(
    `/company-portal/employees${query ? `?${query}` : ""}`,
    { method: "GET" }
  );
}

export async function listCompanyEmployeesPaginated({
  search = "",
  cursor = null,
  pageSize = 10,
} = {}) {
  const params = new URLSearchParams();
  params.set("pagination", "keyset");
  params.set("pageSize", String(pageSize));
  if (search) params.set("search", search);
  if (cursor) params.set("cursor", String(cursor));
  return managementRequest(`/company-portal/employees?${params.toString()}`, {
    method: "GET",
  });
}

export async function createCompanyEmployee(payload) {
  return managementRequest("/company-portal/employees", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCompanyWalletSummary() {
  return managementRequest("/company-portal/wallet", { method: "GET" });
}

export async function listCompanyWalletTransactions({
  cursor = null,
  pageSize = 10,
} = {}) {
  const params = new URLSearchParams();
  params.set("pageSize", String(pageSize));
  if (cursor) params.set("cursor", String(cursor));
  return managementRequest(
    `/company-portal/wallet/transactions?${params.toString()}`,
    { method: "GET" }
  );
}

export async function createCompanyWalletTopup(amount) {
  return managementRequest("/company-portal/wallet/topup", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function confirmCompanyWalletTopup(sessionId) {
  return managementRequest("/company-portal/wallet/confirm-topup", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function allocateCompanyWalletFunds({ employeeId, amount }) {
  return managementRequest("/company-portal/wallet/allocate", {
    method: "POST",
    body: JSON.stringify({ employeeId, amount }),
  });
}

export function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
