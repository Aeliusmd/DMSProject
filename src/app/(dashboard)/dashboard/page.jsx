import Link from "next/link";
import DashboardShell from "@/components/layout/DashboardShell";
import CurrentDateTime from "@/components/dashboard/CurrentDateTime";

const stats = [
  {
    label: "Total Orders",
    value: "30",
    icon: <OrderIcon />,
    iconBg: "#E6F7FA",
    iconColor: "#0097B2",
  },
  {
    label: "Active Cases",
    value: "16",
    icon: <CaseIcon />,
    iconBg: "#ECFDF5",
    iconColor: "#059669",
  },
  {
    label: "Rush Orders",
    value: "18",
    icon: <RushIcon />,
    iconBg: "#FFF7ED",
    iconColor: "#EA580C",
  },
  {
    label: "Outstanding",
    value: "$68,615.00",
    icon: <MoneyIcon />,
    iconBg: "#FFFBEB",
    iconColor: "#B45309",
  },
  {
    label: "Unprocessed",
    value: "7",
    icon: <DocumentIcon />,
    iconBg: "#F5F3FF",
    iconColor: "#7C3AED",
  },
  {
    label: "Customers",
    value: "15",
    icon: <CustomerIcon />,
    iconBg: "#EFF6FF",
    iconColor: "#2563EB",
  },
  {
    label: "Pending Reminders",
    value: "12",
    icon: <ReminderIcon />,
    iconBg: "#FFF1F2",
    iconColor: "#E11D48",
  },
  {
    label: "Completed",
    value: "3",
    icon: <CompletedIcon />,
    iconBg: "#ECFDF5",
    iconColor: "#059669",
  },
];

const quickActions = [
  {
    label: "New Order",
    href: "/orders/new",
    icon: <PlusIcon />,
    primary: true,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: <ReportsIcon />,
  },
  {
    label: "Activity Report",
    href: "/reports/activity-report",
    icon: <ClockIcon />,
  },
  {
    label: "Invoices",
    href: "/invoices",
    icon: <InvoiceIcon />,
  },
  {
    label: "Unprocessed",
    href: "/orders/unprocessed",
    icon: <DocumentIcon />,
  },
  {
    label: "Batch Scan",
    href: "/orders",
    icon: <ScanIcon />,
  },
  {
    label: "Customers",
    href: "/customers",
    icon: <CustomerIcon />,
  },
  {
    label: "Employees",
    href: "/employees",
    icon: <EmployeesIcon />,
  },
];

const recentOrders = [
  {
    order: "75228-1",
    subNo: "1899094",
    status: "Active",
    applicant: "Astrid Ramirez",
    provider: "Gemini Legal Support, Inc.",
    subpoenaDate: "2026-05-15",
    rush: "Rush 1",
    invoice: "Pending",
  },
  {
    order: "75229-1",
    subNo: "REC-187697",
    status: "Active",
    applicant: "Marco Delgado",
    provider: "Pacific Diagnostic Center",
    subpoenaDate: "2026-05-18",
    rush: "Rush 2",
    invoice: "Created",
  },
  {
    order: "75230-1",
    subNo: "1899283",
    status: "Ready",
    applicant: "Jennifer Walsh",
    provider: "Valley Medical Group",
    subpoenaDate: "2026-04-10",
    rush: "—",
    invoice: "Created",
  },
  {
    order: "75231-1",
    subNo: "1899218",
    status: "Active",
    applicant: "Robert Kim",
    provider: "Kaiser Permanente",
    subpoenaDate: "2026-05-01",
    rush: "Rush 2",
    invoice: "Pending",
  },
  {
    order: "75231-2",
    subNo: "1899211",
    status: "Active",
    applicant: "Robert Kim",
    provider: "Kaiser Permanente",
    subpoenaDate: "2026-05-01",
    rush: "Rush 2",
    invoice: "Pending",
  },
  {
    order: "75232-1",
    subNo: "1899225",
    status: "No Subpoena",
    applicant: "Lisa Torres",
    provider: "Cedars-Sinai Medical Center",
    subpoenaDate: "2026-05-28",
    rush: "Rush 1",
    invoice: "Pending",
  },
  {
    order: "75233-1",
    subNo: "1899234",
    status: "Completed",
    applicant: "Michael Brooks",
    provider: "UCLA Health",
    subpoenaDate: "2026-03-01",
    rush: "—",
    invoice: "Paid",
  },
  {
    order: "75234-1",
    subNo: "1899240",
    status: "Active",
    applicant: "Angela Foster",
    provider: "Children's Hospital LA",
    subpoenaDate: "2026-05-20",
    rush: "Rush 1",
    invoice: "Pending",
  },
];

const financialSummary = [
  {
    label: "Total Invoiced",
    value: "$108,065.00",
    color: "text-[#111827]",
  },
  {
    label: "Total Paid",
    value: "$39,450.00",
    color: "text-[#059669]",
  },
  {
    label: "Outstanding",
    value: "$68,615.00",
    color: "text-[#EA580C]",
  },
  {
    label: "Overdue Invoices",
    value: "50",
    color: "text-red-500",
  },
  {
    label: "Needs Resend",
    value: "13",
    color: "text-[#EA580C]",
  },
];

const topProviders = [
  {
    name: "Adventist Health",
    cases: "3 cases",
    invoiced: "$2,845.00",
    paid: "$2,100.00",
  },
  {
    name: "UCLA Health",
    cases: "2 cases",
    invoiced: "$2,400.00",
    paid: "$2,400.00",
  },
  {
    name: "Kaiser Permanente",
    cases: "2 cases",
    invoiced: "$2,100.00",
    paid: "$1,050.00",
  },
  {
    name: "Cedars-Sinai Medical Center",
    cases: "2 cases",
    invoiced: "$1,950.00",
    paid: "$1,950.00",
  },
  {
    name: "Scripps Health",
    cases: "2 cases",
    invoiced: "$1,780.00",
    paid: "$1,780.00",
  },
];

export default function DashboardPage() {
  return (
    <DashboardShell>
      <div className="flex min-h-[calc(100vh-92px)] flex-col gap-5 overflow-hidden">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-[18px] font-semibold text-[#111827]">
              Good morning, John
            </h1>

            <p className="mt-1 text-[12px] text-[#64748B]">
              Here&apos;s your DMS command center — all systems at a glance
            </p>
          </div>

          <div className="flex flex-col gap-1 text-left text-[11px] text-[#64748B] sm:flex-row sm:items-center sm:gap-8 xl:text-right">
            <CurrentDateTime />

            <p>
              Found{" "}
              <span className="font-semibold text-[#334155]">30</span>{" "}
              records as of 06/02/26 9:37 AM
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <DashboardStatCard key={stat.label} {...stat} />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {quickActions.map((action) => (
            <QuickActionButton key={action.label} {...action} />
          ))}
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <RecentOrdersPanel />

          <div className="grid grid-cols-1 gap-4">
            <FinancialSummaryCard />
            <TopProvidersCard />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function DashboardStatCard({ label, value, icon, iconBg, iconColor }) {
  return (
    <section className="min-w-0 rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px]"
          style={{
            backgroundColor: iconBg,
            color: iconColor,
          }}
        >
          {icon}
        </div>

        <span className="text-[13px] text-[#CBD5E1]">→</span>
      </div>

      <h2 className="truncate text-[24px] font-semibold leading-none text-[#111827]">
        {value}
      </h2>

      <p className="mt-2 text-[12px] text-[#64748B]">{label}</p>
    </section>
  );
}

function QuickActionButton({ label, href, icon, primary = false }) {
  return (
    <Link
      href={href}
      className={`inline-flex h-[38px] items-center justify-center gap-2 rounded-[6px] px-4 text-[12px] font-semibold shadow-sm transition ${
        primary
          ? "bg-[#0097B2] text-white hover:bg-[#0086A0]"
          : "border border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

function RecentOrdersPanel() {
  return (
    <section className="min-h-0 overflow-hidden rounded-[10px] border border-[#E2E8F0] bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-[#F1F5F9] px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-[13px] font-semibold text-[#111827]">
            Recent Orders
          </h2>
          <p className="mt-1 text-[11px] text-[#94A3B8]">
            Last 8 orders from DMS Orders
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          <LegendDot color="#EAB308" label="Rush 1" />
          <LegendDot color="#F97316" label="Rush 2" />
          <LegendDot color="#EF4444" label="Overdue" />

          <Link
            href="/orders"
            className="font-semibold text-[#0097B2] hover:underline"
          >
            View All
          </Link>
        </div>
      </div>

      <div className="max-h-[430px] overflow-auto">
        <table className="w-full min-w-[860px] border-collapse">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-[#F1F5F9] text-left text-[11px] font-semibold text-[#64748B]">
              <th className="px-4 py-3">Order #</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Subpoena Date</th>
              <th className="px-4 py-3">Rush</th>
              <th className="px-4 py-3">Invoice</th>
            </tr>
          </thead>

          <tbody>
            {recentOrders.map((order) => (
              <tr
                key={`${order.order}-${order.subNo}`}
                className="border-b border-[#F8FAFC] last:border-b-0 hover:bg-[#F8FBFC]"
              >
                <td className="px-4 py-3 align-middle">
                  <Link
                    href="/orders"
                    className="inline-flex rounded-[4px] bg-[#E6F7FA] px-2 py-1 text-[11px] font-semibold text-[#007F96] hover:underline"
                  >
                    {order.order}
                  </Link>
                  <p className="mt-1 text-[10px] text-[#94A3B8]">
                    {order.subNo}
                  </p>
                </td>

                <td className="px-4 py-3 align-middle">
                  <StatusBadge status={order.status} />
                </td>

                <td className="px-4 py-3 text-[12px] text-[#334155]">
                  {order.applicant}
                </td>

                <td className="max-w-[160px] truncate px-4 py-3 text-[12px] text-[#334155]">
                  {order.provider}
                </td>

                <td className="px-4 py-3 text-[12px] text-[#334155]">
                  {order.subpoenaDate}
                </td>

                <td className="px-4 py-3">
                  <RushBadge rush={order.rush} />
                </td>

                <td className="px-4 py-3">
                  <InvoiceBadge status={order.invoice} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FinancialSummaryCard() {
  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
      <h2 className="mb-4 text-[13px] font-semibold text-[#111827]">
        Financial Summary
      </h2>

      <div className="space-y-4">
        {financialSummary.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-[12px] text-[#64748B]">{item.label}</span>
            <span className={`text-[13px] font-semibold ${item.color}`}>
              {item.value}
            </span>
          </div>
        ))}
      </div>

      <Link
        href="/invoices"
        className="mt-4 block text-center text-[12px] font-semibold text-[#0097B2] hover:underline"
      >
        View Outstanding Invoices
      </Link>
    </section>
  );
}

function TopProvidersCard() {
  return (
    <section className="rounded-[10px] border border-[#E2E8F0] bg-white px-4 py-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-[#111827]">
          Top Providers
        </h2>

        <Link
          href="/reports/activity-report"
          className="text-[11px] font-semibold text-[#0097B2] hover:underline"
        >
          Full Report
        </Link>
      </div>

      <div className="space-y-4">
        {topProviders.map((provider) => (
          <div
            key={provider.name}
            className="flex items-start justify-between gap-4"
          >
            <div className="min-w-0">
              <h3 className="truncate text-[12px] font-semibold text-[#334155]">
                {provider.name}
              </h3>
              <p className="mt-1 text-[10px] text-[#94A3B8]">
                {provider.cases}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="text-[12px] font-semibold text-[#334155]">
                {provider.invoiced}
              </p>
              <p className="mt-1 text-[10px] font-semibold text-[#059669]">
                {provider.paid}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1 text-[#64748B]">
      <span
        className="h-[6px] w-[6px] rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Active: "bg-[#ECFDF5] text-[#059669]",
    Ready: "bg-[#E6F7FA] text-[#007F96]",
    Completed: "bg-[#ECFDF5] text-[#059669]",
    "No Subpoena": "bg-[#F1F5F9] text-[#475569]",
  };

  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-full px-3 text-[10px] font-semibold ${
        styles[status] || styles.Active
      }`}
    >
      {status}
    </span>
  );
}

function RushBadge({ rush }) {
  if (!rush || rush === "—") {
    return <span className="text-[11px] text-[#CBD5E1]">—</span>;
  }

  const styles = {
    "Rush 1": "border-[#FCD34D] bg-[#FFFBEB] text-[#B45309]",
    "Rush 2": "border-[#FDBA74] bg-[#FFF7ED] text-[#EA580C]",
  };

  return (
    <span
      className={`inline-flex h-[22px] items-center justify-center whitespace-nowrap rounded-full border px-3 text-[10px] font-semibold ${
        styles[rush] || styles["Rush 1"]
      }`}
    >
      {rush}
    </span>
  );
}

function InvoiceBadge({ status }) {
  const styles = {
    Pending: "bg-[#F1F5F9] text-[#64748B]",
    Created: "bg-[#E6F7FA] text-[#007F96]",
    Paid: "bg-[#ECFDF5] text-[#059669]",
  };

  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-full px-3 text-[10px] font-semibold ${
        styles[status] || styles.Pending
      }`}
    >
      {status}
    </span>
  );
}

function OrderIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M7 3h10v18H7V3Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 8h6M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CaseIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16v12H4V7Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 7V5h6v2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function RushIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M13 2 5 14h6l-1 8 8-12h-6l1-8Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoneyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 7v10M9.5 9.5A2.5 2.5 0 0 1 12 8c1.4 0 2.5.7 2.5 1.7 0 1.1-1 1.6-2.5 2.1-1.5.5-2.5 1-2.5 2.2 0 1.1 1.1 2 2.6 2 1.2 0 2.2-.5 2.8-1.3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M7 3h7l5 5v13H7V3Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CustomerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 21a7 7 0 0 1 14 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ReminderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 7h18s-3 0-3-7"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CompletedIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M5 20V4h14v16H5Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 16V9M12 16V6M16 16v-4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function InvoiceIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1V3Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M10 8h4M10 12h4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ScanIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <path d="M4 7V4h3M17 4h3v3M20 17v3h-3M7 20H4v-3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 12h10" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EmployeesIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 20a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.8" />
      <path d="M17 10a3 3 0 1 0 0-6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M17 14a5 5 0 0 1 4 5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}