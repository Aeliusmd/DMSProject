const ALLOWED_ORDER_TYPES = ["medical", "billing", "employment", "xrays", "other"];
const ALLOWED_INJURY_TYPES = ["specific", "cumulative"];
const WORKFLOW_STAGE_NAMES = [
  "Review Records",
  "Serve",
  "Custodian",
  "SENT",
];
const WORKFLOW_STAGE_STATUSES = ["pending", "complete", "failed", "sent"];
const MAX_NOTE_LENGTH = 1000;

function validateOrderPayload(body = {}) {
  const errors = [];

  const facility = body.facility;

  if (facility === undefined || facility === null || `${facility}`.trim() === "") {
    errors.push({ field: "facility", message: "Facility is required" });
  } else if (Number.isNaN(Number(facility))) {
    errors.push({ field: "facility", message: "Facility is invalid" });
  }

  const recordTypes = [
    body.medicalRecords,
    body.billingRecords,
    body.employmentRecords,
    body.xrays,
    body.otherRecord,
  ].filter(Boolean);

  if (!recordTypes.length && !body.type?.trim()) {
    errors.push({
      field: "type",
      message: "At least one record type is required",
    });
  } else if (
    body.type?.trim() &&
    !ALLOWED_ORDER_TYPES.includes(body.type.trim())
  ) {
    errors.push({ field: "type", message: "Type is invalid" });
  }

  if (!body.firstName?.trim()) {
    errors.push({ field: "firstName", message: "First name is required" });
  }

  if (!body.lastName?.trim()) {
    errors.push({ field: "lastName", message: "Last name is required" });
  }

  if (!body.serveCompanyName?.trim()) {
    errors.push({ field: "serveCompanyName", message: "Company name is required" });
  }

  if (!body.specificDoctor?.trim()) {
    errors.push({ field: "specificDoctor", message: "Specific doctor is required" });
  }

  errors.push(...validateInjuryFields(body));

  return { valid: errors.length === 0, errors };
}

function validateInjuryFields(body = {}) {
  const errors = [];
  const injuryType = `${body.injuryType || ""}`.trim();

  if (!injuryType || !ALLOWED_INJURY_TYPES.includes(injuryType)) {
    return errors;
  }

  if (injuryType === "specific") {
    if (!`${body.injuryDate || ""}`.trim()) {
      errors.push({ field: "injuryDate", message: "Injury date is required" });
    }
    return errors;
  }

  const begin = `${body.injuryDateBegin || ""}`.trim();
  const end = `${body.injuryDateEnd || ""}`.trim();

  if (!begin) {
    errors.push({
      field: "injuryDateBegin",
      message: "Start date is required",
    });
  }

  if (!end) {
    errors.push({
      field: "injuryDateEnd",
      message: "End date is required",
    });
  }

  if (begin && end && end < begin) {
    errors.push({
      field: "injuryDateEnd",
      message: "End date must be on or after start date",
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

  const note = typeof body.note === "string" ? body.note.trim() : "";

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
  validateOrderNote,
  validateWorkflowStageUpdate,
  ALLOWED_ORDER_TYPES,
  WORKFLOW_STAGE_NAMES,
  WORKFLOW_STAGE_STATUSES,
};
