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

async function authFetch(path, options = {}) {
  const accessToken = getPersonalAccessToken();
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
    const refreshed = await refreshPersonalAccessToken();
    if (refreshed) {
      const retryToken = getPersonalAccessToken();
      response = await safeFetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          ...(options.body instanceof FormData
            ? {}
            : { "Content-Type": "application/json" }),
          ...(retryToken ? { Authorization: `Bearer ${retryToken}` } : {}),
          ...(options.headers || {}),
        },
      });
    } else {
      clearPersonalAuth();
      throw new ApiRequestError("Session expired. Please sign in again.", 401);
    }
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
    return { kind: "blob", blob: await response.blob() };
  }

  const payload = await parseResponse(response);
  return { kind: "json", payload };
}

function openBlobInNewTab(blob) {
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
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

/** Opens Stripe receipt or generated PDF for the $35 prepayment. */
export async function openPersonalPrepaymentReceipt(requestId, fallbackUrl) {
  if (fallbackUrl) {
    if (!openSafeExternalUrl(fallbackUrl)) {
      throw new ApiRequestError("Invalid receipt URL", 400);
    }
    return;
  }

  const result = await authBlobOrJson(
    `/personal-portal/requests/${requestId}/prepayment-receipt`,
    { method: "GET" }
  );

  if (result.kind === "blob") {
    openBlobInNewTab(result.blob);
    return;
  }

  const url = result.payload?.data?.url || result.payload?.url;
  if (url) {
    if (!openSafeExternalUrl(url)) {
      throw new ApiRequestError("Invalid receipt URL", 400);
    }
    return;
  }

  throw new ApiRequestError("Prepayment receipt not available", 404);
}

/** Opens Stripe facility search fee receipt. */
export async function openPersonalFacilityFeeReceipt(requestId, fallbackUrl) {
  if (fallbackUrl) {
    if (!openSafeExternalUrl(fallbackUrl)) {
      throw new ApiRequestError("Invalid receipt URL", 400);
    }
    return;
  }

  const result = await authBlobOrJson(
    `/personal-portal/requests/${requestId}/facility-fee-receipt`,
    { method: "GET" }
  );

  if (result.kind === "blob") {
    openBlobInNewTab(result.blob);
    return;
  }

  const url = result.payload?.data?.url || result.payload?.url;
  if (url) {
    if (!openSafeExternalUrl(url)) {
      throw new ApiRequestError("Invalid receipt URL", 400);
    }
    return;
  }

  throw new ApiRequestError("Facility fee receipt not available", 404);
}

/** Opens Stripe invoice / facility-fee payment receipt (URL or generated PDF). */
export async function openPersonalInvoiceReceipt(requestId, fallbackUrl) {
  if (fallbackUrl) {
    if (!openSafeExternalUrl(fallbackUrl)) {
      throw new ApiRequestError("Invalid receipt URL", 400);
    }
    return;
  }

  try {
    const result = await authBlobOrJson(
      `/personal-portal/requests/${requestId}/invoice-receipt`,
      { method: "GET" }
    );

    if (result.kind === "blob") {
      openBlobInNewTab(result.blob);
      return;
    }

    const url = result.payload?.data?.url || result.payload?.url;
    if (url) {
      if (!openSafeExternalUrl(url)) {
        throw new ApiRequestError("Invalid receipt URL", 400);
      }
      return;
    }
  } catch (err) {
    if (err instanceof ApiRequestError && err.message === "Invalid receipt URL") {
      throw err;
    }
    // Fall through to facility-fee receipt (same UI label)
  }

  const facilityResult = await authBlobOrJson(
    `/personal-portal/requests/${requestId}/facility-fee-receipt`,
    { method: "GET" }
  );

  if (facilityResult.kind === "blob") {
    openBlobInNewTab(facilityResult.blob);
    return;
  }

  const facilityUrl =
    facilityResult.payload?.data?.url || facilityResult.payload?.url;
  if (facilityUrl) {
    if (!openSafeExternalUrl(facilityUrl)) {
      throw new ApiRequestError("Invalid receipt URL", 400);
    }
    return;
  }

  throw new ApiRequestError("Invoice receipt not available", 404);
}
