const { toSqlDateOnly, toInputDate } = require("./dateUtils");

const DATE_OF_INJURY_FIELD_ALIASES = [
  "DateOfInjury",
  "Date of Injury",
  "date_of_injury",
  "DOI",
  "InjuryDate",
];

const AI_FIELDS = [
  "ApplicantName",
  "CaseName",
  "OrderNumber",
  "RecNumber",
  "SSN",
  "DateOfBirth",
  "DateOfInjury",
  "Customer",
  "CompanyName",
  "CompanyAddress",
  "SpecificDoctor",
  "DoctorAddress",
  "RecordType",
  "RequestedRecord",
  "Date",
  "DateRequested",
  "DePoDueDate",
  "Amount",
  "ChequeDate",
  "ChequeNumber",
];

function resolveExtractionSchema(raw) {
  if (!raw || typeof raw !== "object") {
    return {};
  }

  if (raw.schema_extraction && typeof raw.schema_extraction === "object") {
    return raw.schema_extraction;
  }

  return raw;
}

function normalizeFieldValue(entry) {
  if (entry == null) {
    return null;
  }

  if (typeof entry === "string" || typeof entry === "number") {
    const text = String(entry).trim();
    return text || null;
  }

  if (entry.value != null) {
    const text = String(entry.value).trim();
    if (text) return text;
  }

  if (entry.normalized != null) {
    const text = String(entry.normalized).trim();
    if (text) return text;
  }

  if (entry.mention_text != null) {
    const text = String(entry.mention_text).trim();
    if (text) return text;
  }

  return null;
}

function getFieldEntry(schema, fieldName) {
  const entry = schema?.[fieldName];
  if (!entry) return null;
  if (Array.isArray(entry)) {
    return entry.reduce((best, item) => {
      if (!best || (item.confidence ?? 0) > (best.confidence ?? 0)) {
        return item;
      }
      return best;
    }, null);
  }
  return entry;
}

function getFieldText(schema, fieldName) {
  const entry = getFieldEntry(schema, fieldName);
  return normalizeFieldValue(entry);
}

function getFirstFieldText(schema, fieldNames = []) {
  if (!schema || typeof schema !== "object") {
    return null;
  }

  for (const fieldName of fieldNames) {
    const text = getFieldText(schema, fieldName);
    if (text) return text;
  }

  const aliasSet = new Set(
    fieldNames.map((name) => name.toLowerCase().replace(/[\s_]/g, ""))
  );

  for (const [key, entry] of Object.entries(schema)) {
    const normalizedKey = key.toLowerCase().replace(/[\s_]/g, "");
    if (!aliasSet.has(normalizedKey)) {
      continue;
    }

    const text = normalizeFieldValue(entry);
    if (text) {
      return text;
    }
  }

  return null;
}

function getFieldDateText(schema, fieldNames = []) {
  if (!schema || typeof schema !== "object") {
    return null;
  }

  for (const fieldName of fieldNames) {
    const entry = getFieldEntry(schema, fieldName);
    if (!entry) continue;

    const normalized = normalizeFieldValue({ normalized: entry.normalized });
    const mention = normalizeFieldValue({ value: entry.value });
    const text = normalized || mention;
    if (text) return text;
  }

  return getFirstFieldText(schema, fieldNames);
}

function getDateOfInjuryText(schema) {
  return getFieldDateText(schema, DATE_OF_INJURY_FIELD_ALIASES);
}

function getFieldConfidence(schema, fieldName) {
  const entry = getFieldEntry(schema, fieldName);
  return entry?.confidence ?? null;
}

function buildConfidenceMap(schema) {
  const map = {};
  AI_FIELDS.forEach((field) => {
    const confidence = getFieldConfidence(schema, field);
    if (confidence != null) {
      map[field] = confidence;
    }
  });
  return map;
}

function mapSchemaToExtractRow(schema) {
  const dateOfInjuryText = getDateOfInjuryText(schema);

  return {
    applicant_name: getFieldText(schema, "ApplicantName"),
    case_name: getFieldText(schema, "CaseName"),
    order_number: getFieldText(schema, "OrderNumber"),
    rec_number: getFieldText(schema, "RecNumber"),
    ssn: getFieldText(schema, "SSN"),
    date_of_birth: toSqlDateOnly(getFieldDateText(schema, ["DateOfBirth"])),
    date_of_injury: toSqlDateOnly(dateOfInjuryText),
    customer: getFieldText(schema, "Customer"),
    company_name: getFieldText(schema, "CompanyName"),
    company_address: getFieldText(schema, "CompanyAddress"),
    specific_doctor: getFieldText(schema, "SpecificDoctor"),
    doctor_address: getFieldText(schema, "DoctorAddress"),
    record_type: getFieldText(schema, "RecordType"),
    requested_record: getFieldText(schema, "RequestedRecord"),
    subpoena_date: toSqlDateOnly(
      getFieldDateText(schema, ["Date", "DateRequested"])
    ),
    date_requested: toSqlDateOnly(getFieldDateText(schema, ["DateRequested"])),
    depo_due_date: toSqlDateOnly(getFieldDateText(schema, ["DePoDueDate"])),
    amount: getFieldText(schema, "Amount"),
    cheque_date: toSqlDateOnly(getFieldDateText(schema, ["ChequeDate"])),
    cheque_number: getFieldText(schema, "ChequeNumber"),
    extraction_confidence: buildConfidenceMap(schema),
    raw_extraction: schema || {},
  };
}

function mapSchemaToOrderHints(schema) {
  const row = mapSchemaToExtractRow(schema);
  const dateOfInjuryText = getDateOfInjuryText(schema);

  return {
    applicantName: row.applicant_name,
    caseName: row.case_name,
    orderNumber: row.order_number,
    recNumber: row.rec_number,
    ssn: row.ssn,
    dateOfBirth: row.date_of_birth ? toInputDate(row.date_of_birth) : "",
    dateOfInjury: row.date_of_injury ? toInputDate(row.date_of_injury) : "",
    dateOfInjuryText: dateOfInjuryText || "",
    customer: row.customer,
    companyName: row.company_name,
    companyAddress: row.company_address,
    specificDoctor: row.specific_doctor,
    doctorAddress: row.doctor_address,
    recordType: row.record_type,
    requestedRecord: row.requested_record,
    subpoenaDate: row.subpoena_date,
    depoDueDate: row.depo_due_date,
    amount: row.amount,
    chequeDate: row.cheque_date,
    chequeNumber: row.cheque_number,
  };
}

function enrichOrderHintsFromRow(orderHints, row = {}) {
  const hints = { ...orderHints };
  const persistedDoi = row.date_of_injury ? toInputDate(row.date_of_injury) : "";

  if (persistedDoi && !hints.dateOfInjury) {
    hints.dateOfInjury = persistedDoi;
  }

  if (persistedDoi && !hints.dateOfInjuryText) {
    hints.dateOfInjuryText = persistedDoi;
  }

  return hints;
}

module.exports = {
  AI_FIELDS,
  mapSchemaToExtractRow,
  mapSchemaToOrderHints,
  resolveExtractionSchema,
  enrichOrderHintsFromRow,
  getFieldText,
};
