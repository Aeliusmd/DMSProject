const VALID_RECORD_TYPES = ["medical", "billing", "employment", "xrays", "other"];

const RECORD_TYPE_FLAG_MAP = {
  medical: "medicalRecords",
  billing: "billingRecords",
  employment: "employmentRecords",
  xrays: "xrays",
  other: "otherRecord",
};

function hasRecordTypesSelected(data = {}, orderRecords = []) {
  if (orderRecords.length > 0) {
    return true;
  }

  if (data.type && VALID_RECORD_TYPES.includes(data.type)) {
    return true;
  }

  return VALID_RECORD_TYPES.some((type) => Boolean(data[RECORD_TYPE_FLAG_MAP[type]]));
}

function hasInjuryPayload(data = {}) {
  const injuryType = `${data.injuryType || ""}`.trim();

  if (injuryType === "specific") {
    return Boolean(`${data.injuryDate || ""}`.trim());
  }

  if (injuryType === "cumulative") {
    return (
      Boolean(`${data.injuryDateBegin || ""}`.trim()) &&
      Boolean(`${data.injuryDateEnd || ""}`.trim())
    );
  }

  return true;
}

const REQUIRED_FIELD_RULES = [
  {
    key: "facility",
    label: "Facility",
    check: (data) => Boolean(`${data.facility || ""}`.trim()),
  },
  {
    key: "type",
    label: "Record type",
    check: (data, orderRecords) => hasRecordTypesSelected(data, orderRecords),
  },
  {
    key: "firstName",
    label: "First name",
    check: (data) => Boolean(`${data.firstName || ""}`.trim()),
  },
  {
    key: "lastName",
    label: "Last name",
    check: (data) => Boolean(`${data.lastName || ""}`.trim()),
  },
  {
    key: "serveCompanyName",
    label: "Company name",
    check: (data) => Boolean(`${data.serveCompanyName || ""}`.trim()),
  },
  {
    key: "email",
    label: "Provider email",
    check: (data) => Boolean(`${data.email || ""}`.trim()),
  },
  {
    key: "specificDoctor",
    label: "Specific doctor",
    check: (data) => Boolean(`${data.specificDoctor || ""}`.trim()),
  },
  {
    key: "injury",
    label: "Injury date",
    check: (data) => {
      const injuryType = `${data.injuryType || ""}`.trim();
      if (!injuryType) return true;
      return hasInjuryPayload(data);
    },
  },
];

function computeMissingRequiredFields(data = {}, orderRecords = []) {
  return REQUIRED_FIELD_RULES.filter((rule) => !rule.check(data, orderRecords)).map(
    (rule) => rule.label
  );
}

function mapOrderRowToRequiredFieldData(row = {}, orderRecords = []) {
  const recordTypes = orderRecords.map((record) => record.record_type);
  const primaryType = recordTypes[0] || "";

  return {
    facility: row.facility_id ? String(row.facility_id) : "",
    type: primaryType,
    medicalRecords: recordTypes.includes("medical"),
    billingRecords: recordTypes.includes("billing"),
    employmentRecords: recordTypes.includes("employment"),
    xrays: recordTypes.includes("xrays"),
    otherRecord: recordTypes.includes("other"),
    firstName: row.applicant_first_name || "",
    lastName: row.applicant_last_name || "",
    serveCompanyName: row.serve_company_name || "",
    email: row.serve_email || row.provider_email || "",
    specificDoctor: row.specific_doctor || "",
    injuryType: row.injury_type || "",
    injuryDate: row.injury_date || "",
    injuryDateBegin: row.injury_date_begin || "",
    injuryDateEnd: row.injury_date_end || "",
  };
}

module.exports = {
  computeMissingRequiredFields,
  mapOrderRowToRequiredFieldData,
  hasRecordTypesSelected,
};
