const {
  FIELD_LIMITS,
  trimToString,
  getDigits,
  isBlank,
  isValidEmail,
  addMaxLengthError,
} = require("./validationHelpers");
const { addOrganizationNameFormatError, addNoHtmlMarkupErrors } = require("../utils/nameValidation");

function validateUpdateProvider(body = {}) {
  const errors = [];
  const companyName = trimToString(body.companyName ?? body.serveCompanyName);

  if (!companyName) {
    errors.push({
      field: "companyName",
      message: "Provider company name is required",
    });
  } else {
    addMaxLengthError(
      errors,
      "companyName",
      companyName,
      FIELD_LIMITS.VARCHAR_255
    );
    addOrganizationNameFormatError(errors, "companyName", companyName);
  }

  addMaxLengthError(errors, "address", body.address, FIELD_LIMITS.VARCHAR_255);
  addMaxLengthError(errors, "city", body.city, FIELD_LIMITS.VARCHAR_100);
  addNoHtmlMarkupErrors(errors, body, ["address", "city"]);

  const zip = trimToString(body.zipCode ?? body.zip);
  if (zip && getDigits(zip).length !== 5) {
    errors.push({ field: "zipCode", message: "ZIP must be 5 digits" });
  } else {
    addMaxLengthError(errors, "zipCode", zip, 20);
  }

  const state = trimToString(body.state);
  if (state && state.length !== 2) {
    errors.push({ field: "state", message: "State must be 2 letters" });
  } else {
    addMaxLengthError(errors, "state", state, 2);
  }

  const phone = trimToString(body.phone);
  if (phone && getDigits(phone).length !== 10) {
    errors.push({ field: "phone", message: "Enter a valid 10 digit number" });
  } else {
    addMaxLengthError(errors, "phone", phone, 20);
  }

  const fax = trimToString(body.fax);
  if (fax && getDigits(fax).length !== 10) {
    errors.push({ field: "fax", message: "Enter a valid 10 digit number" });
  } else {
    addMaxLengthError(errors, "fax", fax, 20);
  }

  const email = trimToString(body.email);
  if (!isBlank(email) && !isValidEmail(email)) {
    errors.push({ field: "email", message: "Enter a valid email address" });
  } else {
    addMaxLengthError(errors, "email", email, FIELD_LIMITS.VARCHAR_255);
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateUpdateProvider,
};
