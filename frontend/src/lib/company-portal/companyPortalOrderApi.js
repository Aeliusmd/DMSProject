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
    const refreshed = await tryRefreshCompanyAccessToken();
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

  if (options.expectBlob) {
    if (!response.ok) {
      const payload = await parseResponse(response);
      throw new ApiRequestError(
        payload?.message || "Request failed",
        response.status,
        payload?.errors || null
      );
    }
    return response.blob();
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

export async function uploadCompanyPortalSubpoena(file) {
  const formData = new FormData();
  formData.append("file", file);
  return companyAuthFetch("/company-portal/orders/upload-subpoena", {
    method: "POST",
    body: formData,
  });
}

export async function getCompanyPortalOrder(orderId) {
  return companyAuthFetch(`/company-portal/orders/${orderId}`, {
    method: "GET",
  });
}

export async function trackCompanyPortalOrder(orderNumber) {
  const encoded = encodeURIComponent(String(orderNumber || "").trim());
  return companyAuthFetch(`/company-portal/orders/track/${encoded}`, {
    method: "GET",
  });
}

export async function validateCompanyPortalOrderNumber(caseNumber) {
  return companyAuthFetch("/company-portal/orders/validate-order-number", {
    method: "POST",
    body: JSON.stringify({ caseNumber }),
  });
}

export async function createCompanyPortalCheckout(payload = {}) {
  return companyAuthFetch(`/company-portal/orders/checkout`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function confirmCompanyPortalPayment(sessionId) {
  return companyAuthFetch(`/company-portal/orders/confirm-payment`, {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function payCompanyPortalInvoice(orderNumber, { invoiceType, paymentMethod }) {
  const encoded = encodeURIComponent(String(orderNumber || "").trim());
  const payload = await companyAuthFetch(
    `/company-portal/orders/track/${encoded}/invoices/pay`,
    {
      method: "POST",
      body: JSON.stringify({ invoiceType, paymentMethod }),
    }
  );

  return payload?.data || null;
}

export async function confirmCompanyPortalInvoicePayment(orderNumber, sessionId) {
  const encoded = encodeURIComponent(String(orderNumber || "").trim());
  return companyAuthFetch(
    `/company-portal/orders/track/${encoded}/invoices/confirm`,
    {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    }
  );
}

export async function fetchCompanyPortalSubpoenaBlob(orderId) {
  return companyAuthFetch(`/company-portal/orders/${orderId}/subpoena`, {
    method: "GET",
    expectBlob: true,
  });
}

export async function fetchCompanyPortalReleasedDocumentsBlob(orderId) {
  return companyAuthFetch(`/company-portal/orders/${orderId}/documents`, {
    method: "GET",
    expectBlob: true,
  });
}

export async function fetchCompanyPortalPaymentReceiptBlob(orderId) {
  return companyAuthFetch(`/company-portal/orders/${orderId}/payment-receipt`, {
    method: "GET",
    expectBlob: true,
  });
}

export async function getCompanyPortalDashboard() {
  return companyAuthFetch(`/company-portal/dashboard`, {
    method: "GET",
  });
}

export async function listCompanyPortalOrders({
  limit = 20,
  pagination = null,
  cursor = null,
  pageSize = 10,
} = {}) {
  const params = new URLSearchParams();

  if (pagination) {
    params.set("pagination", String(pagination));
  }
  if (cursor) {
    params.set("cursor", String(cursor));
  }
  if (pageSize) {
    params.set("pageSize", String(pageSize));
  }
  if (!pagination && limit) {
    params.set("limit", String(limit));
  }

  const query = params.toString();
  return companyAuthFetch(`/company-portal/orders${query ? `?${query}` : ""}`, {
    method: "GET",
  });
}

export function downloadBlobAsFile(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const WIZARD_STORAGE_KEY = "dms_company_order_wizard";

export function saveCompanyOrderWizardState(state) {
  try {
    sessionStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures.
  }
}

export function loadCompanyOrderWizardState() {
  try {
    const raw = sessionStorage.getItem(WIZARD_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearCompanyOrderWizardState() {
  try {
    sessionStorage.removeItem(WIZARD_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export const COMPANY_PORTAL_ORDER_FEE = 15;
export const COMPANY_PORTAL_FACILITY_SEARCH_FEE = 5;
