const AI_FIELDS = [
  "ApplicantName",
  "CaseName",
  "OrderNumber",
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
  return entry?.value?.trim() || null;
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
    ssn: getFieldText(schema, "SSN"),
    date_of_birth: parseDateForDb(getFieldText(schema, "DateOfBirth")),
    date_of_injury: parseDateForDb(getFieldText(schema, "DateOfInjury")),
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
    ssn: row.ssn,
    dateOfBirth: row.date_of_birth,
    dateOfInjury: row.date_of_injury,
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

module.exports = {
  AI_FIELDS,
  mapSchemaToExtractRow,
  mapSchemaToOrderHints,
  getFieldText,
};
