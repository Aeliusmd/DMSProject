export const NO_PROVIDER_EMAIL_MESSAGE =
  "No provider email on file. Edit the order to add the provider email.";

export function buildEditOrderUrl(orderId) {
  if (!orderId) return "/orders";
  return `/orders/new?mode=edit&orderId=${encodeURIComponent(orderId)}`;
}

export function buildOrderForInvoiceEmailModal({
  orderId,
  caseNo,
  applicant,
  companyName,
  companyEmail = "",
  invoiceId = null,
}) {
  const email = `${companyEmail || ""}`.trim();
  const primaryEmail = email.split(/[,;]/)[0]?.trim() || email;

  return {
    id: caseNo || orderId,
    dbId: orderId,
    applicant: applicant || caseNo || "N/A",
    company: {
      name: companyName || "—",
      email,
      emailAddress: primaryEmail,
    },
    invoice: invoiceId
      ? { invoiceId: Number(invoiceId) || invoiceId }
      : undefined,
  };
}

export function resolveInvoiceEmailModalKind(invoices = []) {
  if (invoices.length && invoices.every((invoice) => invoice.invoiceType === "xray")) {
    return "xray";
  }

  return "standard";
}

export function isNoProviderEmailError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("no provider email");
}

export function handleMissingProviderEmail(orderId, router) {
  window.alert(NO_PROVIDER_EMAIL_MESSAGE);

  if (orderId && router?.push) {
    router.push(buildEditOrderUrl(orderId));
  }
}

export function parseInvoiceDueAmount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function canWriteOffInvoice(invoice) {
  if (!invoice) {
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
