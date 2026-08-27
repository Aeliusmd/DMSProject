import { API_BASE_URL } from "@/config/api";

import { getTimezoneRequestHeaders } from "@/lib/utils/timezoneUtils";

export const CREDENTIALS_INCLUDE = { credentials: "include" };

function shouldSkipNgrokWarning() {
  if (`${API_BASE_URL}`.includes("ngrok")) return true;
  if (typeof window !== "undefined" && window.location.hostname.includes("ngrok")) {
    return true;
  }
  return false;
}

export function withCredentials(options = {}) {
  const ngrokHeaders = shouldSkipNgrokWarning()
    ? { "ngrok-skip-browser-warning": "true" }
    : {};

  return {
    ...options,
    credentials: "include",
    headers: getTimezoneRequestHeaders({
      ...ngrokHeaders,
      ...(options?.headers || {}),
    }),
  };
}
