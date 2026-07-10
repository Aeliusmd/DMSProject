const {
  validateFacilityPayload,
  validateDoctorsPayload,
} = require("../lib/facilityValidation");
const { trimToString, isBlank, isValidPositiveIntId, addMaxLengthError } = require("./validationHelpers");
const {
  addNoHtmlMarkupError,
  addOrganizationNameFormatError,
  addPersonNameFormatError,
} = require("../utils/nameValidation");

const DOCUMENT_TYPES = new Set([
  "Standard",
  "Legal",
  "Medical",
  "Financial",
  "Other",
]);

const MAX_FACILITY_NOTE_LENGTH = 500;

function validateCreateFacility(body = {}) {
  return validateFacilityPayload(body);
}

function validateUpdateFacility(body = {}) {
  return validateFacilityPayload(body);
}

function validateResolveFacility(body = {}) {
  const errors = [];
  const facilityName = trimToString(body.facilityName);

  if (!facilityName) {
    errors.push({
      field: "facilityName",
      message: "Facility name is required",
    });
  } else {
    addMaxLengthError(errors, "facilityName", facilityName, 200);
    addOrganizationNameFormatError(errors, "facilityName", facilityName);
  }

  addMaxLengthError(errors, "address", body.address, 255);
  addMaxLengthError(errors, "city", body.city, 100);
  addMaxLengthError(errors, "zipCode", body.zipCode ?? body.zip, 20);
  addMaxLengthError(errors, "state", body.state, 2);

  return { valid: errors.length === 0, errors };
}

function validateCreateDoctors(body = {}) {
  const doctors = Array.isArray(body.doctors) ? body.doctors : [];

  if (!doctors.length) {
    return {
      valid: false,
      errors: [{ field: "doctors", message: "At least one doctor is required" }],
    };
  }

  return validateDoctorsPayload(doctors);
}

function validateUpdateDoctor(body = {}) {
  return validateDoctorsPayload([body]);
}

function validateCreateFacilityNote(body = {}) {
  const errors = [];
  const note = trimToString(body.note);

  if (!note) {
    errors.push({ field: "note", message: "Note is required" });
  } else if (note.length > MAX_FACILITY_NOTE_LENGTH) {
    errors.push({
      field: "note",
      message: `Note must be ${MAX_FACILITY_NOTE_LENGTH} characters or less`,
    });
  } else {
    addNoHtmlMarkupError(errors, "note", note);
  }

  return { valid: errors.length === 0, errors };
}

function validateResolveDoctor(body = {}) {
  const errors = [];
  const doctorName = trimToString(body.doctorName);

  if (
    body.doctorId !== undefined &&
    body.doctorId !== null &&
    `${body.doctorId}`.trim() !== "" &&
    !isValidPositiveIntId(body.doctorId)
  ) {
    errors.push({ field: "doctorId", message: "Invalid doctor id" });
  }

  if (doctorName) {
    addMaxLengthError(errors, "doctorName", doctorName, 200);
    addPersonNameFormatError(errors, "doctorName", doctorName);
  }

  return { valid: errors.length === 0, errors, doctorName };
}

function validateUploadFacilityDocument(body = {}, file) {
  const errors = [];

  if (!file) {
    errors.push({ field: "file", message: "A file is required" });
  }

  const documentType = trimToString(body.documentType);

  if (isBlank(documentType)) {
    errors.push({ field: "documentType", message: "Document type is required" });
  } else if (!DOCUMENT_TYPES.has(documentType)) {
    errors.push({ field: "documentType", message: "Invalid document type" });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateCreateFacility,
  validateUpdateFacility,
  validateResolveFacility,
  validateResolveDoctor,
  validateCreateDoctors,
  validateUpdateDoctor,
  validateCreateFacilityNote,
  validateFacilityNote: validateCreateFacilityNote,
  validateUploadFacilityDocument,
  validateDocumentUpload: validateUploadFacilityDocument,
  DOCUMENT_TYPES,
};
