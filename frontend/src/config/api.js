const configuredApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

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

/** Same-origin `/api` is proxied to the Express backend via next.config rewrites. */
export const API_BASE_URL = normalizeApiBaseUrl(configuredApiBaseUrl);
