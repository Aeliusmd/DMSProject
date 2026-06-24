export function parseInvoiceDueAmount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function canWriteOffInvoice(invoice) {
  if (!invoice || invoice.invoiceType === "xray") {
    return false;
  }

  if (
    invoice.isWrittenOff ||
    invoice.status === "Written Off" ||
    invoice.status === "Write Offs"
  ) {
    return false;
  }

  return true;
}

export function canSendInvoice(invoice) {
  if (!invoice) {
    return false;
  }

  return !invoice.isSent;
}

export function canResendInvoice(invoice) {
  if (!invoice || invoice.isWrittenOff) {
    return false;
  }

  if (invoice.invoiceType === "xray") {
    return Boolean(invoice.isSent);
  }

  return invoice.status === "Needs Resend" || Boolean(invoice.isSent);
}
