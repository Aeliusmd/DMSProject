"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: <DashboardIcon /> },
  { label: "Orders", href: "/orders", icon: <OrdersIcon /> },
  { label: "Invoices", href: "/invoices", icon: <InvoicesIcon /> },
  { label: "Employees", href: "/employees", icon: <EmployeesIcon /> },
  { label: "Facilities", href: "/customers", icon: <CustomersIcon /> },
  { label: "Activity Log", href: "/activity-log", icon: <ActivityIcon /> },
  { label: "Reports", href: "/reports", icon: <ReportsIcon /> },
  { label: "Settings", href: "/settings", icon: <SettingsIcon /> },
];

export default function Sidebar({ isCollapsed }) {
  const pathname = usePathname();

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen shrink-0 flex-col border-r border-[#E2E8F0] bg-white transition-all duration-300 ${
        isCollapsed ? "w-[72px]" : "w-[190px]"
      } max-md:w-[72px]`}
    >
      <div className="flex h-[52px] items-center justify-center border-b border-[#E2E8F0]">
        <Image
          src="/images/logo.png"
          alt="DMS Logo"
          width={54}
          height={34}
          priority
          className={`h-auto transition-all ${
            isCollapsed ? "w-[36px]" : "w-[54px]"
          } max-md:w-[36px]`}
        />
      </div>

      <nav className="flex-1 px-[10px] py-[16px]">
        <div className="space-y-[7px]">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.label}
                href={item.href}
                title={isCollapsed ? item.label : ""}
                className={`flex h-[41px] w-full items-center rounded-[6px] text-[13px] transition ${
                  isCollapsed
                    ? "justify-center px-0"
                    : "gap-[12px] px-[12px] max-md:justify-center max-md:px-0"
                } ${
                  isActive
                    ? "bg-[#E6F7FA] font-medium text-[#007F96]"
                    : "text-[#334155] hover:bg-[#F8FAFC]"
                }`}
              >
                <span className="flex h-[16px] w-[16px] shrink-0 items-center justify-center">
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <span className="max-md:hidden">{item.label}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-[#E2E8F0] px-[10px] py-[16px]">
        <button
          type="button"
          title={isCollapsed ? "Log out" : ""}
          className={`flex h-[40px] w-full items-center rounded-[6px] text-[13px] text-[#334155] hover:bg-[#F8FAFC] ${
            isCollapsed
              ? "justify-center"
              : "gap-[12px] px-[12px] max-md:justify-center max-md:px-0"
          }`}
        >
          <LogoutIcon />
          {!isCollapsed && <span className="max-md:hidden">Log out</span>}
        </button>
      </div>
    </aside>
  );
}

function DashboardIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m12 8 3 3-3 3-3-3 3-3Z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M6 4h12v16H6V4Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 9h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function InvoicesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h12v18H6V3Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 8h6M9 12h6M9 16h3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function EmployeesIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M2 20a6 6 0 0 1 12 0" stroke="currentColor" strokeWidth="1.7" />
      <path d="M17 11a2.5 2.5 0 1 0 0-5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15 20a5 5 0 0 1 7 0" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function CustomersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M4 12a8 8 0 1 0 2.34-5.66" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 4v6h6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M5 20V10M12 20V4M19 20v-7" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.7a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.7a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M10 17l5-5-5-5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 12H3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M21 3v18h-7" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}