const Invoice = require("../models/Invoice");
const InvoiceXray = require("../models/InvoiceXray");

function toNumber(value) {
  const number = Number(value);
  return Number.isNaN(number) ? 0 : number;
}

function hasStandardInvoiceFields(row = {}) {
  if (!row) return false;

  return (
    Boolean(row.invoice_date) ||
    toNumber(row.page_count) > 0 ||
    toNumber(row.clerical_time_hours) > 0 ||
    toNumber(row.clerical_hourly_rate) > 0 ||
    toNumber(row.shipping_handling) > 0 ||
    toNumber(row.storage_fee) > 0
  );
}

function hasXrayInvoiceFields(row = {}) {
  if (!row) return false;

  return (
    Boolean(row.xray_invoice_date) ||
    toNumber(row.view_count) > 0 ||
    toNumber(row.payment) > 0
  );
}

function isStandardInvoiceFullyPaid(invoice) {
  if (!invoice || !hasStandardInvoiceFields(invoice)) {
    return true;
  }

  if (invoice.status === "Written Off") {
    return false;
  }

  const total = toNumber(invoice.total_amount);
  if (total <= 0) {
    return false;
  }

  const paid = toNumber(invoice.amount_paid);
  const writeoff = toNumber(invoice.writeoff_amount);
  const due = Math.max(0, total - paid - writeoff);

  return invoice.status === "Paid" || due <= 0;
}

function isXrayInvoiceFullyPaid(xrayRow) {
  if (!xrayRow || !hasXrayInvoiceFields(xrayRow)) {
    return true;
  }

  if (xrayRow.status === "Written Off") {
    return false;
  }

  const total = toNumber(xrayRow.payment);
  if (total <= 0) {
    return false;
  }

  const paid = toNumber(xrayRow.amount_paid);
  const writeoff = toNumber(xrayRow.writeoff_amount);
  const due = Math.max(0, total - paid - writeoff);

  return xrayRow.status === "Paid" || due <= 0;
}

function isStandardInvoiceFullyWrittenOff(invoice) {
  if (!invoice || !hasStandardInvoiceFields(invoice)) {
    return true;
  }

  if (invoice.status !== "Written Off") {
    return false;
  }

  const total = toNumber(invoice.total_amount);
  const paid = toNumber(invoice.amount_paid);
  const writeoff = toNumber(invoice.writeoff_amount);
  const due = Math.max(0, total - paid - writeoff);

  return due <= 0;
}

function isXrayInvoiceFullyWrittenOff(xrayRow) {
  if (!xrayRow || !hasXrayInvoiceFields(xrayRow)) {
    return true;
  }

  if (xrayRow.status !== "Written Off") {
    return false;
  }

  const total = toNumber(xrayRow.payment);
  const paid = toNumber(xrayRow.amount_paid);
  const writeoff = toNumber(xrayRow.writeoff_amount);
  const due = Math.max(0, total - paid - writeoff);

  return due <= 0;
}

function areAllOrderInvoicesWrittenOffFromRows(invoice, xrayRow) {
  const hasStandard = hasStandardInvoiceFields(invoice);
  const hasXray = hasXrayInvoiceFields(xrayRow);

  if (!hasStandard && !hasXray) {
    return false;
  }

  if (hasStandard && !isStandardInvoiceFullyWrittenOff(invoice)) {
    return false;
  }

  if (hasXray && !isXrayInvoiceFullyWrittenOff(xrayRow)) {
    return false;
  }

  return true;
}

async function areAllOrderInvoicesPaid(orderId, connection = null) {
  const [invoice, xrayRow] = await Promise.all([
    Invoice.findByOrderId(orderId, connection),
    InvoiceXray.findByOrderId(orderId, connection),
  ]);

  const hasStandard = hasStandardInvoiceFields(invoice);
  const hasXray = hasXrayInvoiceFields(xrayRow);

  if (!hasStandard && !hasXray) {
    return false;
  }

  if (hasStandard && !isStandardInvoiceFullyPaid(invoice)) {
    return false;
  }

  if (hasXray && !isXrayInvoiceFullyPaid(xrayRow)) {
    return false;
  }

  return true;
}

async function areAllOrderInvoicesWrittenOff(orderId, connection = null) {
  const [invoice, xrayRow] = await Promise.all([
    Invoice.findByOrderId(orderId, connection),
    InvoiceXray.findByOrderId(orderId, connection),
  ]);

  return areAllOrderInvoicesWrittenOffFromRows(invoice, xrayRow);
}

module.exports = {
  hasStandardInvoiceFields,
  hasXrayInvoiceFields,
  isStandardInvoiceFullyPaid,
  isXrayInvoiceFullyPaid,
  isStandardInvoiceFullyWrittenOff,
  isXrayInvoiceFullyWrittenOff,
  areAllOrderInvoicesWrittenOffFromRows,
  areAllOrderInvoicesPaid,
  areAllOrderInvoicesWrittenOff,
};
