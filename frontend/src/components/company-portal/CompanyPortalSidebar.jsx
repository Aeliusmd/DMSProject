"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { logoutCompany } from "@/lib/company-portal/companyPortalAuthApi";
import { getStoredCompanyUser } from "@/lib/company-portal/companyPortalAuthStorage";

const adminNavItems = [
  { label: "Dashboard", href: "/company-portal/dashboard", icon: <DashboardIcon /> },
  { label: "Create Order", href: "/company-portal/orders/new", icon: <OrdersIcon /> },
  { label: "Track Order", href: "/company-portal/orders/track", icon: <TrackIcon /> },
  { label: "Employees", href: "/company-portal/employees", icon: <EmployeesIcon /> },
  { label: "Money Management", href: "/company-portal/money", icon: <MoneyIcon /> },
  { label: "Activity Log", href: "/company-portal/activity-log", icon: <ActivityIcon /> },
  { label: "Profile", href: "/company-portal/profile", icon: <ProfileIcon /> },
];

const employeeNavItems = [
  { label: "Dashboard", href: "/company-portal/dashboard", icon: <DashboardIcon /> },
  { label: "Create Order", href: "/company-portal/orders/new", icon: <OrdersIcon /> },
  { label: "Track Order", href: "/company-portal/orders/track", icon: <TrackIcon /> },
  { label: "Profile", href: "/company-portal/profile", icon: <ProfileIcon /> },
];

export default function CompanyPortalSidebar({ isCollapsed }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const storedUser = getStoredCompanyUser();
  const navItems =
    storedUser?.isAdmin === false ? employeeNavItems : adminNavItems;

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logoutCompany();
    } finally {
      router.push("/company-portal/login");
      setIsLoggingOut(false);
    }
  };

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
          style={{ height: "auto" }}
          className={`transition-all ${
            isCollapsed ? "w-[36px]" : "w-[54px]"
          } max-md:w-[36px]`}
        />
      </div>

      <nav className="flex-1 px-[10px] py-[16px]">
        <div className="space-y-[7px]">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/company-portal/dashboard" &&
                pathname?.startsWith(item.href));

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
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`flex h-[40px] w-full items-center rounded-[6px] text-[13px] text-[#334155] hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60 ${
            isCollapsed
              ? "justify-center"
              : "gap-[12px] px-[12px] max-md:justify-center max-md:px-0"
          }`}
        >
          <LogoutIcon />
          {!isCollapsed && (
            <span className="max-md:hidden">
              {isLoggingOut ? "Logging out..." : "Log out"}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 4h7v7H4V4Zm9 0h7v5h-7V4ZM4 13h7v7H4v-7Zm9 3h7v4h-7v-4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OrdersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 7h8M8 12h8M8 17h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function TrackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M16 16l4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 19c1.5-3 3.8-4.5 6.5-4.5S17 16 18.5 19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EmployeesIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 19c0-2.2 2.2-4 5-4M14 19c0-1.8 1.8-3.5 4-3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoneyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 19V5M4 19h16M8 15l3-4 2 2 4-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M14 16l4-4-4-4M18 12H9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
