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

module.exports = { validateStripeCheckout };
