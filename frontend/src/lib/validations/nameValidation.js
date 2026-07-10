const HTML_MARKUP_PATTERN = /[<>]/;
const PERSON_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}'.\- ]*$/u;
const ORGANIZATION_NAME_PATTERN =
  /^[\p{L}\p{M}0-9][\p{L}\p{M}0-9&.,'()#\-/ ]*$/u;

export const FIELD_LABELS = {
  firstName: "First name",
  middleName: "Middle name",
  lastName: "Last name",
  aka: "AKA",
  defendant: "Defendant",
  serveCompanyName: "Company name",
  specificDoctor: "Specific doctor",
  facilityName: "Facility name",
  address: "Address",
  city: "City",
  specificRecord: "Specific record",
  court: "Court",
  caseNumber: "Case number",
  recNumber: "REC number",
  orderRef: "Order reference",
  fullAddress: "Full address",
  documentName: "Document name",
  cnrReason: "CNR reason",
  prepaymentMemo: "Prepayment memo",
  custodianMemo: "Custodian memo",
  xrayMemo: "X-Ray memo",
  note: "Note",
  noteText: "Note text",
  notes: "Notes",
  description: "Description",
  reason: "Cancellation reason",
  name: "Name",
  pickupPersonName: "Pickup person name",
};

export function formatFieldLabel(field, fallback = "This field") {
  if (!field) return fallback;
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  return `${field}`
    .replace(/\./g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

export function isValidPersonName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed || HTML_MARKUP_PATTERN.test(trimmed)) return false;
  return PERSON_NAME_PATTERN.test(trimmed);
}

export function isValidOrganizationName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed || HTML_MARKUP_PATTERN.test(trimmed)) return false;
  return ORGANIZATION_NAME_PATTERN.test(trimmed);
}

export function hasHtmlMarkup(value) {
  return HTML_MARKUP_PATTERN.test(String(value ?? ""));
}

export function htmlMarkupError(fieldLabel = "This field") {
  return `${fieldLabel} cannot contain angle brackets or HTML tags`;
}

export function personNameFormatError(fieldLabel = "Name") {
  return `${fieldLabel} can only contain letters, spaces, hyphens, apostrophes, and periods`;
}

export function organizationNameFormatError(fieldLabel = "Name") {
  return `${fieldLabel} can only contain letters, numbers, spaces, and &.,'()#-/`;
}

export function validatePersonName(
  value,
  { required = false, fieldLabel = "Name" } = {}
) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return required ? `${fieldLabel} is required` : "";
  if (hasHtmlMarkup(trimmed)) return htmlMarkupError(fieldLabel);
  if (!isValidPersonName(trimmed)) return personNameFormatError(fieldLabel);
  return "";
}

export function validateOrganizationName(
  value,
  { required = false, fieldLabel = "Name" } = {}
) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return required ? `${fieldLabel} is required` : "";
  if (hasHtmlMarkup(trimmed)) return htmlMarkupError(fieldLabel);
  if (!isValidOrganizationName(trimmed)) {
    return organizationNameFormatError(fieldLabel);
  }
  return "";
}

export function validateNoHtmlMarkup(
  value,
  { required = false, fieldLabel = "This field" } = {}
) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return required ? `${fieldLabel} is required` : "";
  if (hasHtmlMarkup(trimmed)) return htmlMarkupError(fieldLabel);
  return "";
}

export function addNoHtmlMarkupFieldErrors(errors, data, fieldLabels = {}) {
  Object.entries(fieldLabels).forEach(([field, label]) => {
    const message = validateNoHtmlMarkup(data?.[field], {
      fieldLabel: label || formatFieldLabel(field),
    });
    if (message) errors[field] = message;
  });
}
