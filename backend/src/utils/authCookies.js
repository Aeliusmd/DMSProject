const jwt = require("jsonwebtoken");
const config = require("../config");

const PORTAL_COOKIES = {
  internal: {
    access: "dms_access",
    refresh: "dms_refresh",
    deviceTrust: "dms_device_trust",
  },
  company: {
    access: "dms_company_access",
    refresh: "dms_company_refresh",
  },
  personal: {
    access: "dms_personal_access",
    refresh: "dms_personal_refresh",
  },
};

function durationToMs(value, fallbackMs) {
  if (!value) return fallbackMs;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const match = String(value)
    .trim()
    .match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackMs;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return amount * multipliers[unit];
}

function isLocalHostname(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1"
  );
}

/**
 * Vercel (or any HTTPS frontend) calling a separate API host (ngrok/API)
 * is cross-site. Browsers only send those cookies with SameSite=None; Secure.
 * Localhost frontends talking to localhost APIs remain same-site (lax is fine).
 */
function needsCrossSiteCookies() {
  const forced = String(process.env.AUTH_COOKIE_CROSS_SITE || "")
    .trim()
    .toLowerCase();
  if (forced === "true" || forced === "1") return true;
  if (forced === "false" || forced === "0") return false;

  try {
    const client = new URL(config.clientUrl);
    return client.protocol === "https:" && !isLocalHostname(client.hostname);
  } catch {
    return false;
  }
}

function getCookieBaseOptions() {
  const crossSite = needsCrossSiteCookies();

  return {
    httpOnly: true,
    secure: crossSite || config.nodeEnv === "production",
    sameSite: crossSite ? "none" : "lax",
    // CHIPS: helps some Chromium browsers keep cross-site auth cookies.
    ...(crossSite ? { partitioned: true } : {}),
    path: "/api",
  };
}

function getAccessExpiresAt(accessToken) {
  if (!accessToken) return null;

  try {
    const decoded = jwt.decode(accessToken);
    return typeof decoded?.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function buildAuthPayload(result = {}) {
  const accessExpiresAt = getAccessExpiresAt(result.accessToken);
  const { accessToken, refreshToken, ...rest } = result;

  // Include tokens in JSON so cross-origin clients (e.g. Vercel → ngrok) can
  // authenticate with Authorization headers when third-party cookies are blocked.
  return {
    ...rest,
    ...(accessToken ? { accessToken } : {}),
    ...(refreshToken ? { refreshToken } : {}),
    ...(accessExpiresAt ? { accessExpiresAt } : {}),
  };
}

function setPortalAuthCookies(res, portal, { accessToken, refreshToken } = {}) {
  if (!accessToken || !refreshToken) return;

  const names = PORTAL_COOKIES[portal];
  if (!names) return;

  const accessMaxAge = durationToMs(config.jwt.accessExpiresIn, 15 * 60 * 1000);
  const refreshMaxAge = durationToMs(config.jwt.refreshExpiresIn, 7 * 24 * 60 * 60 * 1000);

  res.cookie(names.access, accessToken, {
    ...getCookieBaseOptions(),
    maxAge: accessMaxAge,
  });

  res.cookie(names.refresh, refreshToken, {
    ...getCookieBaseOptions(),
    maxAge: refreshMaxAge,
  });
}

function clearPortalAuthCookies(res, portal) {
  const names = PORTAL_COOKIES[portal];
  if (!names) return;

  const options = getCookieBaseOptions();
  res.clearCookie(names.access, options);
  res.clearCookie(names.refresh, options);
}

function getDeviceTrustTokenFromRequest(req) {
  const cookieToken = req.cookies?.[PORTAL_COOKIES.internal.deviceTrust] || "";
  const bodyToken =
    typeof req.body?.deviceTrustToken === "string"
      ? req.body.deviceTrustToken.trim()
      : "";

  return bodyToken || cookieToken || null;
}

function setDeviceTrustCookie(res, deviceTrustToken, expiresAt) {
  if (!deviceTrustToken) return;

  const maxAge = Math.max(
    0,
    new Date(expiresAt).getTime() - Date.now()
  );

  if (!maxAge) return;

  res.cookie(PORTAL_COOKIES.internal.deviceTrust, deviceTrustToken, {
    ...getCookieBaseOptions(),
    maxAge,
  });
}

function clearDeviceTrustCookie(res) {
  res.clearCookie(PORTAL_COOKIES.internal.deviceTrust, getCookieBaseOptions());
}

function getBearerTokenFromHeader(req) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

function getAccessTokenFromRequest(req, portal) {
  const names = PORTAL_COOKIES[portal];
  const bearer = getBearerTokenFromHeader(req);

  if (!names) return bearer;

  // Prefer explicit Bearer tokens. Cross-origin clients (Vercel → ngrok) may
  // still send a stale third-party cookie that would otherwise win and 401.
  return bearer || req.cookies?.[names.access] || null;
}

function getRefreshTokenFromRequest(req, portal) {
  const names = PORTAL_COOKIES[portal];
  const cookieToken = names ? req.cookies?.[names.refresh] : null;
  const bodyToken =
    typeof req.body?.refreshToken === "string"
      ? req.body.refreshToken.trim()
      : "";

  // Prefer body token from cross-origin clients over a possibly stale cookie.
  return bodyToken || cookieToken || null;
}

module.exports = {
  PORTAL_COOKIES,
  buildAuthPayload,
  setPortalAuthCookies,
  clearPortalAuthCookies,
  getDeviceTrustTokenFromRequest,
  setDeviceTrustCookie,
  clearDeviceTrustCookie,
  getAccessTokenFromRequest,
  getRefreshTokenFromRequest,
  getAccessExpiresAt,
};
