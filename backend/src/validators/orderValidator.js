function validateCreateOrder(body = {}) {
  const errors = [];

  if (!body.facility?.trim()) {
    errors.push({ field: "facility", message: "Facility is required" });
  }

  if (!body.type?.trim()) {
    errors.push({ field: "type", message: "Type is required" });
  }

  if (!body.firstName?.trim()) {
    errors.push({ field: "firstName", message: "First name is required" });
  }

  if (!body.lastName?.trim()) {
    errors.push({ field: "lastName", message: "Last name is required" });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateCreateOrder };
