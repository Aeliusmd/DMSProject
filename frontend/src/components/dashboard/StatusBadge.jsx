const badgeStyles = {
  Active: "bg-[#DCFCE7] text-[#15803D]",
  "No Subpoena": "bg-[#F1F5F9] text-[#334155]",
  "Ready to Pickup": "bg-[#CCFBF1] text-[#0F766E]",
  Completed: "bg-[#DCFCE7] text-[#15803D]",
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-[8px] py-[3px] text-[11px] font-medium ${
        badgeStyles[status] || "bg-[#F1F5F9] text-[#334155]"
      }`}
    >
      {status}
    </span>
  );
}