"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CompanyPortalSidebar from "@/components/company-portal/CompanyPortalSidebar";
import useIsClient from "@/hooks/useIsClient";
import { PORTAL_NAVIGATION_HIDDEN } from "@/lib/portalNavigationVisibility";
import {
  clearCompanyAuth,
  getStoredCompanyUser,
} from "@/lib/company-portal/companyPortalAuthStorage";
import {
  getCompanyCurrentUser,
  startCompanyAuthAutoRefresh,
  stopCompanyAuthAutoRefresh,
} from "@/lib/company-portal/companyPortalAuthApi";

export default function CompanyPortalDashboardShell({ children, title }) {
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const isClient = useIsClient();
  const user = isClient ? getStoredCompanyUser() : null;

  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      try {
        await getCompanyCurrentUser();

        if (isMounted) {
          setSessionReady(true);
          startCompanyAuthAutoRefresh();
        }
      } catch {
        clearCompanyAuth();
        router.replace("/company-portal/login");
      }
    }

    verifySession();

    return () => {
      isMounted = false;
      stopCompanyAuthAutoRefresh();
    };
  }, [router]);

  const isEmployee = user?.isAdmin === false;
  const companyName = user?.companyName || "Company Portal";

  const displayName = isEmployee
    ? user?.name || user?.email || "Employee"
    : companyName;

  const subtitle = isEmployee ? companyName : "Company portal";
  const initialsSource = isEmployee ? displayName : companyName;

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <p className="text-[13px] text-[#64748B]">Checking session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#111827]">
      {!PORTAL_NAVIGATION_HIDDEN ? (
        <CompanyPortalSidebar isCollapsed={isSidebarCollapsed} />
      ) : null}

      <div
        className={`min-h-screen min-w-0 transition-all duration-300 ${
          PORTAL_NAVIGATION_HIDDEN
            ? "pl-0"
            : isSidebarCollapsed
              ? "pl-[72px]"
              : "pl-[190px]"
        } ${PORTAL_NAVIGATION_HIDDEN ? "" : "max-md:pl-[72px]"}`}
      >
        {!PORTAL_NAVIGATION_HIDDEN ? (
          <header className="sticky top-0 z-30 flex min-h-[52px] items-center gap-2 border-b border-[#E2E8F0] bg-white px-2 py-2 sm:gap-3 sm:px-[18px]">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[6px] text-[#0097B2] hover:bg-[#E6F7FA]"
              aria-label="Toggle sidebar"
            >
              <MenuIcon />
            </button>

            <div className="min-w-0 flex-1">
              {title ? (
                <p className="truncate text-[13px] font-semibold text-[#111827]">
                  {title}
                </p>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden text-right sm:block">
                <p className="max-w-[200px] truncate text-[12px] font-semibold text-[#111827]">
                  {displayName}
                </p>

                <p className="max-w-[200px] truncate text-[11px] text-[#64748B]">
                  {subtitle}
                </p>
              </div>

              <div className="flex h-[32px] w-[32px] items-center justify-center rounded-full bg-[#E6F7FA] text-[11px] font-semibold text-[#007F96]">
                {getInitials(initialsSource)}
              </div>
            </div>
          </header>
        ) : null}

        <main
          className={`overflow-y-auto px-4 py-4 sm:px-5 lg:px-6 ${
            PORTAL_NAVIGATION_HIDDEN
              ? "min-h-screen"
              : "min-h-[calc(100vh-52px)]"
          }`}
        >
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "CP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function MenuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}