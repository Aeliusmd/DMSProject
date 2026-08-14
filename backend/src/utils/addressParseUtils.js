/**
 * Shared US address helpers for portal/order autofill.
 */

const { sanitizeZip } = require("./zipUtils");

function withSanitizedZip(parsed) {
  const zip = sanitizeZip(parsed.zip || "");
  const city = `${parsed.city || ""}`.trim();
  const state = `${parsed.state || ""}`.trim();

  return {
    ...parsed,
    city,
    state,
    zip,
    cityNeedsRecheck: !city && Boolean(state || zip),
  };
}

function normalizeAddressText(fullAddress) {
  return `${fullAddress || ""}`
    .replace(/[;\n\r]+/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/,(?:\s*,)+/g, ",")
    .trim();
}

function looksLikeAddressSegment(segment = "") {
  const text = `${segment || ""}`.trim();
  if (!text) return false;

  return (
    /^\d/.test(text) ||
    /^(suite|ste\.?|apt\.?|unit|p\.?\s*o\.?\s*box)\b/i.test(text) ||
    /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|way|hwy|highway|ct|court|plaza|pkwy|parkway)\b/i.test(
      text
    ) ||
    /\b[A-Za-z]{2}\s+\d{5}(?:-\d{4})?\b/.test(text)
  );
}

function looksLikeCityName(segment = "") {
  const text = `${segment || ""}`.trim();
  if (!text) return false;
  if (looksLikeAddressSegment(text)) return false;
  if (text.split(/\s+/).length > 4) return false;
  return /^[A-Za-z][A-Za-z.'\- ]*$/.test(text);
}

function parseUsAddress(fullAddress) {
  const trimmed = normalizeAddressText(fullAddress);
  if (!trimmed) {
    return withSanitizedZip({ address: "", city: "", state: "", zip: "" });
  }

  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.length === 1) {
    const inlineMatch = trimmed.match(
      /^(.+?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/
    );

    if (inlineMatch) {
      const remainder = inlineMatch[1].trim();
      const state = inlineMatch[2].toUpperCase();
      const zip = inlineMatch[3];

      if (looksLikeCityName(remainder)) {
        return withSanitizedZip({
          address: "",
          city: remainder,
          state,
          zip,
        });
      }

      return withSanitizedZip({
        address: remainder,
        city: "",
        state,
        zip,
      });
    }

    return withSanitizedZip({ address: trimmed, city: "", state: "", zip: "" });
  }

  const last = parts[parts.length - 1];
  const stateZipMatch = last.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);

  if (stateZipMatch) {
    const state = stateZipMatch[1].toUpperCase();
    const zip = stateZipMatch[2];
    const cityCandidate = parts[parts.length - 2] || "";

    if (looksLikeCityName(cityCandidate)) {
      return withSanitizedZip({
        address: parts.slice(0, -2).join(", "),
        city: cityCandidate,
        state,
        zip,
      });
    }

    return withSanitizedZip({
      address: parts.slice(0, -1).join(", "),
      city: "",
      state,
      zip,
    });
  }

  const cityStateZipMatch = last.match(
    /^(.+?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/
  );

  if (cityStateZipMatch) {
    const cityCandidate = cityStateZipMatch[1].trim();
    const state = cityStateZipMatch[2].toUpperCase();
    const zip = cityStateZipMatch[3];

    if (looksLikeCityName(cityCandidate)) {
      return withSanitizedZip({
        address: parts.slice(0, -1).join(", "),
        city: cityCandidate,
        state,
        zip,
      });
    }

    return withSanitizedZip({
      address: [...parts.slice(0, -1), cityCandidate].filter(Boolean).join(", "),
      city: "",
      state,
      zip,
    });
  }

  return withSanitizedZip({
    address: trimmed,
    city: "",
    state: "",
    zip: "",
  });
}

/**
 * Split a blob like "Facility Name, 123 Main St, City, CA 90017"
 * into { name, address }.
 */
function splitNameAndAddress(raw) {
  const text = `${raw || ""}`.replace(/\s+/g, " ").trim();
  if (!text) {
    return { name: "", address: "" };
  }

  const lines = `${raw || ""}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length >= 2) {
    return {
      name: lines[0],
      address: lines.slice(1).join(", "),
    };
  }

  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.length >= 2) {
    let addressStart = -1;

    for (let index = 1; index < parts.length; index += 1) {
      if (looksLikeAddressSegment(parts[index])) {
        addressStart = index;
        break;
      }
    }

    if (addressStart > 0) {
      return {
        name: parts.slice(0, addressStart).join(", "),
        address: parts.slice(addressStart).join(", "),
      };
    }
  }

  const inlineMatch = text.match(/^(.+?)\s+(\d{1,6}\s+.+)$/);
  if (inlineMatch && looksLikeAddressSegment(inlineMatch[2])) {
    return {
      name: inlineMatch[1].trim(),
      address: inlineMatch[2].trim(),
    };
  }

  return { name: text, address: "" };
}

function formatAddressLine({ address, city, state, zip }) {
  const cityStateZip = [city, [state, zip].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return [address, cityStateZip].filter(Boolean).join(", ");
}

module.exports = {
  parseUsAddress,
  splitNameAndAddress,
  looksLikeAddressSegment,
  looksLikeCityName,
  formatAddressLine,
};
