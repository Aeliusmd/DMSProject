const { toInputDate } = require("./dateUtils");
const {
  findFacilityByNameMatch,
} = require("./facilityNameUtils");
const {
  mapSchemaToOrderHints,
  enrichOrderHintsFromRow,
  resolveExtractionSchema,
} = require("./extractionMapper");
const { splitNameAndAddress, parseUsAddress } = require("./addressParseUtils");

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

  const facilitySplit = splitNameAndAddress(hints.customer || "");
  const facilityName = facilitySplit.name || hints.customer;
  const facilityMatch = findFacilityByNameMatch(facilityName, facilities);
  if (facilityMatch) {
    payload.facility = String(facilityMatch.id);
  }

  const companySplit = splitNameAndAddress(hints.companyName || "");
  const companyName = companySplit.name || hints.companyName;
  const companyAddressSource =
    companySplit.address || hints.companyAddress || "";

  if (hints.providerId) {
    payload.providerId = String(hints.providerId);
    payload.serveCompanyName = companyName || "";
  } else if (companyName) {
    payload.serveCompanyName = companyName;
  }

  if (companyAddressSource) {
    applyParsedServeAddress(payload, companyAddressSource);
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
  findFacilityMatch: findFacilityByNameMatch,
};
