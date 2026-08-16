import { API_BASE_URL } from "@/config/api";

export const CREDENTIALS_INCLUDE = { credentials: "include" };

function shouldSkipNgrokWarning() {
  if (`${API_BASE_URL}`.includes("ngrok")) return true;
  if (typeof window !== "undefined" && window.location.hostname.includes("ngrok")) {
    return true;
  }
  return false;
}

export function withCredentials(options = {}) {
  return {
    ...options,
    credentials: "include",
    headers: {
      ...(shouldSkipNgrokWarning()
        ? { "ngrok-skip-browser-warning": "true" }
        : {}),
      ...(options?.headers || {}),
    },
  };
}
