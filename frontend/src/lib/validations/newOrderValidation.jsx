export const immediateRequiredFields = [
  "facility",
  "type",
  "firstName",
  "lastName",
  "serveCompanyName",
];

export const emailFields = ["email", "contact1Email", "contact2Email"];

export const phoneFields = [
  "phone",
  "fax",
  "contact1Phone",
  "contact1Fax",
  "contact2Phone",
  "contact2Fax",
];

export const numericOnlyFields = [
  "prepaymentCheck",
  "custodianCheck",
  "xrayCheck",
];

export const moneyFields = [
  "prepaymentPaid",
  "custodianPaid",
  "custodianDue",
  "xrayPaid",
  "xrayDue",
];

export const paymentPrefixes = ["prepayment", "custodian", "xray"];

export function validateNewOrderForm(data, fileErrors = {}) {
  const errors = {};

  if (!data.facility) errors.facility = "Facility is required";
  if (!data.type) errors.type = "Type is required";
  if (!data.firstName.trim()) errors.firstName = "First name is required";
  if (!data.lastName.trim()) errors.lastName = "Last name is required";

  if (!data.serveCompanyName.trim()) {
    errors.serveCompanyName = "Company name is required";
  }

  if (data.ssn && !isValidSSN(data.ssn)) {
    errors.ssn = "Enter SSN as XXX-XX-1234";
  }

  if (data.dob && isFutureDate(data.dob)) {
    errors.dob = "DOB cannot be in the future";
  }

  if (data.zip && data.zip.length !== 5) {
    errors.zip = "ZIP must be 5 digits";
  }

  if (data.state && data.state.length !== 2) {
    errors.state = "State must be 2 letters";
  }

  emailFields.forEach((field) => {
    if (data[field] && !isValidEmail(data[field])) {
      errors[field] = "Enter a valid email address";
    }
  });

  phoneFields.forEach((field) => {
    if (data[field] && getDigits(data[field]).length !== 10) {
      errors[field] = "Enter a valid 10 digit number";
    }
  });

  paymentPrefixes.forEach((prefix) => {
    const checkField = `${prefix}Check`;
    const paidField = `${prefix}Paid`;

    if (data[checkField] && !/^\d+$/.test(data[checkField])) {
      errors[checkField] = "Check number must contain only numbers";
    }

    if (data[paidField] && !isValidMoney(data[paidField])) {
      errors[paidField] = "Enter a valid amount";
    }
  });

  if (data.documentName && !data.additionalDocumentFile) {
    errors.additionalDocumentFile = "Please choose a document file";
  }

  if (fileErrors.subpoenaFile) {
    errors.subpoenaFile = fileErrors.subpoenaFile;
  }

  if (fileErrors.additionalDocumentFile) {
    errors.additionalDocumentFile = fileErrors.additionalDocumentFile;
  }

  if (data.injuryType === "cumulative") {
    if (!data.injuryDateBegin) {
      errors.injuryDateBegin = "Start date is required";
    }

    if (!data.injuryDateEnd) {
      errors.injuryDateEnd = "End date is required";
    }

    if (
      data.injuryDateBegin &&
      data.injuryDateEnd &&
      data.injuryDateEnd < data.injuryDateBegin
    ) {
      errors.injuryDateEnd = "End date must be on or after start date";
    }
  }

  if (data.injuryType === "specific" && !data.injuryDate) {
    errors.injuryDate = "Injury date is required";
  }

  if (
    data.certificateNoRecords &&
    data.cnrDelivery &&
    ["email", "fax", "pickup"].includes(data.cnrDelivery) &&
    !data.cnrDateSent
  ) {
    errors.cnrDateSent = "Date is required for the selected delivery method";
  }

  return errors;
}

export function validateFile(file) {
  if (!file) return "";

  const allowedTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
  ];

  const maxSize = 10 * 1024 * 1024;

  if (!allowedTypes.includes(file.type)) {
    return "Only PDF, Word, JPG, or PNG files are allowed";
  }

  if (file.size > maxSize) {
    return "File size must be less than 10MB";
  }

  return "";
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function isValidSSN(ssn) {
  const trimmed = String(ssn || "").trim();
  if (/^XXX-XX-\d{4}$/i.test(trimmed)) return true;
  return /^\d{3}-\d{2}-\d{4}$/.test(trimmed);
}

export function isValidMoney(value) {
  return /^\d+(\.\d{1,2})?$/.test(value);
}

export function isFutureDate(dateValue) {
  const selectedDate = new Date(dateValue);
  const today = new Date();

  selectedDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return selectedDate > today;
}

export function getDigits(value) {
  return value.replace(/\D/g, "");
}

export function formatPhone(value) {
  const digits = getDigits(value).slice(0, 10);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function formatSSN(value) {
  const digits = getDigits(value).slice(0, 9);

  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

export function formatMaskedSSN(value) {
  const digits = getDigits(value);
  if (digits.length < 4) return "";

  return `XXX-XX-${digits.slice(-4)}`;
}

export function formatMoneyInput(value) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");

  if (parts.length === 1) return parts[0];

  return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
}