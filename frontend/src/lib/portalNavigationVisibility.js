/**
 * Toggle visibility for company portal, personal request portal,
 * and staff Company/Personal Orders pages. Code stays in place — only hidden.
 *
 * Set to `false` to show everything again.
 */
export const PORTAL_NAVIGATION_HIDDEN = true;

/** Where external portal routes redirect when hidden. */
export const PORTAL_ROUTE_REDIRECT = "/login";

/** Where staff Company/Personal Orders redirect when hidden. */
export const STAFF_PORTAL_ORDERS_REDIRECT = "/orders";

const BLOCKED_ROUTE_PREFIXES = [
  "/landingpage",
  "/company-portal",
  "/personalrequest",
  "/Subpoenaupload",
  "/company-orders",
  "/personal-orders",
];

const STAFF_ORDER_ROUTE_PREFIXES = ["/company-orders", "/personal-orders"];

const ALLOWED_ROUTE_PREFIXES_WHEN_HIDDEN = [
  "/personalrequest/download",
  "/download/records",
  "/pay",
];

const HIDDEN_STAFF_NAV_HREFS = new Set(["/company-orders", "/personal-orders"]);

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

export function getBlockedRouteRedirect(pathname = "") {
  const normalizedPath = `${pathname || ""}`.split("?")[0] || "/";

  const isStaffOrderRoute = STAFF_ORDER_ROUTE_PREFIXES.some(
    (prefix) =>
      normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  );

  return isStaffOrderRoute
    ? STAFF_PORTAL_ORDERS_REDIRECT
    : PORTAL_ROUTE_REDIRECT;
}

/** Hide Company Orders / Personal Orders from the staff sidebar when flag is on. */
export function isStaffPortalOrdersNavHidden(href = "") {
  if (!PORTAL_NAVIGATION_HIDDEN) {
    return false;
  }

  return HIDDEN_STAFF_NAV_HREFS.has(`${href || ""}`.split("?")[0]);
}
