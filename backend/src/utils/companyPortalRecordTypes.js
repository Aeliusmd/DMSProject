const ORDER_TYPE_KEYWORDS = {
  billing: ["billing"],
  employment: ["employment"],
  xrays: ["xray", "x-rays", "x-ray", "xrays"],
  medical: ["medical"],
};

const RECORD_TYPE_FLAGS = [
  { key: "medicalRecords", column: "medical_records", orderType: "medical", label: "Medical Records" },
  { key: "billingRecords", column: "billing_records", orderType: "billing", label: "Billing Records" },
  { key: "employmentRecords", column: "employment_records", orderType: "employment", label: "Employment Records" },
  { key: "xrays", column: "xrays", orderType: "xrays", label: "X-Rays" },
  { key: "otherRecord", column: "other_record", orderType: "other", label: "Other" },
];

function emptyRecordTypeFlags() {
  return {
    medicalRecords: false,
    billingRecords: false,
    employmentRecords: false,
    xrays: false,
    otherRecord: false,
  };
}

function mapRecordTextToFlags(recordType, requestedRecord) {
  const flags = emptyRecordTypeFlags();
  const combined = `${recordType || ""} ${requestedRecord || ""}`.toLowerCase();

  if (!combined.trim()) {
    return flags;
  }

  let matched = false;
  for (const [type, keywords] of Object.entries(ORDER_TYPE_KEYWORDS)) {
    if (keywords.some((keyword) => combined.includes(keyword))) {
      if (type === "medical") flags.medicalRecords = true;
      if (type === "billing") flags.billingRecords = true;
      if (type === "employment") flags.employmentRecords = true;
      if (type === "xrays") flags.xrays = true;
      matched = true;
    }
  }

  if (/\bother\b/.test(combined)) {
    flags.otherRecord = true;
    matched = true;
  }

  if (!matched) {
    flags.otherRecord = true;
  }

  return flags;
}

function normalizeRecordTypeFlags(input = {}) {
  return {
    medicalRecords: Boolean(input.medicalRecords),
    billingRecords: Boolean(input.billingRecords),
    employmentRecords: Boolean(input.employmentRecords),
    xrays: Boolean(input.xrays),
    otherRecord: Boolean(input.otherRecord),
  };
}

function flagsFromDbRow(row = {}) {
  return {
    medicalRecords: Boolean(Number(row.medical_records)),
    billingRecords: Boolean(Number(row.billing_records)),
    employmentRecords: Boolean(Number(row.employment_records)),
    xrays: Boolean(Number(row.xrays)),
    otherRecord: Boolean(Number(row.other_record)),
  };
}

function flagsToDbValues(flags = {}) {
  const normalized = normalizeRecordTypeFlags(flags);
  return {
    medicalRecords: normalized.medicalRecords ? 1 : 0,
    billingRecords: normalized.billingRecords ? 1 : 0,
    employmentRecords: normalized.employmentRecords ? 1 : 0,
    xrays: normalized.xrays ? 1 : 0,
    otherRecord: normalized.otherRecord ? 1 : 0,
  };
}

function getSelectedRecordTypes(flags = {}) {
  return RECORD_TYPE_FLAGS.filter((item) => Boolean(flags[item.key])).map(
    (item) => item.orderType
  );
}

function formatRecordTypesLabel(flags = {}) {
  return RECORD_TYPE_FLAGS.filter((item) => Boolean(flags[item.key]))
    .map((item) => item.label)
    .join(", ");
}

function hasAnyRecordType(flags = {}) {
  return getSelectedRecordTypes(flags).length > 0;
}

module.exports = {
  RECORD_TYPE_FLAGS,
  emptyRecordTypeFlags,
  mapRecordTextToFlags,
  normalizeRecordTypeFlags,
  flagsFromDbRow,
  flagsToDbValues,
  getSelectedRecordTypes,
  formatRecordTypesLabel,
  hasAnyRecordType,
};
