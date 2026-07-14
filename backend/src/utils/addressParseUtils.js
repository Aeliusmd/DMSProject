/**
 * Shared US address helpers for portal/order autofill.
 */

function parseUsAddress(fullAddress) {
  const trimmed = `${fullAddress || ""}`.trim();
  if (!trimmed) {
    return { address: "", city: "", state: "", zip: "" };
  }

  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.length === 1) {
    const inlineMatch = trimmed.match(
      /^(.+?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/
    );

    if (inlineMatch) {
      return {
        address: inlineMatch[1].trim(),
        city: "",
        state: inlineMatch[2].toUpperCase(),
        zip: inlineMatch[3],
      };
    }

    return { address: trimmed, city: "", state: "", zip: "" };
  }

  const last = parts[parts.length - 1];
  const stateZipMatch = last.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);

  if (stateZipMatch) {
    return {
      address: parts.slice(0, -2).join(", "),
      city: parts.length >= 2 ? parts[parts.length - 2] : "",
      state: stateZipMatch[1].toUpperCase(),
      zip: stateZipMatch[2],
    };
  }

  const cityStateZipMatch = last.match(
    /^(.+?)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/
  );

  if (cityStateZipMatch) {
    return {
      address: parts.slice(0, -1).join(", "),
      city: cityStateZipMatch[1].trim(),
      state: cityStateZipMatch[2].toUpperCase(),
      zip: cityStateZipMatch[3],
    };
  }

  return {
    address: parts.slice(0, -1).join(", "),
    city: parts[parts.length - 1],
    state: "",
    zip: "",
  };
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
  formatAddressLine,
};
