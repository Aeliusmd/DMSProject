import {
  validatePersonName,
  validateNoHtmlMarkup,
} from "@/lib/validations/nameValidation";

const MM_DD_YYYY = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DRIVER_LICENSE_PATTERN = /^[A-Za-z0-9-]{4,20}$/;

export const RECORD_TYPE_OPTIONS = [
  { id: "medical", label: "Medical Records" },
  { id: "billing", label: "Billing Records" },
  { id: "xrays", label: "X-Ray / Imaging" },
];

/** Convert HTML date input (YYYY-MM-DD) to MM/DD/YYYY for API */
export function isoDateToDisplay(iso) {
  if (!iso || !ISO_DATE.test(iso)) return "";
  const [year, month, day] = iso.split("-");
  return `${month}/${day}/${year}`;
}

export function toApiDate(value) {
  const trimmed = `${value || ""}`.trim();
  if (ISO_DATE.test(trimmed)) return isoDateToDisplay(trimmed);
  if (MM_DD_YYYY.test(trimmed)) return trimmed;
  return "";
}

export function isValidFormDate(value) {
  const trimmed = `${value || ""}`.trim();
  if (ISO_DATE.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  if (!MM_DD_YYYY.test(trimmed)) return false;
  const [month, day, year] = trimmed.split("/").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function parseComparableDate(value) {
  const api = toApiDate(value);
  if (!api) return null;
  const [month, day, year] = api.split("/").map(Number);
  return new Date(year, month - 1, day);
}

export function validatePersonalRequestForm(data, { emailVerified = false } = {}) {
  const errors = {};

  if (!emailVerified) {
    errors.email = "Verify your email before continuing";
  }

  if (!data.firstName?.trim()) {
    errors.firstName = "First name is required";
  } else {
    const err = validatePersonName(data.firstName, { fieldLabel: "First name" });
    if (err) errors.firstName = err;
  }

  if (!data.lastName?.trim()) {
    errors.lastName = "Last name is required";
  } else {
    const err = validatePersonName(data.lastName, { fieldLabel: "Last name" });
    if (err) errors.lastName = err;
  }

  if (!isValidFormDate(data.dob)) {
    errors.dob = "Date of birth is required";
  }

  if (data.treatingFacilityName?.trim()) {
    const err = validateNoHtmlMarkup(data.treatingFacilityName, {
      fieldLabel: "Treating facility name",
    });
    if (err) errors.treatingFacilityName = err;
  }

  if (!data.treatingFacilityAddress?.trim()) {
    errors.treatingFacilityAddress = "Treating facility address is required";
  } else {
    const err = validateNoHtmlMarkup(data.treatingFacilityAddress, {
      fieldLabel: "Treating facility address",
    });
    if (err) errors.treatingFacilityAddress = err;
  }

  if (!isValidFormDate(data.recordsDateBegin)) {
    errors.recordsDateBegin = "Records from date is required";
  }

  if (!isValidFormDate(data.recordsDateEnd)) {
    errors.recordsDateEnd = "Records to date is required";
  }

  const begin = parseComparableDate(data.recordsDateBegin);
  const end = parseComparableDate(data.recordsDateEnd);
  if (begin && end && end < begin) {
    errors.recordsDateEnd = "End date must be on or after start date";
  }

  if (data.treatingDoctor?.trim()) {
    const err = validateNoHtmlMarkup(data.treatingDoctor, {
      fieldLabel: "Treating doctor",
    });
    if (err) errors.treatingDoctor = err;
  }

  const selectedTypes = RECORD_TYPE_OPTIONS.filter(
    (opt) => data.recordTypes?.[opt.id]
  );
  if (!selectedTypes.length) {
    errors.recordTypes = "Select at least one record type";
  }

  const delivery = `${data.deliveryPreference || "download"}`.toLowerCase();
  if (delivery !== "download" && delivery !== "mail") {
    errors.deliveryPreference = "Select download or mail delivery";
  }

  if (delivery === "mail") {
    if (!data.mailAddress?.trim()) {
      errors.mailAddress = "Mailing address is required for mail delivery";
    } else {
      const err = validateNoHtmlMarkup(data.mailAddress, {
        fieldLabel: "Mailing address",
      });
      if (err) errors.mailAddress = err;
    }
  } else if (data.mailAddress?.trim()) {
    const err = validateNoHtmlMarkup(data.mailAddress, {
      fieldLabel: "Mailing address",
    });
    if (err) errors.mailAddress = err;
  }

  if (!data.driverLicenseNumber?.trim()) {
    errors.driverLicenseNumber = "Driver's license number is required";
  } else if (!DRIVER_LICENSE_PATTERN.test(data.driverLicenseNumber.trim())) {
    errors.driverLicenseNumber =
      "Enter a valid license number (4–20 letters or numbers)";
  }

  if (!data.driverLicenseFile) {
    errors.driverLicenseFile = "Upload a copy of your driver's license";
  }

  return errors;
}

export function validateStatusLookupForm(data) {
  const errors = {};
  const ref = `${data.confirmationReference || ""}`.trim();
  const dob = String(data.dob || "").trim();

  if (!ref) {
    errors.confirmationReference = "Enter your order / confirmation number";
  } else {
    const err = validateNoHtmlMarkup(ref, {
      fieldLabel: "Confirmation number",
    });
    if (err) errors.confirmationReference = err;
  }

  if (!dob) {
    errors.dob = "Date of birth is required";
  } else if (
    !/^\d{4}-\d{2}-\d{2}$/.test(dob) &&
    !/^\d{2}\/\d{2}\/\d{4}$/.test(dob)
  ) {
    errors.dob = "Enter date of birth as MM/DD/YYYY";
  }

  return errors;
}

export function formatDobForApi(dob) {
  const value = String(dob || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${month}/${day}/${year}`;
  }
  return value;
}
