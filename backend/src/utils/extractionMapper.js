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

function getDateOfInjuryText(schema) {
  return getFirstFieldText(schema, DATE_OF_INJURY_FIELD_ALIASES);
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

function parseDateForDb(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slash) {
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    const month = String(slash[1]).padStart(2, "0");
    const day = String(slash[2]).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function mapSchemaToExtractRow(schema) {
  return {
    applicant_name: getFieldText(schema, "ApplicantName"),
    case_name: getFieldText(schema, "CaseName"),
    order_number: getFieldText(schema, "OrderNumber"),
    rec_number: getFieldText(schema, "RecNumber"),
    ssn: getFieldText(schema, "SSN"),
    date_of_birth: parseDateForDb(getFieldText(schema, "DateOfBirth")),
    date_of_injury: parseDateForDb(getDateOfInjuryText(schema)),
    customer: getFieldText(schema, "Customer"),
    company_name: getFieldText(schema, "CompanyName"),
    company_address: getFieldText(schema, "CompanyAddress"),
    specific_doctor: getFieldText(schema, "SpecificDoctor"),
    doctor_address: getFieldText(schema, "DoctorAddress"),
    record_type: getFieldText(schema, "RecordType"),
    requested_record: getFieldText(schema, "RequestedRecord"),
    subpoena_date: parseDateForDb(
      getFieldText(schema, "Date") || getFieldText(schema, "DateRequested")
    ),
    date_requested: parseDateForDb(getFieldText(schema, "DateRequested")),
    depo_due_date: parseDateForDb(getFieldText(schema, "DePoDueDate")),
    amount: getFieldText(schema, "Amount"),
    cheque_date: parseDateForDb(getFieldText(schema, "ChequeDate")),
    cheque_number: getFieldText(schema, "ChequeNumber"),
    extraction_confidence: buildConfidenceMap(schema),
    raw_extraction: schema || {},
  };
}

function mapSchemaToOrderHints(schema) {
  const row = mapSchemaToExtractRow(schema);
  return {
    applicantName: row.applicant_name,
    caseName: row.case_name,
    orderNumber: row.order_number,
    recNumber: row.rec_number,
    ssn: row.ssn,
    dateOfBirth: row.date_of_birth,
    dateOfInjury: row.date_of_injury,
    dateOfInjuryText: getDateOfInjuryText(schema),
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
  const persistedDoi = row.date_of_injury
    ? String(row.date_of_injury).trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ||
      String(row.date_of_injury).trim()
    : "";

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
