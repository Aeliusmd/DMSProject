function parseDateOnlyParts(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;

    return {
      year: value.getUTCFullYear(),
      month: value.getUTCMonth() + 1,
      day: value.getUTCDate(),
    };
  }

  const trimmed = String(value).trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (iso) {
    return {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
    };
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
    year: parsed.getUTCFullYear(),
    month: parsed.getUTCMonth() + 1,
    day: parsed.getUTCDate(),
  };
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
  const str = String(value).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : toInputDate(value);
}

function formatSsnLastFourDisplay(lastFour) {
  const digits = `${lastFour || ""}`.replace(/\D/g, "").slice(-4);
  if (digits.length < 4) return "";

  return `XXX-XX-${digits.padStart(4, "0")}`;
}

module.exports = {
  parseDateOnlyParts,
  toInputDate,
  toShortDate,
  formatDobDisplay,
  extractYear,
  normalizeDate,
  formatSsnLastFourDisplay,
};
