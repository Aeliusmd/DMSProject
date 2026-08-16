import { API_BASE_URL } from "@/config/api";
import { ApiRequestError } from "@/lib/auth/authApi";
import { withCredentials } from "@/lib/auth/fetchCredentials";
import {
  isNetworkError,
  NETWORK_UNAVAILABLE_MESSAGE,
} from "@/lib/networkErrors";
import { tryRefreshCompanyAccessToken } from "./companyPortalAuthApi";
import { clearCompanyAuth } from "./companyPortalAuthStorage";

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

export async function companyPortalFetch(path, options = {}, retried = false) {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  let response = await safeFetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !retried) {
    const refreshed = await tryRefreshCompanyAccessToken();
    if (refreshed) {
      return companyPortalFetch(path, options, true);
    }

    clearCompanyAuth();
    throw new ApiRequestError("Session expired. Please sign in again.", 401);
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
