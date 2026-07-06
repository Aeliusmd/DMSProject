const { toInputDate } = require("./dateUtils");
const {
  mapSchemaToOrderHints,
  enrichOrderHintsFromRow,
  resolveExtractionSchema,
} = require("./extractionMapper");

const ORDER_TYPE_KEYWORDS = {
  billing: ["billing"],
  employment: ["employment"],
  xrays: ["xray", "x-rays", "x-ray", "xrays"],
  medical: ["medical"],
};

const RECORD_FLAG_MAP = {
  medical: "medicalRecords",
  billing: "billingRecords",
  employment: "employmentRecords",
  xrays: "xrays",
};

function normalizeForMatch(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFacilityLabel(facility) {
  return facility?.facility_name || facility?.facility || facility?.name || "";
}

function findFacilityMatch(name, facilityList = []) {
  const normalized = normalizeForMatch(name);
  if (!normalized || !facilityList.length) return null;

  const exact = facilityList.find(
    (facility) => normalizeForMatch(getFacilityLabel(facility)) === normalized
  );
  if (exact) return exact;

  return (
    facilityList.find((facility) => {
      const facilityName = normalizeForMatch(getFacilityLabel(facility));
      return (
        facilityName &&
        (normalized.includes(facilityName) || facilityName.includes(normalized))
      );
    }) || null
  );
}

function splitApplicantName(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return { firstName: "", middleName: "", lastName: "" };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], middleName: "", lastName: "" };
  }

  if (parts.length === 2) {
    return { firstName: parts[0], middleName: "", lastName: parts[1] };
  }

  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function mapRecordTypeToOrderType(recordType, requestedRecord) {
  const combined = `${recordType || ""} ${requestedRecord || ""}`.toLowerCase();

  for (const [type, keywords] of Object.entries(ORDER_TYPE_KEYWORDS)) {
    if (keywords.some((keyword) => combined.includes(keyword))) {
      return type;
    }
  }

  if (/\bother\b/.test(combined)) {
    return "other";
  }

  return null;
}

function applyRecordFlags(updates, recordText) {
  const text = recordText.toLowerCase();
  if (text.includes("medical")) updates.medicalRecords = true;
  if (text.includes("billing")) updates.billingRecords = true;
  if (text.includes("employment")) updates.employmentRecords = true;
  if (text.includes("xray") || text.includes("x-ray")) {
    updates.xrays = true;
  }
}

function parseUsAddress(fullAddress) {
  const trimmed = String(fullAddress || "").trim();
  if (!trimmed) {
    return { address: "", city: "", state: "", zip: "" };
  }

  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);

  if (parts.length === 1) {
    return { address: trimmed, city: "", state: "", zip: "" };
  }

  const last = parts[parts.length - 1];
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

function applyParsedServeAddress(updates, fullAddress) {
  const parsed = parseUsAddress(fullAddress);
  updates.address = parsed.address || String(fullAddress).trim();
  if (!updates.city && parsed.city) updates.city = parsed.city;
  if (!updates.state && parsed.state) updates.state = parsed.state;
  if (!updates.zip && parsed.zip) updates.zip = parsed.zip;
}

function buildOrderPayloadFromExtractRow(extract, facilities = []) {
  const rawExtraction =
    typeof extract.raw_extraction === "string"
      ? JSON.parse(extract.raw_extraction || "{}")
      : extract.raw_extraction || {};
  const schema = resolveExtractionSchema(rawExtraction);
  const hints = enrichOrderHintsFromRow(mapSchemaToOrderHints(schema), extract);
  const payload = {
    court: "WCAB",
    certificateNoRecords: false,
    cnrMemo: false,
  };

  if (hints.orderNumber) payload.orderNumber = hints.orderNumber;
  if (hints.recNumber) payload.recNumber = hints.recNumber;
  if (hints.caseName) payload.caseNumber = hints.caseName;
  if (hints.ssn) payload.ssn = hints.ssn;
  if (hints.dateOfBirth) payload.dob = hints.dateOfBirth;
  if (hints.specificDoctor) payload.specificDoctor = hints.specificDoctor;
  if (hints.doctorAddress) payload.fullAddress = hints.doctorAddress;
  if (hints.subpoenaDate) payload.subpoenaDate = hints.subpoenaDate;
  if (hints.dateRequested) payload.dateRequested = hints.dateRequested;
  if (hints.depoDueDate) payload.depoDueDate = hints.depoDueDate;
  if (hints.requestedRecord) payload.specificRecord = hints.requestedRecord;

  if (hints.applicantName) {
    Object.assign(payload, splitApplicantName(hints.applicantName));
  }

  const facilityMatch = findFacilityMatch(hints.customer, facilities);
  if (facilityMatch) {
    payload.facility = String(facilityMatch.id);
  }

  if (hints.providerId) {
    payload.providerId = String(hints.providerId);
    payload.serveCompanyName = hints.companyName || "";
  } else if (hints.companyName) {
    payload.serveCompanyName = hints.companyName;
  }

  if (hints.companyAddress) {
    applyParsedServeAddress(payload, hints.companyAddress);
  }

  const recordText = `${hints.recordType || ""} ${hints.requestedRecord || ""}`;
  const mappedType = mapRecordTypeToOrderType(
    hints.recordType,
    hints.requestedRecord
  );

  if (mappedType) {
    payload.type = mappedType;
    if (mappedType === "other") {
      payload.otherRecord = true;
    } else {
      payload[RECORD_FLAG_MAP[mappedType]] = true;
    }
  } else if (recordText.trim()) {
    payload.type = "other";
    payload.otherRecord = true;
  }

  applyRecordFlags(payload, recordText);

  if (hints.dateOfInjury) {
    payload.injuryType = "specific";
    payload.injuryDate = hints.dateOfInjury;
  }

  return payload;
}

module.exports = {
  buildOrderPayloadFromExtractRow,
  findFacilityMatch,
};
