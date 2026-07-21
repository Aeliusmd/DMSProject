import { API_BASE_URL } from "@/config/api";
import {
  isNetworkError,
  NETWORK_UNAVAILABLE_MESSAGE,
} from "@/lib/networkErrors";
import { withCredentials } from "@/lib/auth/fetchCredentials";
import { ApiRequestError } from "@/lib/auth/authApi";
import {
  clearPersonalAuth,
  getPersonalAccessExpiresAt,
  getStoredPersonalUser,
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
    return await fetch(url, withCredentials(options));
  } catch (error) {
    if (isNetworkError(error)) {
      throw new ApiRequestError(NETWORK_UNAVAILABLE_MESSAGE, 0);
    }
    throw error;
  }
}

async function refreshPersonalAccessToken() {
  try {
    const payload = await request("/personal-portal/auth/refresh", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const data = payload?.data || {};
    setPersonalAuth({
      user: data.user,
      accessExpiresAt: data.accessExpiresAt,
    });
    return true;
  } catch {
    clearPersonalAuth();
    return false;
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

async function authFetch(path, options = {}, retried = false) {
  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  let response = await safeFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !retried) {
    const refreshed = await refreshPersonalAccessToken();
    if (refreshed) {
      return authFetch(path, options, true);
    }

    clearPersonalAuth();
    throw new ApiRequestError("Session expired. Please sign in again.", 401);
  }

  return response;
}

async function authRequest(path, options = {}) {
  const response = await authFetch(path, options);
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

async function authBlobOrJson(path, options = {}) {
  const response = await authFetch(path, options);
  const contentType = `${response.headers.get("content-type") || ""}`.toLowerCase();

  if (!response.ok) {
    const payload = await parseResponse(response);
    throw new ApiRequestError(
      payload?.message || "Request failed",
      response.status,
      payload?.errors || null
    );
  }

  if (contentType.includes("application/pdf") || contentType.includes("octet-stream")) {
    return {
      kind: "blob",
      blob: await response.blob(),
      fileName: parseContentDispositionFileName(
        response.headers.get("content-disposition")
      ),
    };
  }

  const payload = await parseResponse(response);
  return { kind: "json", payload };
}

function parseContentDispositionFileName(headerValue) {
  const header = `${headerValue || ""}`;
  if (!header) return null;

  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].trim().replace(/"/g, ""));
    } catch {
      return utfMatch[1].trim().replace(/"/g, "");
    }
  }

  const plainMatch = header.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    try {
      return decodeURIComponent(plainMatch[1].trim());
    } catch {
      return plainMatch[1].trim();
    }
  }

  return null;
}

function sanitizeReceiptFileNamePart(value, fallback = "Order") {
  const cleaned = `${value || ""}`
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+|\.+$/g, "");
  return cleaned || fallback;
}

function buildReceiptDownloadFileName(orderNo, kind) {
  const safeOrder = sanitizeReceiptFileNamePart(orderNo, "Order");
  const safeKind = kind === "invoice" ? "Invoice" : "Prepayment";
  return `${safeOrder}-${safeKind}.pdf`;
}

function openBlobInNewTab(blob) {
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function downloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename || "receipt.pdf";
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

/** Only open https URLs to avoid javascript: XSS via receipt links. */
function openSafeExternalUrl(url) {
  const trimmed = `${url || ""}`.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") {
      return false;
    }
    window.open(parsed.href, "_blank", "noopener,noreferrer");
    return true;
  } catch {
    return false;
  }
}

async function deliverReceiptResult(result, { mode = "view", filename } = {}) {
  if (result.kind === "blob") {
    if (mode === "download") {
      downloadBlob(result.blob, result.fileName || filename);
    } else {
      openBlobInNewTab(result.blob);
    }
    return true;
  }

  const url = result.payload?.data?.url || result.payload?.url;
  if (!url) return false;

  // Stripe hosted pages cannot be force-downloaded cross-origin.
  // View mode may open them; download mode should use PDF endpoints instead.
  if (mode === "download") {
    return false;
  }

  if (!openSafeExternalUrl(url)) {
    throw new ApiRequestError("Invalid receipt URL", 400);
  }
  return true;
}

function withDownloadQuery(path, mode) {
  if (mode !== "download") return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}download=1`;
}

async function deliverReceiptFromEndpoints(
  endpoints,
  { mode = "view", filename, fallbackUrl, notFoundMessage } = {}
) {
  // Download must always go through authenticated PDF endpoints.
  if (mode === "view" && fallbackUrl) {
    if (!openSafeExternalUrl(fallbackUrl)) {
      throw new ApiRequestError("Invalid receipt URL", 400);
    }
    return;
  }

  let lastError = null;
  for (const path of endpoints) {
    try {
      const result = await authBlobOrJson(withDownloadQuery(path, mode), {
        method: "GET",
      });
      const delivered = await deliverReceiptResult(result, { mode, filename });
      if (delivered) return;
    } catch (err) {
      if (err instanceof ApiRequestError && err.message === "Invalid receipt URL") {
        throw err;
      }
      lastError = err;
    }
  }

  if (lastError) throw lastError;
  throw new ApiRequestError(notFoundMessage || "Receipt not available", 404);
}

export async function registerPersonal(payload) {
  return request("/personal-portal/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginPersonal({ email }) {
  return request("/personal-portal/auth/login", {
    method: "POST",
    body: JSON.stringify({ email }),
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
    user: payload.user,
    accessExpiresAt: payload.accessExpiresAt,
  });
}

export async function logoutPersonal() {
  try {
    await request("/personal-portal/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
    });
  } catch {
    // Always clear local session
  } finally {
    clearPersonalAuth();
  }
}

export async function getPersonalCurrentUser() {
  const payload = await authRequest("/personal-portal/auth/me", { method: "GET" });
  const user = payload?.data?.user;
  if (user) {
    setPersonalAuth({ user });
  }
  return payload;
}

export async function updatePersonalAccountEmail(email) {
  return authRequest("/personal-portal/auth/email", {
    method: "PATCH",
    body: JSON.stringify({ email }),
  });
}

export async function getPersonalDashboard() {
  return authRequest("/personal-portal/dashboard", { method: "GET" });
}

export async function listPersonalRequests({
  pageSize = 10,
  cursor = null,
  status = "",
  search = "",
} = {}) {
  const params = new URLSearchParams();
  params.set("pagination", "keyset");
  params.set("pageSize", String(pageSize));
  if (cursor) params.set("cursor", String(cursor));
  if (status) params.set("status", status);
  if (search) params.set("search", String(search).slice(0, 200));

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

export async function createPersonalResearchFeeCheckout(requestId) {
  return authRequest(`/personal-portal/requests/${requestId}/research-fee/checkout`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fulfillPersonalResearchFeeCheckout(sessionId) {
  return authRequest("/personal-portal/research-fee/fulfill", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function fulfillPersonalCheckout(sessionId) {
  return authRequest("/personal-portal/checkout/fulfill", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export async function createPersonalInvoiceCheckout(requestId) {
  return authRequest(`/personal-portal/requests/${requestId}/invoice/checkout`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/** View or download Stripe receipt / PDF for the $35 prepayment. */
export async function openPersonalPrepaymentReceipt(
  requestId,
  fallbackUrl,
  { mode = "view", orderNo = "" } = {}
) {
  return deliverReceiptFromEndpoints(
    [`/personal-portal/requests/${requestId}/prepayment-receipt`],
    {
      mode,
      filename: buildReceiptDownloadFileName(orderNo || requestId, "prepayment"),
      fallbackUrl,
      notFoundMessage: "Prepayment receipt not available",
    }
  );
}

/** View or download Stripe facility search fee receipt. */
export async function openPersonalFacilityFeeReceipt(
  requestId,
  fallbackUrl,
  { mode = "view", orderNo = "" } = {}
) {
  return deliverReceiptFromEndpoints(
    [`/personal-portal/requests/${requestId}/facility-fee-receipt`],
    {
      mode,
      filename: buildReceiptDownloadFileName(orderNo || requestId, "invoice"),
      fallbackUrl,
      notFoundMessage: "Facility fee receipt not available",
    }
  );
}

/** View or download Stripe invoice / facility-fee payment receipt. */
export async function openPersonalInvoiceReceipt(
  requestId,
  fallbackUrl,
  { mode = "view", orderNo = "" } = {}
) {
  return deliverReceiptFromEndpoints(
    [
      `/personal-portal/requests/${requestId}/invoice-receipt`,
      `/personal-portal/requests/${requestId}/facility-fee-receipt`,
    ],
    {
      mode,
      filename: buildReceiptDownloadFileName(orderNo || requestId, "invoice"),
      fallbackUrl,
      notFoundMessage: "Invoice receipt not available",
    }
  );
}

export { getPersonalAccessExpiresAt, getStoredPersonalUser };
