const {
  trimToString,
  getDigits,
  isValidEmail,
  addMaxLengthError,
  isBlank,
  getSsnValidationError,
} = require("./validationHelpers");
const { sanitizeText } = require("../utils/sanitize");
const {
  normalizeRecordTypeFlags,
  hasAnyRecordType,
  formatRecordTypesLabel,
} = require("../utils/companyPortalRecordTypes");
const {
  addNoHtmlMarkupError,
  addNoHtmlMarkupErrors,
  addPersonNameFormatError,
  addOrganizationNameFormatError,
} = require("../utils/nameValidation");
const {
  ZIP_VALIDATION_MESSAGE,
  isValidZip,
  sanitizeZip,
  sanitizeZipOrNull,
} = require("../utils/zipUtils");

function sanitizeField(value, maxLength) {
  return sanitizeText(value, { maxLength, allowEmpty: true });
}

function optionalDateOrNull(value) {
  const trimmed = trimToString(value);
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

function normalizeZip(value) {
  return sanitizeZipOrNull(value);
}

function validateStateZipPair(errors, { state, zip, stateField, zipField, required }) {
  if (required && !state) {
    errors.push({ field: stateField, message: "State is required" });
  } else if (state && !/^[A-Z]{2}$/.test(state)) {
    errors.push({ field: stateField, message: "State must be 2 letters" });
  }

  if (required && !getDigits(zip)) {
    errors.push({ field: zipField, message: "ZIP code is required" });
  } else if (zip && !isValidZip(zip)) {
    errors.push({ field: zipField, message: ZIP_VALIDATION_MESSAGE });
  }
}

function validateCompanyPortalOrderDetails(body = {}, { requireFacility = true } = {}) {
  const errors = [];

  addNoHtmlMarkupErrors(errors, body, [
    "facilityName",
    "treatingFacilityName",
    "facilityAddress",
    "treatingFacilityAddress",
    "address",
    "facilityCity",
    "city",
    "facilityState",
    "state",
    "facilityZip",
    "zip",
    "zipCode",
    "companyName",
    "companyAddress",
    "companyCity",
    "companyState",
    "companyZip",
    "treatingDoctor",
    "specificDoctor",
    "doctor",
    "applicantName",
    "caseName",
    "caseNumber",
    "orderNumber",
    "recNumber",
    "ssn",
    "dateOfInjuryText",
    "doctorAddress",
    "requestedRecord",
    "contactEmail",
    "email",
  ]);

  const facilityName = sanitizeField(
    body.facilityName || body.treatingFacilityName,
    255
  );
  const facilityAddress = sanitizeField(
    body.facilityAddress || body.treatingFacilityAddress || body.address,
    255
  );
  const facilityCity = sanitizeField(body.facilityCity || body.city, 100);
  const facilityState = sanitizeField(body.facilityState || body.state, 2).toUpperCase();
  const facilityZip = sanitizeZip(body.facilityZip || body.zip || body.zipCode);

  const companyName = sanitizeField(body.companyName, 255);
  const companyAddress = sanitizeField(body.companyAddress, 255);
  const companyCity = sanitizeField(body.companyCity, 100);
  const companyState = sanitizeField(body.companyState, 2).toUpperCase();
  const companyZip = sanitizeZip(body.companyZip);

  const treatingDoctor = sanitizeField(
    body.treatingDoctor || body.specificDoctor || body.doctor,
    255
  );
  const applicantName = sanitizeField(body.applicantName, 255);
  const caseName = sanitizeField(body.caseName, 255);
  const caseNumber = sanitizeField(body.caseNumber || body.orderNumber, 50);
  const recNumber = sanitizeField(body.recNumber, 50);
  const ssn = sanitizeField(body.ssn, 11);
  const dateOfBirth = optionalDateOrNull(body.dateOfBirth);
  const dateOfInjury = optionalDateOrNull(body.dateOfInjury);
  const dateOfInjuryText = sanitizeField(body.dateOfInjuryText, 100);
  const doctorAddress = sanitizeField(body.doctorAddress, 500);
  const requestedRecord = sanitizeField(body.requestedRecord, 4000);
  const subpoenaDate = optionalDateOrNull(body.subpoenaDate);
  const dateRequested = optionalDateOrNull(body.dateRequested);
  const depoDueDate = optionalDateOrNull(body.depoDueDate);
  const contactEmail = sanitizeField(body.contactEmail || body.email, 255).toLowerCase();
  const contactPhoneDigits = getDigits(body.contactPhone || body.phone);

  const facilitySelectionMode = sanitizeField(body.facilitySelectionMode, 20)
    .trim()
    .toLowerCase();
  const internalFacilityIdRaw = Number(body.internalFacilityId);
  const internalFacilityId =
    Number.isFinite(internalFacilityIdRaw) && internalFacilityIdRaw > 0
      ? internalFacilityIdRaw
      : null;
  const requestNewFacilitySearch = Boolean(body.requestNewFacilitySearch);

  const recordFlags = normalizeRecordTypeFlags(body);

  if (requireFacility) {
    if (!hasAnyRecordType(recordFlags)) {
      errors.push({
        field: "type",
        message: "Select at least one record type",
      });
    }

    if (!caseNumber) {
      errors.push({
        field: "caseNumber",
        message: "Order number is required",
      });
    }

    if (requestNewFacilitySearch && facilitySelectionMode === "existing") {
      errors.push({
        field: "facilitySelectionMode",
        message: "Choose either an existing facility or a new facility search",
      });
    }

    if (requestNewFacilitySearch || facilitySelectionMode === "new") {
      if (!facilityAddress) {
        errors.push({
          field: "facilityAddress",
          message: "Facility street address is required",
        });
      }
      if (!facilityCity) {
        errors.push({ field: "facilityCity", message: "City is required" });
      }
      validateStateZipPair(errors, {
        state: facilityState,
        zip: facilityZip,
        stateField: "facilityState",
        zipField: "facilityZip",
        required: true,
      });
    } else if (facilitySelectionMode === "existing") {
      if (!internalFacilityId) {
        errors.push({
          field: "internalFacilityId",
          message: "Select a facility from the list",
        });
      }
      if (
        !facilityAddress ||
        !facilityCity ||
        !facilityState ||
        !normalizeZip(facilityZip)
      ) {
        errors.push({
          field: "facilitySelectionMode",
          message: "Selected facility is missing address details",
        });
      }
    } else {
      errors.push({
        field: "facilitySelectionMode",
        message: "Select an existing facility or request a new facility search",
      });
    }
  } else {
    validateStateZipPair(errors, {
      state: facilityState,
      zip: facilityZip,
      stateField: "facilityState",
      zipField: "facilityZip",
      required: false,
    });
  }

  if (companyState || companyZip) {
    validateStateZipPair(errors, {
      state: companyState,
      zip: companyZip,
      stateField: "companyState",
      zipField: "companyZip",
      required: false,
    });
  }

  if (facilityName) {
    addMaxLengthError(errors, "facilityName", facilityName, 255);
    addOrganizationNameFormatError(errors, "facilityName", facilityName);
  }
  if (facilityAddress) {
    addMaxLengthError(errors, "facilityAddress", facilityAddress, 500);
  }
  if (facilityCity) addMaxLengthError(errors, "facilityCity", facilityCity, 100);
  if (companyName) {
    addMaxLengthError(errors, "companyName", companyName, 255);
    addOrganizationNameFormatError(errors, "companyName", companyName);
  }
  if (treatingDoctor) {
    addMaxLengthError(errors, "treatingDoctor", treatingDoctor, 255);
    addPersonNameFormatError(errors, "treatingDoctor", treatingDoctor);
  }
  if (applicantName) {
    addMaxLengthError(errors, "applicantName", applicantName, 255);
    addPersonNameFormatError(errors, "applicantName", applicantName);
  }
  if (companyAddress) {
    addMaxLengthError(errors, "companyAddress", companyAddress, 500);
  }

  if (contactEmail && !isValidEmail(contactEmail)) {
    errors.push({ field: "contactEmail", message: "Enter a valid email address" });
  }

  if (body.dateOfBirth && !dateOfBirth) {
    errors.push({ field: "dateOfBirth", message: "Enter a valid date" });
  }
  if (body.dateOfInjury && !dateOfInjury && isBlank(body.dateOfInjuryText)) {
    errors.push({ field: "dateOfInjury", message: "Enter a valid date" });
  }
  if (body.dateRequested && !dateRequested) {
    errors.push({ field: "dateRequested", message: "Enter a valid date" });
  }
  if (body.subpoenaDate && !subpoenaDate) {
    errors.push({ field: "subpoenaDate", message: "Enter a valid date" });
  }

  if (ssn) {
    const ssnError = getSsnValidationError(ssn);
    if (ssnError) {
      errors.push({ field: "ssn", message: ssnError });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    data: {
      facilityName,
      facilityAddress,
      facilityCity: facilityCity || null,
      facilityState: facilityState || null,
      facilityZip: normalizeZip(facilityZip),
      treatingDoctor: treatingDoctor || null,
      applicantName: applicantName || null,
      caseName: caseName || null,
      caseNumber: caseNumber || null,
      recNumber: recNumber || null,
      ssn: ssn || null,
      dateOfBirth,
      dateOfInjury,
      dateOfInjuryText: dateOfInjuryText || null,
      companyName: companyName || null,
      companyAddress: companyAddress || null,
      companyCity: companyCity || null,
      companyState: companyState || null,
      companyZip: normalizeZip(companyZip),
      doctorAddress: doctorAddress || null,
      recordType: formatRecordTypesLabel(recordFlags) || null,
      requestedRecord: requestedRecord || null,
      ...recordFlags,
      subpoenaDate,
      dateRequested,
      depoDueDate,
      contactEmail: contactEmail || null,
      contactPhone: contactPhoneDigits || null,
      facilitySelectionMode: facilitySelectionMode || null,
      internalFacilityId,
      requestNewFacilitySearch,
    },
  };
}

module.exports = {
  validateCompanyPortalOrderDetails,
};
