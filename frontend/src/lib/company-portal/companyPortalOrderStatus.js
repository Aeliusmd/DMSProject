/** Shared status badge styles for company-portal order lists. */

export function getOrderStatusStyles(status) {
  switch (status) {
    case "Released":
      return "bg-[#ECFDF5] text-[#059669]";
    case "Paid":
      return "bg-[#EFF6FF] text-[#2563EB]";
    case "Invoice":
      return "bg-[#FFFBEB] text-[#D97706]";
    case "In Process":
      return "bg-[#E6F7FA] text-[#0B7C8E]";
    case "Awaiting Payment":
    case "Draft":
      return "bg-[#FFF7ED] text-[#C2410C]";
    case "Cancelled":
      return "bg-[#FEE2E2] text-[#DC2626]";
    default:
      return "bg-[#F1F5F9] text-[#64748B]";
  }
}

export function mapDashboardOrderRow(order = {}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber || "—",
    applicant: order.applicantName || "—",
    facility: order.facilityName || "—",
    placedBy: order.placedByName || "Company Account",
    status: order.status || "—",
    dateRequested:
      order.dateRequested ||
      (order.createdAt ? String(order.createdAt).slice(0, 10) : ""),
  };
}
