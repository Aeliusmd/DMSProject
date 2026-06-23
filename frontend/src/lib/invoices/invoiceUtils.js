export function parseInvoiceDueAmount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function canWriteOffInvoice(invoice) {
  if (!invoice || invoice.isWrittenOff) return false;
  return parseInvoiceDueAmount(invoice.due) > 0;
}
