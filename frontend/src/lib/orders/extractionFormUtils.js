import { formatMaskedSSN } from "@/lib/validations/newOrderValidation";

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

export function normalizeForMatch(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFacilityLabel(facility) {
  return facility?.facility || facility?.facilityName || facility?.name || "";
}

function getProviderLabel(provider) {
  return provider?.companyName || provider?.company_name || "";
}

export function findFacilityMatch(name, facilityList = []) {
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

export function findProviderMatch(companyName, providerList = []) {
  const normalized = normalizeForMatch(companyName);
  if (!normalized || !providerList.length) return null;

  const exact = providerList.find(
    (provider) => normalizeForMatch(getProviderLabel(provider)) === normalized
  );
  if (exact) return exact;

  return (
    providerList.find((provider) => {
      const providerName = normalizeForMatch(getProviderLabel(provider));
      return (
        providerName &&
        (normalized.includes(providerName) || providerName.includes(normalized))
      );
    }) || null
  );
}

export function mapRecordTypeToOrderType(recordType, requestedRecord) {
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

export function normalizeAutofillCheckNumber(value) {
  if (!value) return "";

  let text = String(value).trim();

  while (/^#\s*/.test(text)) {
    text = text.replace(/^#\s*/, "");
  }

  return text.trim();
}

export function normalizeAutofillAmount(value) {
  if (!value) return "";
  return String(value).replace(/[^\d.]/g, "");
}

export function normalizeAutofillSSN(value) {
  if (!value) return "";
  return formatMaskedSSN(String(value).trim());
}

export function mapOrderHintsToForm(hints, { facilityList = [], providerList = [] } = {}) {
  if (!hints) {
    return { updates: {}, meta: {} };
  }

  const updates = {};
  const meta = {};

  if (hints.orderNumber) updates.orderNumber = hints.orderNumber;
  if (hints.caseName) updates.caseNumber = hints.caseName;
  if (hints.ssn) {
    const formattedSsn = normalizeAutofillSSN(hints.ssn);
    if (formattedSsn) updates.ssn = formattedSsn;
  }
  if (hints.dateOfBirth) updates.dob = hints.dateOfBirth;
  if (hints.companyAddress) updates.address = hints.companyAddress;
  if (hints.specificDoctor) updates.specificDoctor = hints.specificDoctor;
  if (hints.doctorAddress) updates.fullAddress = hints.doctorAddress;
  if (hints.subpoenaDate) updates.subpoenaDate = hints.subpoenaDate;
  if (hints.depoDueDate) updates.depoDueDate = hints.depoDueDate;
  if (hints.requestedRecord) updates.specificRecord = hints.requestedRecord;
  if (hints.amount) {
    const amount = normalizeAutofillAmount(hints.amount);
    if (amount) {
      updates.subpoenaPrepaymentAmount = amount;
      updates.prepaymentPaid = amount;
    }
  }
  if (hints.chequeDate) updates.prepaymentDate = hints.chequeDate;
  if (hints.chequeNumber) {
    const checkNumber = normalizeAutofillCheckNumber(hints.chequeNumber);
    if (checkNumber) updates.prepaymentCheck = checkNumber;
  }

  if (hints.applicantName) {
    const parts = hints.applicantName.trim().split(/\s+/);
    if (parts.length === 1) {
      updates.firstName = parts[0];
    } else if (parts.length === 2) {
      updates.firstName = parts[0];
      updates.lastName = parts[1];
    } else {
      updates.firstName = parts[0];
      updates.middleName = parts.slice(1, -1).join(" ");
      updates.lastName = parts[parts.length - 1];
    }
  }

  const facilityMatch = findFacilityMatch(hints.customer, facilityList);
  if (facilityMatch) {
    updates.facility = String(facilityMatch.id);
    meta.facilityName = getFacilityLabel(facilityMatch);
  }

  const providerName = hints.companyName;
  if (providerName) {
    const providerMatch = findProviderMatch(providerName, providerList);
    if (providerMatch) {
      updates.providerId = String(providerMatch.id);
      updates.serveCompanyName = getProviderLabel(providerMatch);
      updates.address = providerMatch.address || updates.address || "";
      updates.zip = providerMatch.zipCode || providerMatch.zip || "";
      updates.city = providerMatch.city || "";
      updates.state = providerMatch.state || "";
      updates.phone = providerMatch.phone || "";
      updates.fax = providerMatch.fax || "";
      updates.email = providerMatch.email || "";
      meta.providerName = getProviderLabel(providerMatch);
    } else {
      updates.serveCompanyName = providerName;
    }
  }

  const recordText = `${hints.recordType || ""} ${hints.requestedRecord || ""}`;
  const mappedType = mapRecordTypeToOrderType(
    hints.recordType,
    hints.requestedRecord
  );

  if (mappedType) {
    updates.type = mappedType;
    if (mappedType === "other") {
      updates.otherRecord = true;
    } else {
      updates[RECORD_FLAG_MAP[mappedType]] = true;
    }
  } else if (recordText.trim()) {
    updates.type = "other";
    updates.otherRecord = true;
  }

  applyRecordFlags(updates, recordText);

  return { updates, meta };
}

export function buildFormFromExtract(
  extract,
  { facilityList = [], providerList = [] } = {},
  subpoenaFile
) {
  const orderHints = extract?.orderHints || {};
  const { updates, meta } = mapOrderHintsToForm(orderHints, {
    facilityList,
    providerList,
  });

  return {
    formUpdates: {
      ...updates,
      ...(subpoenaFile ? { subpoenaFile } : {}),
      ...(extract?.id || extract?.extractId
        ? { subpoenaExtractId: String(extract.id || extract.extractId) }
        : {}),
    },
    meta,
  };
}
