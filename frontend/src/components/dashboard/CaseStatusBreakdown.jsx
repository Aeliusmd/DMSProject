const statuses = [
  { label: "Active", value: 3, color: "bg-[#10B981]", width: "100%" },
  { label: "No Subpoena", value: 2, color: "bg-[#94A3B8]", width: "67%" },
  { label: "No Records", value: 1, color: "bg-[#CBD5E1]", width: "34%" },
  { label: "Ready", value: 1, color: "bg-[#0EA5E9]", width: "34%" },
  { label: "Ready Pickup", value: 2, color: "bg-[#0097B2]", width: "67%" },
  { label: "Completed", value: 1, color: "bg-[#10B981]", width: "34%" },
  { label: "Cancelled", value: 1, color: "bg-[#F87171]", width: "34%" },
  { label: "Write Offs", value: 1, color: "bg-[#EF4444]", width: "34%" },
];

const reminders = [
  {
    title: "Pickup Reminder — Brown Estate Planning",
    code: "(ORD-2026-005)",
    due: "Due: Today",
    tone: "red",
  },
  {
    title: "Missing Forms — H & 4 for Rodriguez Divorce",
    code: "(ORD-2026-007)",
    due: "Due: Tomorrow",
    tone: "cyan",
  },
  {
    title: "New Invoice — INV-007 for Williams Criminal Defense",
    code: "",
    due: "Due: In 3 days",
    tone: "cyan",
  },
];

export default function CaseStatusBreakdown() {
  return (
    <aside className="max-h-[480px] min-w-0 overflow-y-auto rounded-[9px] border border-[#E2E8F0] bg-white px-[16px] py-[16px] shadow-sm xl:max-h-[calc(100vh-330px)]">
      <h2 className="mb-[14px] text-[14px] font-semibold text-[#111827]">
        Case Status Breakdown
      </h2>

      <div className="space-y-[12px]">
        {statuses.map((item) => (
          <div key={item.label} className="min-w-0">
            <div className="mb-[5px] flex items-center justify-between gap-3 text-[11px]">
              <span className="min-w-0 truncate text-[#334155]">
                {item.label}
              </span>
              <span className="shrink-0 text-[#94A3B8]">{item.value}</span>
            </div>

            <div className="h-[4px] overflow-hidden rounded-full bg-[#E2E8F0]">
              <div
                className={`h-full rounded-full ${item.color}`}
                style={{ width: item.width }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-[28px]">
        <h3 className="mb-[14px] text-[13px] font-semibold text-[#64748B]">
          Pending Reminders
        </h3>

        <div className="space-y-[14px]">
          {reminders.map((reminder) => (
            <div key={reminder.title} className="flex min-w-0 gap-[10px]">
              <div
                className={`mt-[2px] flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-full ${
                  reminder.tone === "red"
                    ? "bg-[#FEE2E2] text-[#EF4444]"
                    : "bg-[#DDF6FA] text-[#0097B2]"
                }`}
              >
                <ReminderIcon />
              </div>

              <div className="min-w-0">
                <p className="break-words text-[11px] leading-[16px] text-[#334155]">
                  {reminder.title}
                </p>

                {reminder.code && (
                  <p className="break-words text-[11px] leading-[15px] text-[#64748B]">
                    {reminder.code}
                  </p>
                )}

                <p
                  className={`mt-[2px] text-[10px] font-medium ${
                    reminder.tone === "red"
                      ? "text-[#EF4444]"
                      : "text-[#0097B2]"
                  }`}
                >
                  {reminder.due}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function ReminderIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M12 8v4l2 2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}