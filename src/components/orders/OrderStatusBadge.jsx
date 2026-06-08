const styles = {
  Active: "bg-[#DCFCE7] text-[#15803D]",
  "No Subpoena": "bg-[#F1F5F9] text-[#334155]",
  "Ready to Pickup": "bg-[#CCFBF1] text-[#0F766E]",
  Ready: "bg-[#DBEAFE] text-[#1D4ED8]",
  Completed: "bg-[#DCFCE7] text-[#15803D]",
  Cancelled: "bg-[#FEE2E2] text-[#DC2626]",
  "No Records": "bg-[#F1F5F9] text-[#334155]",
  "Write Offs": "bg-[#FEE2E2] text-[#DC2626]",
};

export default function OrderStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-[8px] py-[3px] text-[11px] font-medium ${
        styles[status] || "bg-[#F1F5F9] text-[#334155]"
      }`}
    >
      {status}
    </span>
  );
}