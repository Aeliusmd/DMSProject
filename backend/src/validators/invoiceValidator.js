const {
  FIELD_LIMITS,
  trimToString,
  isBlank,
  isValidEmail,
  isValidIsoDate,
  isValidMoney,
  isValidNonNegativeNumber,
  isValidPositiveIntId,
  addMaxLengthError,
  addOptionalIsoDateError,
} = require("./validationHelpers");

const ALLOWED_WRITE_OFF_ACTIONS = new Set(["close_order", "keep_write_off"]);

function parseAmount(value) {
  const number = Number(`${value ?? ""}`.trim());
  return Number.isFinite(number) ? number : 0;
}

function calculateInvoiceTotal(body = {}) {
  const pageCount = Math.max(0, Math.floor(parseAmount(body.pages)));
  const perPageAmount = parseAmount(body.perPageAmount);
  const pagesAmount = pageCount * perPageAmount;
  const clericalTimeHours = Math.max(0, parseAmount(body.clericalTimeHours));
  const clericalHourlyRate = parseAmount(body.clericalHourlyRate);
  const clericalAmount = clericalTimeHours * clericalHourlyRate;
  const shippingHandling = parseAmount(body.shippingHandling);
  const storageFee = parseAmount(body.storageFee);

  return pagesAmount + clericalAmount + shippingHandling + storageFee;
}

function validateInvoicePayload(body = {}, { requireOrderId = false, blockZeroTotal = false } = {}) {
  const errors = [];

  if (requireOrderId) {
    if (!isValidPositiveIntId(body.orderId)) {
      errors.push({ field: "orderId", message: "Order is required" });
    }
  }

  if (isBlank(body.invoiceDate)) {
    errors.push({ field: "invoiceDate", message: "Invoice date is required" });
  } else if (!isValidIsoDate(body.invoiceDate)) {
    errors.push({ field: "invoiceDate", message: "Enter a valid invoice date" });
  }

  const moneyFields = [
    { field: "storageFee", label: "Storage fee" },
    { field: "perPageAmount", label: "Per page amount" },
    { field: "clericalHourlyRate", label: "Clerical hourly rate" },
    { field: "shippingHandling", label: "Shipping and handling" },
  ];

  moneyFields.forEach(({ field, label }) => {
    if (isBlank(body[field])) {
      errors.push({ field, message: `${label} is required` });
    } else if (!isValidMoney(body[field])) {
      errors.push({ field, message: "Enter a valid amount" });
    }
  });

  if (isBlank(body.pages)) {
    errors.push({ field: "pages", message: "Page count is required" });
  } else if (!isValidNonNegativeNumber(body.pages) || !Number.isInteger(Number(body.pages))) {
    errors.push({ field: "pages", message: "Enter a valid page count" });
  }

  if (isBlank(body.clericalTimeHours)) {
    errors.push({
      field: "clericalTimeHours",
      message: "Clerical time is required",
    });
  } else if (!isValidNonNegativeNumber(body.clericalTimeHours)) {
    errors.push({
      field: "clericalTimeHours",
      message: "Enter a valid clerical time",
    });
  }

  addMaxLengthError(errors, "notes", body.notes, FIELD_LIMITS.TEXT);
  addMaxLengthError(errors, "invoiceNumber", body.invoiceNumber, 50);

  if (!isBlank(body.prepaymentAmount) && !isValidMoney(body.prepaymentAmount)) {
    errors.push({
      field: "prepaymentAmount",
      message: "Enter a valid prepayment amount",
    });
  }

  if (blockZeroTotal && calculateInvoiceTotal(body) <= 0) {
    errors.push({
      field: "totalAmount",
      message: "Invoice total must be greater than zero",
    });
  }

  return { valid: errors.length === 0, errors };
}

function validateCreateInvoice(body = {}) {
  return validateInvoicePayload(body, {
    requireOrderId: true,
    blockZeroTotal: true,
  });
}

function validateUpdateInvoice(body = {}) {
  return validateInvoicePayload(body, { requireOrderId: false });
}

function validateXrayInvoice(body = {}) {
  const errors = [];

  if (!isValidPositiveIntId(body.orderId)) {
    errors.push({ field: "orderId", message: "Order is required" });
  }

  if (isBlank(body.xrayInvoiceDate)) {
    errors.push({
      field: "xrayInvoiceDate",
      message: "X-Ray invoice date is required",
    });
  } else if (!isValidIsoDate(body.xrayInvoiceDate)) {
    errors.push({
      field: "xrayInvoiceDate",
      message: "Enter a valid X-Ray invoice date",
    });
  }

  if (isBlank(body.views)) {
    errors.push({ field: "views", message: "View count is required" });
  } else if (!isValidNonNegativeNumber(body.views) || !Number.isInteger(Number(body.views))) {
    errors.push({ field: "views", message: "Enter a valid view count" });
  }

  if (isBlank(body.perViewAmount)) {
    errors.push({ field: "perViewAmount", message: "Per view amount is required" });
  } else if (!isValidMoney(body.perViewAmount)) {
    errors.push({ field: "perViewAmount", message: "Enter a valid amount" });
  }

  addOptionalIsoDateError(errors, "examDate", body.examDate);
  addMaxLengthError(errors, "checkNumber", body.checkNumber, 50);
  addMaxLengthError(errors, "description", body.description, FIELD_LIMITS.TEXT);

  return { valid: errors.length === 0, errors };
}

function validateInvoiceIds(body = {}, fieldName = "invoiceIds") {
  const errors = [];
  const ids = Array.isArray(body[fieldName]) ? body[fieldName] : [];

  if (!ids.length) {
    errors.push({
      field: fieldName,
      message: "At least one invoice is required",
    });
  } else {
    ids.forEach((id, index) => {
      if (!isValidPositiveIntId(id)) {
        errors.push({
          field: `${fieldName}.${index}`,
          message: "Invalid invoice id",
        });
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

function validateOrderIds(body = {}, fieldName = "orderIds") {
  const errors = [];
  const ids = Array.isArray(body[fieldName]) ? body[fieldName] : [];

  if (!ids.length) {
    errors.push({
      field: fieldName,
      message: "At least one order is required",
    });
  } else {
    ids.forEach((id, index) => {
      if (!isValidPositiveIntId(id)) {
        errors.push({
          field: `${fieldName}.${index}`,
          message: "Invalid order id",
        });
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

function validateRecipientEmails(body = {}, fieldName = "emails") {
  const errors = [];

  if (body[fieldName] === undefined || body[fieldName] === null) {
    return { valid: true, errors };
  }

  const emails = Array.isArray(body[fieldName]) ? body[fieldName] : [body[fieldName]];

  if (!emails.length) {
    errors.push({
      field: fieldName,
      message: "At least one recipient email is required",
    });
    return { valid: false, errors };
  }

  emails.forEach((email, index) => {
    const normalized = trimToString(email);
    if (!normalized) {
      errors.push({
        field: `${fieldName}.${index}`,
        message: "Email is required",
      });
    } else if (!isValidEmail(normalized)) {
      errors.push({
        field: `${fieldName}.${index}`,
        message: "Enter a valid email address",
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

function validateWriteOffInvoices(body = {}) {
  const errors = [];
  const items = Array.isArray(body.invoices) ? body.invoices : [];

  if (!items.length) {
    errors.push({
      field: "invoices",
      message: "No invoices selected for write off",
    });
  } else {
    items.forEach((item, index) => {
      const invoiceId = item?.invoiceId || item?.invoiceDbId || item?.id;

      if (!isValidPositiveIntId(invoiceId)) {
        errors.push({
          field: `invoices.${index}.invoiceId`,
          message: "Invoice is required",
        });
      }

      const writeOffAmount = item?.writeOffAmount ?? item?.dueAmount ?? body.amount;

      if (
        writeOffAmount !== undefined &&
        writeOffAmount !== null &&
        `${writeOffAmount}`.trim() !== "" &&
        !isValidMoney(writeOffAmount)
      ) {
        errors.push({
          field: `invoices.${index}.writeOffAmount`,
          message: "Enter a valid write off amount",
        });
      }
    });
  }

  if (
    body.orderAction !== undefined &&
    body.orderAction !== null &&
    `${body.orderAction}`.trim() !== "" &&
    !ALLOWED_WRITE_OFF_ACTIONS.has(body.orderAction)
  ) {
    errors.push({ field: "orderAction", message: "Invalid order action" });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateCreateInvoice,
  validateUpdateInvoice,
  validateXrayInvoice,
  validateInvoiceIds,
  validateOrderIds,
  validateRecipientEmails,
  validateWriteOffInvoices,
};
