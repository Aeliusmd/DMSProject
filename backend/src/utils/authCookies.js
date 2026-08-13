const jwt = require("jsonwebtoken");
const config = require("../config");

const PORTAL_COOKIES = {
  internal: {
    access: "dms_access",
    refresh: "dms_refresh",
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

function getCookieBaseOptions() {
  return {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
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

  return {
    ...rest,
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

function getBearerTokenFromHeader(req) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

function getAccessTokenFromRequest(req, portal) {
  const names = PORTAL_COOKIES[portal];
  if (!names) return getBearerTokenFromHeader(req);

  return req.cookies?.[names.access] || getBearerTokenFromHeader(req);
}

function getRefreshTokenFromRequest(req, portal) {
  const names = PORTAL_COOKIES[portal];
  const cookieToken = names ? req.cookies?.[names.refresh] : null;
  const bodyToken = req.body?.refreshToken;

  return cookieToken || (typeof bodyToken === "string" ? bodyToken.trim() : "") || null;
}

module.exports = {
  PORTAL_COOKIES,
  buildAuthPayload,
  setPortalAuthCookies,
  clearPortalAuthCookies,
  getAccessTokenFromRequest,
  getRefreshTokenFromRequest,
  getAccessExpiresAt,
};
