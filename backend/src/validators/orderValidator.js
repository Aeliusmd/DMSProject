const {
  FIELD_LIMITS,
  trimToString,
  getDigits,
  isBlank,
  isValidEmail,
  isValidIsoDate,
  isFutureDate,
  isValidSSN,
  isValidMoney,
  addMaxLengthError,
  addOptionalIsoDateError,
} = require("./validationHelpers");

const ALLOWED_ORDER_TYPES = ["medical", "billing", "employment", "xrays", "other"];
const ALLOWED_INJURY_TYPES = ["specific", "cumulative"];
const ALLOWED_CNR_DELIVERY = new Set(["email", "fax", "pickup"]);
const WORKFLOW_STAGE_NAMES = [
  "Review Records",
  "Serve",
  "Custodian",
  "SENT",
];
const WORKFLOW_STAGE_STATUSES = ["pending", "complete", "failed", "sent"];
const MAX_NOTE_LENGTH = FIELD_LIMITS.ORDER_NOTE;

const EMAIL_FIELDS = ["email", "contact1Email", "contact2Email"];
const PHONE_FIELDS = [
  "phone",
  "fax",
  "contact1Phone",
  "contact1Fax",
  "contact2Phone",
  "contact2Fax",
];
const PAYMENT_PREFIXES = ["prepayment", "custodian", "xray"];

function hasRecordTypesSelected(body = {}) {
  return [
    body.medicalRecords,
    body.billingRecords,
    body.employmentRecords,
    body.xrays,
    body.otherRecord,
  ].some(Boolean);
}

function validateOrderPayload(body = {}) {
  const errors = [];

  const facility = body.facility;

  if (isBlank(facility)) {
    errors.push({ field: "facility", message: "Facility is required" });
  } else if (Number.isNaN(Number(facility)) || Number(facility) <= 0) {
    errors.push({ field: "facility", message: "Facility is invalid" });
  }

  if (!hasRecordTypesSelected(body) && isBlank(body.type)) {
    errors.push({
      field: "type",
      message: "At least one record type is required",
    });
  } else if (
    !isBlank(body.type) &&
    !ALLOWED_ORDER_TYPES.includes(trimToString(body.type))
  ) {
    errors.push({ field: "type", message: "Type is invalid" });
  }

  if (isBlank(body.firstName)) {
    errors.push({ field: "firstName", message: "First name is required" });
  } else {
    addMaxLengthError(errors, "firstName", body.firstName, FIELD_LIMITS.VARCHAR_100);
  }

  if (isBlank(body.lastName)) {
    errors.push({ field: "lastName", message: "Last name is required" });
  } else {
    addMaxLengthError(errors, "lastName", body.lastName, FIELD_LIMITS.VARCHAR_100);
  }

  if (isBlank(body.serveCompanyName)) {
    errors.push({ field: "serveCompanyName", message: "Company name is required" });
  } else {
    addMaxLengthError(
      errors,
      "serveCompanyName",
      body.serveCompanyName,
      FIELD_LIMITS.VARCHAR_255
    );
  }

  if (isBlank(body.specificDoctor)) {
    errors.push({ field: "specificDoctor", message: "Specific doctor is required" });
  } else {
    addMaxLengthError(
      errors,
      "specificDoctor",
      body.specificDoctor,
      FIELD_LIMITS.VARCHAR_200
    );
  }

  addMaxLengthError(errors, "middleName", body.middleName, FIELD_LIMITS.VARCHAR_100);
  addMaxLengthError(errors, "aka", body.aka, FIELD_LIMITS.VARCHAR_150);
  addMaxLengthError(errors, "defendant", body.defendant, FIELD_LIMITS.VARCHAR_200);
  addMaxLengthError(errors, "address", body.address, FIELD_LIMITS.VARCHAR_255);
  addMaxLengthError(errors, "city", body.city, FIELD_LIMITS.VARCHAR_100);
  addMaxLengthError(errors, "specificRecord", body.specificRecord, FIELD_LIMITS.VARCHAR_255);
  addMaxLengthError(errors, "court", body.court, 50);
  addMaxLengthError(errors, "caseNumber", body.caseNumber, 50);
  addMaxLengthError(errors, "recNumber", body.recNumber, 50);
  addMaxLengthError(errors, "orderRef", body.orderRef, 50);
  addMaxLengthError(errors, "contact1Name", body.contact1Name, FIELD_LIMITS.VARCHAR_150);
  addMaxLengthError(errors, "contact1Title", body.contact1Title, FIELD_LIMITS.VARCHAR_100);
  addMaxLengthError(errors, "contact2Name", body.contact2Name, FIELD_LIMITS.VARCHAR_150);
  addMaxLengthError(errors, "contact2Title", body.contact2Title, FIELD_LIMITS.VARCHAR_100);
  addMaxLengthError(errors, "fullAddress", body.fullAddress, FIELD_LIMITS.TEXT);
  addMaxLengthError(errors, "cnrReason", body.cnrReason, FIELD_LIMITS.TEXT);
  addMaxLengthError(errors, "documentName", body.documentName, FIELD_LIMITS.VARCHAR_255);

  if (!isBlank(body.ssn) && !isValidSSN(body.ssn)) {
    errors.push({ field: "ssn", message: "Enter SSN as XXX-XX-1234" });
  }

  if (!isBlank(body.dob)) {
    if (!isValidIsoDate(body.dob)) {
      errors.push({ field: "dob", message: "Enter a valid date of birth" });
    } else if (isFutureDate(body.dob)) {
      errors.push({ field: "dob", message: "DOB cannot be in the future" });
    }
  }

  const zip = trimToString(body.zip);
  if (zip && getDigits(zip).length !== 5) {
    errors.push({ field: "zip", message: "ZIP must be 5 digits" });
  }

  const state = trimToString(body.state);
  if (state && state.length !== 2) {
    errors.push({ field: "state", message: "State must be 2 letters" });
  }

  EMAIL_FIELDS.forEach((field) => {
    const value = trimToString(body[field]);
    if (value && !isValidEmail(value)) {
      errors.push({ field, message: "Enter a valid email address" });
    }
    addMaxLengthError(errors, field, value, FIELD_LIMITS.VARCHAR_255);
  });

  PHONE_FIELDS.forEach((field) => {
    const value = body[field];
    if (value && getDigits(value).length !== 10) {
      errors.push({ field, message: "Enter a valid 10 digit number" });
    }
    addMaxLengthError(errors, field, value, 20);
  });

  PAYMENT_PREFIXES.forEach((prefix) => {
    const checkField = `${prefix}Check`;
    const paidField = `${prefix}Paid`;

    if (!isBlank(body[checkField]) && !/^\d+$/.test(trimToString(body[checkField]))) {
      errors.push({
        field: checkField,
        message: "Check number must contain only numbers",
      });
    }

    if (!isBlank(body[paidField]) && !isValidMoney(body[paidField])) {
      errors.push({ field: paidField, message: "Enter a valid amount" });
    }

    addMaxLengthError(errors, checkField, body[checkField], 50);
    addOptionalIsoDateError(errors, `${prefix}Date`, body[`${prefix}Date`]);
  });

  [
    "dateServed",
    "depoDueDate",
    "deliveryDate",
    "subpoenaDate",
    "dateRequested",
    "readyDate",
    "invoiceDate",
    "xrayInvoiceDate",
    "cnrDateSent",
  ].forEach((field) => addOptionalIsoDateError(errors, field, body[field]));

  errors.push(...validateInjuryFields(body));
  errors.push(...validateCnrFields(body));

  return { valid: errors.length === 0, errors };
}

function validateInjuryFields(body = {}) {
  const errors = [];
  const injuryType = trimToString(body.injuryType);

  if (injuryType && !ALLOWED_INJURY_TYPES.includes(injuryType)) {
    errors.push({ field: "injuryType", message: "Injury type is invalid" });
    return errors;
  }

  if (!injuryType) {
    return errors;
  }

  if (injuryType === "specific") {
    if (isBlank(body.injuryDate)) {
      errors.push({ field: "injuryDate", message: "Injury date is required" });
    } else if (!isValidIsoDate(body.injuryDate)) {
      errors.push({ field: "injuryDate", message: "Enter a valid injury date" });
    }
    return errors;
  }

  const begin = trimToString(body.injuryDateBegin);
  const end = trimToString(body.injuryDateEnd);

  if (!begin) {
    errors.push({
      field: "injuryDateBegin",
      message: "Start date is required",
    });
  } else if (!isValidIsoDate(begin)) {
    errors.push({
      field: "injuryDateBegin",
      message: "Enter a valid start date",
    });
  }

  if (!end) {
    errors.push({
      field: "injuryDateEnd",
      message: "End date is required",
    });
  } else if (!isValidIsoDate(end)) {
    errors.push({
      field: "injuryDateEnd",
      message: "Enter a valid end date",
    });
  }

  if (begin && end && isValidIsoDate(begin) && isValidIsoDate(end) && end < begin) {
    errors.push({
      field: "injuryDateEnd",
      message: "End date must be on or after start date",
    });
  }

  return errors;
}

function validateCnrFields(body = {}) {
  const errors = [];

  if (!body.certificateNoRecords) {
    return errors;
  }

  const delivery = trimToString(body.cnrDelivery);

  if (delivery && !ALLOWED_CNR_DELIVERY.has(delivery)) {
    errors.push({ field: "cnrDelivery", message: "Invalid delivery method" });
  }

  if (
    delivery &&
    ALLOWED_CNR_DELIVERY.has(delivery) &&
    isBlank(body.cnrDateSent)
  ) {
    errors.push({
      field: "cnrDateSent",
      message: "Date is required for the selected delivery method",
    });
  }

  return errors;
}

function validateCreateOrder(body = {}) {
  return validateOrderPayload(body);
}

function validateUpdateOrder(body = {}) {
  return validateOrderPayload(body);
}

function validateOrderNote(body = {}) {
  const errors = [];
  const note = trimToString(body.note);

  if (!note) {
    errors.push({ field: "note", message: "Note text is required" });
  } else if (note.length > MAX_NOTE_LENGTH) {
    errors.push({
      field: "note",
      message: `Note cannot be more than ${MAX_NOTE_LENGTH} characters`,
    });
  }

  return { valid: errors.length === 0, errors };
}

function validateOrderFacilityUpdate(body = {}) {
  const errors = [];
  const facility = body.facility;

  if (isBlank(facility)) {
    errors.push({ field: "facility", message: "Facility is required" });
  } else if (Number.isNaN(Number(facility)) || Number(facility) <= 0) {
    errors.push({ field: "facility", message: "Facility is invalid" });
  }

  return { valid: errors.length === 0, errors };
}

function validateWorkflowStageUpdate(body = {}) {
  const errors = [];

  if (!WORKFLOW_STAGE_NAMES.includes(body.stageName)) {
    errors.push({ field: "stageName", message: "Invalid workflow stage" });
  }

  if (!WORKFLOW_STAGE_STATUSES.includes(body.stageStatus)) {
    errors.push({
      field: "stageStatus",
      message: "Invalid workflow stage status",
    });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateCreateOrder,
  validateUpdateOrder,
  validateOrderFacilityUpdate,
  validateOrderNote,
  validateWorkflowStageUpdate,
  ALLOWED_ORDER_TYPES,
  WORKFLOW_STAGE_NAMES,
  WORKFLOW_STAGE_STATUSES,
};
