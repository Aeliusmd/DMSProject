const CALENDAR_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function getClientTimezone() {
  if (typeof Intl === "undefined") return "UTC";

  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function isCalendarDateString(value) {
  return CALENDAR_DATE_RE.test(String(value || "").trim());
}

export function parseUtcInstant(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
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

export function formatCalendarDate(value, locale = undefined) {
  if (!value) return "";

  const trimmed = String(value).trim();
  if (!trimmed) return "";

  if (isCalendarDateString(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString(locale, {
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
      timeZone: "UTC",
    });
  }

  const parsed = parseUtcInstant(trimmed);
  if (!parsed) return trimmed;

  return parsed.toLocaleDateString(locale, {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    timeZone: "UTC",
  });
}

export function formatUtcInstant(value, options = {}) {
  const {
    locale = undefined,
    timeZone = getClientTimezone(),
    fallback = "",
    dateStyle,
    timeStyle,
  } = options;

  const parsed = parseUtcInstant(value);
  if (!parsed) return fallback;

  if (dateStyle || timeStyle) {
    return parsed.toLocaleString(locale, {
      timeZone,
      dateStyle,
      timeStyle,
    });
  }

  return parsed.toLocaleString(locale, {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Calendar dates stay as dates; instants render in the user's timezone. */
export function formatDateTimeValue(value, options = {}) {
  if (!value) return options.fallback || "";

  if (isCalendarDateString(value)) {
    return formatCalendarDate(value, options.locale);
  }

  return formatUtcInstant(value, options);
}

export function todayCalendarDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function getTimezoneRequestHeaders(extraHeaders = {}) {
  return {
    "X-Client-Timezone": getClientTimezone(),
    ...extraHeaders,
  };
}
