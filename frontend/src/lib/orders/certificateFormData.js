export function formatCertificateDate(date = new Date()) {
  const parsed = new Date(
    typeof date === "string" && !date.includes("T") ? `${date}T12:00:00` : date
  );
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function splitAddressIntoLines(address = "") {
  const trimmed = String(address).trim();
  if (!trimmed) return [];

  const parts = trimmed.split(", ").filter(Boolean);
  if (parts.length <= 2) return parts;

  return [parts.slice(0, -2).join(", "), parts.slice(-2).join(", ")];
}

function resolveOrderReference(order) {
  const orderNumber = String(order.id || order.orderNo || "").trim();
  const orderRef = String(order.orderRef || "")
    .replace(/^Ord\s*#\s*/i, "")
    .trim();

  return orderRef || orderNumber || "N/A";
}

export function buildCertificateFormData(order) {
  if (!order) return null;

  const reference = resolveOrderReference(order);
  const facilityLines = order.facilityInfo?.addressLines?.filter(Boolean) || [];
  const companyAddress = order.company?.address || "";

  return {
    orderId: order.id || order.orderNo || "N/A",
    date: formatCertificateDate(),
    applicant: order.applicant || "N/A",
    reference,
    facilityName: order.facilityInfo?.name || order.facilityName || "N/A",
    facilityAddressLines:
      facilityLines.length > 0
        ? facilityLines
        : order.facilityInfo?.address
          ? [order.facilityInfo.address]
          : [],
    companyName: order.company?.name || "N/A",
    companyAddressLines: splitAddressIntoLines(companyAddress),
  };
}

export function buildCnrDocumentFormData(order) {
  if (!order) return null;

  return {
    isMemo: Boolean(order.cnrMemo),
    orderId: order.id || order.orderNo || "N/A",
    documentDate: formatCertificateDate(order.cnrDateSent || new Date()),
    applicant: order.applicant || "N/A",
    reference: resolveOrderReference(order),
    recipientCompany:
      order.company?.name || order.providerName || order.serveCompanyName || "N/A",
    facilityName: order.facilityInfo?.name || order.facilityName || "N/A",
    cnrReason: order.cnrReason || "",
  };
}
