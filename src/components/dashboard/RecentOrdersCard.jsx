import StatusBadge from "@/components/dashboard/StatusBadge";

const recentOrders = [
  {
    id: "ORD-2026-001",
    case: "Smith vs. Johnson",
    company: "Property | Smith & Associates",
    status: "Active",
  },
  {
    id: "ORD-2026-002",
    case: "Martinez Immigration Appeal",
    company: "Martinez Legal Group",
    status: "No Subpoena",
  },
  {
    id: "ORD-2026-003",
    case: "Chen Business Formation",
    company: "Pacific Law Partners",
    status: "Ready to Pickup",
  },
  {
    id: "ORD-2026-004",
    case: "Williams Criminal Defense",
    company: "Williams & Co.",
    status: "Active",
  },
  {
    id: "ORD-2026-005",
    case: "Brown Estate Planning",
    company: "Brown Family Trust",
    status: "Completed",
  },
  {
    id: "ORD-2026-006",
    case: "Rodriguez Divorce",
    company: "Rodriguez Legal Office",
    status: "No Subpoena",
  },
  {
    id: "ORD-2026-007",
    case: "Williams Criminal Defense",
    company: "Williams & Co.",
    status: "Ready to Pickup",
  },
];

export default function RecentOrdersCard() {
  return (
    <section className="flex min-h-[320px] max-h-[480px] min-w-0 flex-col overflow-hidden rounded-[9px] border border-[#E2E8F0] bg-white shadow-sm xl:max-h-[calc(100vh-330px)]">
      <div className="flex h-[54px] shrink-0 items-center justify-between gap-3 px-[18px]">
        <h2 className="text-[14px] font-semibold text-[#111827]">
          Recent Orders
        </h2>

        <button className="shrink-0 text-[12px] font-medium text-[#0097B2] hover:underline">
          View All
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-[18px] pb-[14px]">
        <table className="w-full min-w-[680px] border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-[#F1F5F9] text-left text-[11px] font-medium text-[#64748B]">
              <th className="py-[10px] pr-4">Order ID</th>
              <th className="py-[10px] pr-4">Case</th>
              <th className="py-[10px] pr-4">Company</th>
              <th className="py-[10px]">Status</th>
            </tr>
          </thead>

          <tbody>
            {recentOrders.map((order) => (
              <tr
                key={order.id}
                className="border-b border-[#F8FAFC] text-[12px] text-[#334155]"
              >
                <td className="whitespace-nowrap py-[10px] pr-4">
                  <span className="rounded-[4px] bg-[#DDF6FA] px-[7px] py-[3px] text-[11px] font-semibold text-[#007F96]">
                    {order.id}
                  </span>
                </td>

                <td className="whitespace-nowrap py-[10px] pr-4">
                  {order.case}
                </td>

                <td className="whitespace-nowrap py-[10px] pr-4">
                  {order.company}
                </td>

                <td className="whitespace-nowrap py-[10px]">
                  <StatusBadge status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}