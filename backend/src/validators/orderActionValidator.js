const { toSqlDateOnly } = require("../utils/dateUtils");
const {
  FIELD_LIMITS,
  trimToString,
  isValidEmail,
  isValidPositiveIntId,
  addMaxLengthError,
} = require("./validationHelpers");

const VALID_RECORD_TYPES = ["medical", "billing", "employment", "xrays", "other"];

function addRequiredDateError(errors, field, value, message) {
  if (!trimToString(value) || !toSqlDateOnly(value)) {
    errors.push({ field, message });
  }
}

function addOptionalDateError(errors, field, value) {
  if (trimToString(value) && !toSqlDateOnly(value)) {
    errors.push({ field, message: "Enter a valid date" });
  }
}

function validateMailRecipients(body = {}) {
  const errors = [];
  const emails = body.emails;

  if (Array.isArray(emails) && emails.length) {
    const validEmails = [];

    emails.forEach((value, index) => {
      const trimmed = trimToString(value);
      if (!trimmed) return;

      if (!isValidEmail(trimmed)) {
        errors.push({
          field: `emails.${index}`,
          message: "Enter a valid email address",
        });
      } else {
        validEmails.push(trimmed);
      }
    });

    if (!validEmails.length && !errors.length) {
      errors.push({
        field: "emails",
        message: "At least one recipient email is required",
      });
    }

    return { valid: errors.length === 0, errors };
  }

  const primary = trimToString(body.email);
  if (!primary || !isValidEmail(primary)) {
    errors.push({
      field: "email",
      message: "A valid company email is required",
    });
  }

  const additionalEmails = Array.isArray(body.additionalEmails)
    ? body.additionalEmails
    : [];

  additionalEmails.forEach((value, index) => {
    const trimmed = trimToString(value);
    if (!trimmed) return;

    if (!isValidEmail(trimmed)) {
      errors.push({
        field: `additionalEmails.${index}`,
        message: "Enter a valid email address",
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

function validateCancelOrder(body = {}) {
  const errors = [];
  const reason = trimToString(body.reason);

  if (!reason) {
    errors.push({ field: "reason", message: "Cancellation reason is required" });
  } else {
    addMaxLengthError(errors, "reason", reason, FIELD_LIMITS.TEXT);
  }

  return { valid: errors.length === 0, errors };
}

function validateMailWithOptionalDate(body = {}, dateField = "deliveryDate") {
  const recipientValidation = validateMailRecipients(body);
  if (!recipientValidation.valid) {
    return recipientValidation;
  }

  const errors = [];
  addOptionalDateError(errors, dateField, body[dateField]);

  return { valid: errors.length === 0, errors };
}

function validateMailWithSentDate(body = {}) {
  const recipientValidation = validateMailRecipients(body);
  if (!recipientValidation.valid) {
    return recipientValidation;
  }

  const errors = [];
  addOptionalDateError(errors, "sentDate", body.sentDate);

  return { valid: errors.length === 0, errors };
}

function validateCopyServiceLetter(body = {}) {
  return validateMailRecipients(body);
}

function validateRecordPickup(body = {}) {
  const errors = [];

  const pickupPersonName = trimToString(body.pickupPersonName);
  if (!pickupPersonName) {
    errors.push({
      field: "pickupPersonName",
      message: "Pickup person name is required",
    });
  } else {
    addMaxLengthError(
      errors,
      "pickupPersonName",
      pickupPersonName,
      FIELD_LIMITS.PERFORMER_NAME
    );
  }

  addRequiredDateError(
    errors,
    "pickupDate",
    body.pickupDate,
    "Pickup date is required"
  );
  addMaxLengthError(errors, "notes", body.notes, FIELD_LIMITS.TEXT);

  return { valid: errors.length === 0, errors };
}

function validateRecordFax(body = {}) {
  const errors = [];

  const faxNumber = trimToString(body.faxNumber);
  if (!faxNumber) {
    errors.push({ field: "faxNumber", message: "Fax number is required" });
  } else {
    addMaxLengthError(errors, "faxNumber", faxNumber, FIELD_LIMITS.VARCHAR_50);
  }

  addRequiredDateError(
    errors,
    "sentDate",
    body.sentDate,
    "Fax sent date is required"
  );
  addMaxLengthError(errors, "notes", body.notes, FIELD_LIMITS.TEXT);

  return { valid: errors.length === 0, errors };
}

function validateScanMedicalRecords(body = {}, query = {}, file = null) {
  const errors = [];

  if (!file) {
    errors.push({ field: "file", message: "PDF file is required" });
  }

  const recordType = trimToString(
    query.recordType || body.recordType || "medical"
  ).toLowerCase();

  if (!VALID_RECORD_TYPES.includes(recordType)) {
    errors.push({ field: "recordType", message: "Invalid record type" });
  }

  return { valid: errors.length === 0, errors };
}

function validateBatchScan(body = {}, file = null, userId = null) {
  const errors = [];

  if (!file) {
    errors.push({ field: "file", message: "No file uploaded" });
  }

  const uploadedBy = body.uploadedBy ?? userId;
  if (!isValidPositiveIntId(uploadedBy)) {
    errors.push({
      field: "uploadedBy",
      message: "uploadedBy is required (matrix employee id)",
    });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateMailRecipients,
  validateCancelOrder,
  validateMailWithOptionalDate,
  validateMailWithSentDate,
  validateCopyServiceLetter,
  validateRecordPickup,
  validateRecordFax,
  validateScanMedicalRecords,
  validateBatchScan,
};
