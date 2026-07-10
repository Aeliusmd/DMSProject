const HTML_MARKUP_PATTERN = /[<>]/;

// Person names: letters, spaces, hyphen, apostrophe, period (O'Brien, Mary-Jane, Jr.)
const PERSON_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'.\- ]*$/u;

// Organizations / facilities / doctor labels: letters, digits, common business punctuation
const ORGANIZATION_NAME_PATTERN =
  /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9&.,'()#\-/ ]*$/u;

const FIELD_LABELS = {
  firstName: "First name",
  middleName: "Middle name",
  lastName: "Last name",
  aka: "AKA",
  defendant: "Defendant",
  serveCompanyName: "Company name",
  specificDoctor: "Specific doctor",
  facilityName: "Facility name",
  doctorName: "Doctor name",
  name: "Name",
  pickupPersonName: "Pickup person name",
  contact1Name: "Contact 1 name",
  contact1Title: "Contact 1 title",
  contact2Name: "Contact 2 name",
  contact2Title: "Contact 2 title",
  companyName: "Company name",
  address: "Address",
  city: "City",
  note: "Note",
  notes: "Notes",
  reason: "Cancellation reason",
  cnrReason: "CNR reason",
  description: "Description",
  invoiceNumber: "Invoice number",
  documentName: "Document name",
  specificRecord: "Specific record",
  court: "Court",
  caseNumber: "Case number",
  recNumber: "REC number",
  orderRef: "Order reference",
  fullAddress: "Full address",
  prepaymentMemo: "Prepayment memo",
  custodianMemo: "Custodian memo",
  xrayMemo: "X-Ray memo",
  q: "Search",
  orderId: "Order ID",
};

function trimToString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatFieldLabel(field, fallback = "This field") {
  if (!field) return fallback;

  const normalized = `${field}`.split(".").pop();
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  if (FIELD_LABELS[normalized]) return FIELD_LABELS[normalized];

  return `${normalized}`
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

function htmlMarkupMessage(field) {
  return `${formatFieldLabel(field)} cannot contain angle brackets or HTML tags`;
}

function personNameFormatMessage(field) {
  const label = formatFieldLabel(field);
  return `${label} can only contain letters, spaces, hyphens, apostrophes, and periods`;
}

function organizationNameFormatMessage(field) {
  const label = formatFieldLabel(field);
  return `${label} can only contain letters, numbers, spaces, and &.,'()#-/`;
}

function isValidPersonName(value) {
  const trimmed = trimToString(value);
  if (!trimmed || HTML_MARKUP_PATTERN.test(trimmed)) return false;
  return PERSON_NAME_PATTERN.test(trimmed);
}

function isValidOrganizationName(value) {
  const trimmed = trimToString(value);
  if (!trimmed || HTML_MARKUP_PATTERN.test(trimmed)) return false;
  return ORGANIZATION_NAME_PATTERN.test(trimmed);
}

function hasHtmlMarkup(value) {
  return HTML_MARKUP_PATTERN.test(String(value ?? ""));
}

function addPersonNameFormatError(errors, field, value) {
  const trimmed = trimToString(value);
  if (!trimmed || isValidPersonName(trimmed)) return;

  if (hasHtmlMarkup(trimmed)) {
    errors.push({ field, message: htmlMarkupMessage(field) });
    return;
  }

  errors.push({ field, message: personNameFormatMessage(field) });
}

function addOrganizationNameFormatError(errors, field, value) {
  const trimmed = trimToString(value);
  if (!trimmed || isValidOrganizationName(trimmed)) return;

  if (hasHtmlMarkup(trimmed)) {
    errors.push({ field, message: htmlMarkupMessage(field) });
    return;
  }

  errors.push({ field, message: organizationNameFormatMessage(field) });
}

function addNoHtmlMarkupError(errors, field, value) {
  const trimmed = trimToString(value);
  if (!trimmed || !hasHtmlMarkup(trimmed)) return;

  errors.push({ field, message: htmlMarkupMessage(field) });
}

function addNoHtmlMarkupErrors(errors, body, fields = []) {
  fields.forEach((field) => addNoHtmlMarkupError(errors, field, body?.[field]));
}

module.exports = {
  FIELD_LABELS,
  formatFieldLabel,
  htmlMarkupMessage,
  personNameFormatMessage,
  organizationNameFormatMessage,
  isValidPersonName,
  isValidOrganizationName,
  hasHtmlMarkup,
  addPersonNameFormatError,
  addOrganizationNameFormatError,
  addNoHtmlMarkupError,
  addNoHtmlMarkupErrors,
};
