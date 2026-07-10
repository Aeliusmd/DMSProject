const { trimToString } = require("./validationHelpers");

function validateStripeCheckout(body = {}) {
  const errors = [];
  const invoiceType = trimToString(body.invoiceType).toLowerCase();

  if (!["regular", "xray"].includes(invoiceType)) {
    errors.push({
      field: "invoiceType",
      message: "invoiceType must be regular or xray",
    });
  }

  return { valid: errors.length === 0, errors };
}

function validateStripeReceiptDownload(params = {}, query = {}) {
  const errors = [];
  const sessionId = trimToString(params.sessionId);
  const token = trimToString(query.token);

  if (!sessionId) {
    errors.push({ field: "sessionId", message: "sessionId is required" });
  } else if (sessionId.length > 255) {
    errors.push({ field: "sessionId", message: "sessionId is too long" });
  }

  if (!token) {
    errors.push({ field: "token", message: "token is required" });
  } else if (token.length > 128) {
    errors.push({ field: "token", message: "token is too long" });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateStripeCheckout, validateStripeReceiptDownload };
