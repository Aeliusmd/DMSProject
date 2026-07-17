export const PORTAL_NAVIGATION_HIDDEN = false;

export const PORTAL_ROUTE_REDIRECT = "/login";

const BLOCKED_ROUTE_PREFIXES = [
  "/landingpage",
  "/company-portal",
  "/personalrequest",
  "/Subpoenaupload",
];

const ALLOWED_ROUTE_PREFIXES_WHEN_HIDDEN = [
  "/personalrequest/download",
  "/download/records",
  "/pay",
];

export function isPortalRouteAllowedWhenHidden(pathname = "") {
  const normalizedPath = `${pathname || ""}`.split("?")[0] || "/";

  return ALLOWED_ROUTE_PREFIXES_WHEN_HIDDEN.some(
    (prefix) =>
      normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  );
}

export function isPortalRouteBlocked(pathname = "") {
  if (!PORTAL_NAVIGATION_HIDDEN) {
    return false;
  }

  const normalizedPath = `${pathname || ""}`.split("?")[0] || "/";

  if (isPortalRouteAllowedWhenHidden(normalizedPath)) {
    return false;
  }

  return BLOCKED_ROUTE_PREFIXES.some(
    (prefix) =>
      normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  );
}
