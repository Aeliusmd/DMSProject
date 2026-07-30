const configuredApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api";

function normalizeApiBaseUrl(value) {
  const baseUrl = `${value || ""}`.trim().replace(/\/+$/, "");

  if (/^https?:\/\//i.test(baseUrl)) {
    const url = new URL(baseUrl);

    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/api";
    }

    return url.toString().replace(/\/+$/, "");
  }

  return baseUrl || "/api";
}

export const API_BASE_URL = normalizeApiBaseUrl(configuredApiBaseUrl);