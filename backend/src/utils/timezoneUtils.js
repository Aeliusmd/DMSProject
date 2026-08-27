/**
 * Timezone utilities — store instants in UTC (MySQL DATETIME + UTC session).
 * Calendar dates (YYYY-MM-DD) are never shifted.
 */

const DEFAULT_TIMEZONE = "UTC";

function resolveTimezone(timeZone) {
  const candidate = String(timeZone || "").trim();
  if (!candidate) return DEFAULT_TIMEZONE;

  try {
    Intl.DateTimeFormat(undefined, { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function isCalendarDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function getZonedParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: resolveTimezone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const read = (type) =>
    Number(parts.find((part) => part.type === type)?.value || 0);

  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function zonedLocalToUtcMs(localParts, timeZone) {
  const zone = resolveTimezone(timeZone);
  let utcMs = Date.UTC(
    localParts.year,
    localParts.month - 1,
    localParts.day,
    localParts.hour,
    localParts.minute,
    localParts.second
  );

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const zoned = getZonedParts(new Date(utcMs), zone);
    const targetMs = Date.UTC(
      localParts.year,
      localParts.month - 1,
      localParts.day,
      localParts.hour,
      localParts.minute,
      localParts.second
    );
    const actualMs = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second
    );
    const deltaMs = actualMs - targetMs;
    if (deltaMs === 0) break;
    utcMs -= deltaMs;
  }

  return utcMs;
}

function parseLocalInstantString(value, timeZone) {
  if (!value) return null;

  const normalized = String(value).trim().replace(" ", "T");
  const match = normalized.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
  );

  if (!match) return null;

  const [, datePart, hour, minute, second = "00"] = match;
  const [year, month, day] = datePart.split("-").map(Number);

  const utcMs = zonedLocalToUtcMs(
    {
      year,
      month,
      day,
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second),
    },
    timeZone
  );

  const date = new Date(utcMs);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** User-selected datetime in their timezone → UTC Date. */
function localInstantToUtc(value, timeZone = DEFAULT_TIMEZONE) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const trimmed = String(value || "").trim();
  if (!trimmed) return null;

  if (isCalendarDateString(trimmed)) {
    return null;
  }

  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return parseLocalInstantString(trimmed, timeZone);
}

function parseUtcInstant(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  if (isCalendarDateString(trimmed)) {
    return new Date(`${trimmed}T00:00:00.000Z`);
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(trimmed)) {
    return new Date(`${trimmed.replace(" ", "T")}Z`);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toUtcIso(value) {
  const date = parseUtcInstant(value);
  return date ? date.toISOString() : null;
}

function toMysqlUtcDateTime(value) {
  const date = value instanceof Date ? value : parseUtcInstant(value);
  if (!date || Number.isNaN(date.getTime())) return null;

  const ms = String(date.getUTCMilliseconds()).padStart(3, "0");

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${ms}`;
}

function splitUtcInstant(value = new Date()) {
  const date = value instanceof Date ? value : parseUtcInstant(value);
  if (!date || Number.isNaN(date.getTime())) {
    return { date: "", time: "" };
  }

  return {
    date: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    time: `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`,
  };
}

function loggedAtFromParts(logDate, logTime) {
  const datePart = normalizeCalendarDate(logDate);
  if (!datePart) return null;

  const timeRaw = String(logTime || "00:00:00").trim();
  const timeMatch = timeRaw.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
  const timePart = timeMatch
    ? `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3] || "00"}`
    : "00:00:00";

  return `${datePart}T${timePart}.000Z`;
}

function normalizeCalendarDate(value) {
  if (!value) return "";

  if (isCalendarDateString(value)) {
    return String(value).trim();
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }

  const isoMatch = String(value).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return isoMatch ? isoMatch[1] : "";
}

/** Calendar "today" in a timezone as YYYY-MM-DD. */
function calendarTodayInTimezone(timeZone = DEFAULT_TIMEZONE) {
  const parts = getZonedParts(new Date(), resolveTimezone(timeZone));
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Start of a calendar day in `timeZone`, as a UTC Date. */
function startOfCalendarDayUtc(calendarDate, timeZone = DEFAULT_TIMEZONE) {
  const day = normalizeCalendarDate(calendarDate) || calendarTodayInTimezone(timeZone);
  return localInstantToUtc(`${day}T00:00:00`, timeZone);
}

/** End of a calendar day in `timeZone`, as a UTC Date. */
function endOfCalendarDayUtc(calendarDate, timeZone = DEFAULT_TIMEZONE) {
  const day = normalizeCalendarDate(calendarDate) || calendarTodayInTimezone(timeZone);
  return localInstantToUtc(`${day}T23:59:59`, timeZone);
}

/** Inclusive end of "today" in `timeZone`, as UTC Date (for due-through queries). */
function endOfTodayUtc(timeZone = DEFAULT_TIMEZONE) {
  return endOfCalendarDayUtc(calendarTodayInTimezone(timeZone), timeZone);
}

/** Format UTC instant for API consumers that still expect a display string. */
function formatUtcInstantDisplay(value, timeZone = DEFAULT_TIMEZONE, locale = "en-US") {
  const date = parseUtcInstant(value);
  if (!date) return null;

  return date.toLocaleString(locale, {
    timeZone: resolveTimezone(timeZone),
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Embed a UTC instant so text can be reformatted per viewer timezone on read. */
const UTC_INSTANT_TOKEN_RE = /\[\[utc:([^\]]+)\]\]/gi;

function embedUtcInstantToken(value) {
  const iso = toUtcIso(value);
  if (!iso) return "";
  return `[[utc:${iso}]]`;
}

function expandUtcInstantTokens(text, timeZone = DEFAULT_TIMEZONE, locale = "en-US") {
  return String(text || "").replace(UTC_INSTANT_TOKEN_RE, (_match, raw) => {
    return formatUtcInstantDisplay(raw, timeZone, locale) || String(raw || "").trim();
  });
}

module.exports = {
  DEFAULT_TIMEZONE,
  resolveTimezone,
  isCalendarDateString,
  normalizeCalendarDate,
  localInstantToUtc,
  parseUtcInstant,
  toUtcIso,
  toMysqlUtcDateTime,
  splitUtcInstant,
  loggedAtFromParts,
  calendarTodayInTimezone,
  startOfCalendarDayUtc,
  endOfCalendarDayUtc,
  endOfTodayUtc,
  formatUtcInstantDisplay,
  embedUtcInstantToken,
  expandUtcInstantTokens,
};
