function isDateOnlyString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim());
}

function parseDateOnlyParts(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;

    // mysql2 returns DATE as local midnight — use local calendar parts.
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    };
  }

  const trimmed = String(value).trim();

  // Literal YYYY-MM-DD — do not parse through Date (avoids UTC off-by-one).
  if (isDateOnlyString(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return { year, month, day };
  }

  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);

  if (slash) {
    let year = Number(slash[3]);

    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }

    return {
      year,
      month: Number(slash[1]),
      day: Number(slash[2]),
    };
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) return null;

  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
}

/** Normalize any input to YYYY-MM-DD for MySQL DATE columns (never returns Date objects). */
function toSqlDateOnly(value) {
  const parts = parseDateOnlyParts(value);
  if (!parts) return null;

  const { year, month, day } = parts;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toInputDate(value) {
  const parts = parseDateOnlyParts(value);
  if (!parts) return "";

  const { year, month, day } = parts;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toShortDate(value) {
  const parts = parseDateOnlyParts(value);
  if (!parts) return "";

  const { year, month, day } = parts;

  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${String(year).slice(-2)}`;
}

function formatDobDisplay(value) {
  const parts = parseDateOnlyParts(value);
  if (!parts) return "";

  const { year, month, day } = parts;

  return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`;
}

function extractYear(value) {
  const parts = parseDateOnlyParts(value);
  return parts ? String(parts.year) : "";
}

function normalizeDate(value) {
  if (!value) return "";
  const sql = toSqlDateOnly(value);
  return sql || "";
}

function formatSsnLastFourDisplay(lastFour) {
  const digits = `${lastFour || ""}`.replace(/\D/g, "").slice(-4);
  if (digits.length < 4) return "";

  return `XXX-XX-${digits.padStart(4, "0")}`;
}

function getTodayInputDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

module.exports = {
  isDateOnlyString,
  parseDateOnlyParts,
  toInputDate,
  toSqlDateOnly,
  toShortDate,
  formatDobDisplay,
  extractYear,
  normalizeDate,
  formatSsnLastFourDisplay,
  getTodayInputDate,
};
