const {
  FIELD_LIMITS,
  trimToString,
  isBlank,
  isValidEmail,
  isValidPositiveIntId,
  addMaxLengthError,
  addRequiredDateOnlyError,
} = require("./validationHelpers");

const ALLOWED_INVOICE_TYPES = new Set(["regular", "xray"]);

function validateManualPayment(body = {}) {
  const errors = [];

  if (!isValidPositiveIntId(body.orderId)) {
    errors.push({ field: "orderId", message: "Order is required" });
  }

  const invoiceType = trimToString(body.invoiceType).toLowerCase();

  if (!invoiceType) {
    errors.push({ field: "invoiceType", message: "Invoice type is required" });
  } else if (!ALLOWED_INVOICE_TYPES.has(invoiceType)) {
    errors.push({
      field: "invoiceType",
      message: "Invoice type must be regular or xray",
    });
  }

  if (isBlank(body.checkNumber)) {
    errors.push({ field: "checkNumber", message: "Check number is required" });
  } else {
    addMaxLengthError(errors, "checkNumber", body.checkNumber, 50);
  }

  addRequiredDateOnlyError(
    errors,
    "paymentDate",
    body.paymentDate,
    "Payment date is required"
  );
  addMaxLengthError(errors, "note", body.note, FIELD_LIMITS.TEXT);

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateManualPayment,
  ALLOWED_INVOICE_TYPES,
};
