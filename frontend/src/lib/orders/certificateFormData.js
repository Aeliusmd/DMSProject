export function formatCertificateDate(date = new Date()) {
  return new Date(date).toLocaleDateString("en-US", {
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

export function buildCertificateFormData(order) {
  if (!order) return null;

  const orderNumber = String(order.id || order.orderNo || "").trim();
  const orderRef = String(order.orderRef || "")
    .replace(/^Ord\s*#\s*/i, "")
    .trim();
  const reference = orderNumber || orderRef || "N/A";

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
