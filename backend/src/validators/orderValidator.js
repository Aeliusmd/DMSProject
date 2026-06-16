const ALLOWED_ORDER_TYPES = ["medical", "billing", "employment", "xrays"];
const WORKFLOW_STAGE_NAMES = ["Review Records", "Serve", "Custodian", "SENT"];
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

  if (!body.type?.trim()) {
    errors.push({ field: "type", message: "Type is required" });
  } else if (!ALLOWED_ORDER_TYPES.includes(body.type)) {
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

  return { valid: errors.length === 0, errors };
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
