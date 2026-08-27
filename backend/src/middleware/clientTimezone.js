const { resolveTimezone, DEFAULT_TIMEZONE } = require("../utils/timezoneUtils");
const config = require("../config");

function clientTimezoneMiddleware(req, _res, next) {
  const headerTimezone =
    req.headers["x-client-timezone"] || req.headers["x-timezone"];

  req.clientTimezone = resolveTimezone(
    headerTimezone || config.businessTimezone || DEFAULT_TIMEZONE
  );

  next();
}

module.exports = clientTimezoneMiddleware;
